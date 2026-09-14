import { Types } from 'mongoose';
import { CycleStatus, MembershipStatus, NotificationType, WalletTxnSource } from '../../config/enums';
import { ApiError } from '../../utils/ApiError';
import { withTransaction } from '../../utils/transaction';
import { dueService } from '../dues/due.service';
import { Home } from '../homes/home.model';
import { Membership } from '../memberships/membership.model';
import { MonthCycle } from './monthEnd.model';
import { walletService } from '../wallet/wallet.service';
import { notificationService } from '../notifications/notification.service';
import { auditLogService } from '../auditLog/auditLog.service';

/** Advance YYYY-MM by one month */
function nextCycle(cycle: string): string {
  const [y, m] = cycle.split('-').map(Number);
  const d = new Date(y, m, 1); // month is 0-indexed in Date, so m (1-based) = next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const monthEndService = {
  async close(
    homeId: Types.ObjectId,
    cycle: string,
    actorUserId: Types.ObjectId,
    actorName: string,
  ) {
    // Guard: prevent double-close
    const existing = await MonthCycle.findOne({ homeId, cycle });
    if (existing?.status === CycleStatus.Closed) {
      throw ApiError.conflict(`Cycle ${cycle} is already closed.`);
    }

    const next = nextCycle(cycle);

    // Compute final dues snapshot using the independent due calculator
    const dues = await dueService.compute(homeId, cycle);

    const totalCharge = dues.members.reduce((s, m) => s + m.charge, 0);
    const totalCredit = dues.members.reduce((s, m) => s + m.credit, 0);
    const totalOutstanding = dues.members
      .filter((m) => m.due > 0)
      .reduce((s, m) => s + m.due, 0);

    /**
     * Wallet Settlement at Month Close
     * ─────────────────────────────────
     * For each member we reconcile the wallet so the next cycle starts cleanly:
     *
     *  • Surplus member  (due < 0):
     *      The member has overpaid. Their surplus = |due|.
     *      We SET the wallet to exactly |due| so the surplus carries into the next
     *      month as available balance. The difference (oldBalance − surplus) is the
     *      portion consumed by this cycle's meal cost / expense liabilities.
     *
     *  • Due member  (due > 0):
     *      The member owes money. Their wallet is LEFT UNCHANGED (they may need it
     *      to pay the carried-over due). The owed amount is stored in memberSnapshot
     *      and picked up by dueService.compute() as carriedOverBalance next cycle.
     *
     *  • Balanced  (due == 0):
     *      Nothing to settle. Wallet stays as-is.
     */
    await withTransaction(async (session) => {
      for (const m of dues.members) {
        const surplus = -m.due; // positive when member is in surplus

        if (surplus > 0) {
          // Member paid more than they owed — settle wallet to the exact surplus
          const targetBalance = Math.round(surplus);
          await walletService.setBalance(session, {
            homeId,
            membershipId: new Types.ObjectId(m.membershipId),
            targetBalance,
            source: WalletTxnSource.MonthClose,
            createdBy: actorUserId,
            refModel: null,
            refId: null,
            note: `Month-end settlement for cycle ${cycle}: wallet reconciled to surplus ৳${targetBalance}`,
          });
        }
        // due > 0: member owes — wallet untouched, due carried via snapshot
        // due == 0: perfectly balanced — wallet untouched
      }
    });

    // Member snapshot: surplus members get due=0 (their surplus is already in the wallet).
    // Due members carry their positive due into the next cycle via carriedOverBalance.
    const memberSnapshot = dues.members.map((m) => ({
      membershipId: m.membershipId,
      userName: m.userName,
      due: m.due > 0 ? m.due : 0,
      carriedOver: m.carriedOverBalance,
    }));

    // Upsert the MonthCycle record (idempotent)
    const closedCycle = await MonthCycle.findOneAndUpdate(
      { homeId, cycle },
      {
        $set: {
          status: CycleStatus.Closed,
          mealRate: dues.mealRate,
          totals: {
            meals: dues.homeTotalMeals,
            foodPurchases: dues.totalFoodPurchases,
            expenses: dues.totalFixedExpenses,
            fixedExpenses: dues.totalFixedExpenses,
            deposits: dues.totalDeposits,
            totalCharge,
            totalCredit,
            totalDue: totalOutstanding,
          },
          memberSnapshot,
          closedBy: actorUserId,
          closedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    // Advance home.currentCycle to next month
    await Home.updateOne({ _id: homeId }, { currentCycle: next });

    // Audit log — non-blocking
    auditLogService
      .log({
        homeId,
        actorUserId,
        actorName,
        action: 'CLOSE_MONTH',
        targetModel: 'MonthCycle',
        targetId: closedCycle._id.toString(),
        after: { cycle, status: CycleStatus.Closed, nextCycle: next, totalOutstanding },
      })
      .catch(() => {/* swallow */});

    // Notify all active members — non-blocking
    Membership.find({ homeId, status: MembershipStatus.Active })
      .populate<{ userId: { _id: Types.ObjectId } }>('userId', '_id')
      .lean()
      .then((memberships) => {
        const userIds = memberships.map((m) => m.userId._id);
        return notificationService.createForHomeMembers(
          userIds,
          homeId,
          NotificationType.MonthClosed,
          `Month ${cycle} has been closed. Wallet balances have been reconciled for the next cycle: ${next}.`,
          { cycle, next },
        );
      })
      .catch(() => {/* swallow */});

    return {
      cycle,
      status: CycleStatus.Closed,
      nextCycle: next,
      mealRate: dues.mealRate,
      totalOutstanding,
      memberCount: dues.members.length,
    };
  },

  async history(homeId: Types.ObjectId) {
    const cycles = await MonthCycle.find({ homeId, status: CycleStatus.Closed })
      .sort({ cycle: -1 })
      .limit(24)
      .lean();

    return {
      cycles: cycles.map((c) => ({
        id: c._id.toString(),
        cycle: c.cycle,
        status: c.status,
        mealRate: c.mealRate,
        totals: c.totals,
        memberSnapshot: c.memberSnapshot,
        closedAt: c.closedAt?.toISOString() ?? null,
      })),
    };
  },

  async currentStatus(homeId: Types.ObjectId, cycle: string) {
    const record = await MonthCycle.findOne({ homeId, cycle }).lean();
    return {
      cycle,
      status: record?.status ?? CycleStatus.Open,
      closedAt: record?.closedAt?.toISOString() ?? null,
    };
  },

  async assertCycleIsOpen(homeId: Types.ObjectId, cycle: string): Promise<void> {
    const status = await this.currentStatus(homeId, cycle);
    if (status.status === CycleStatus.Closed) {
      throw ApiError.badRequest(`Cannot modify records for closed cycle: ${cycle}`);
    }
  },

  async isCycleOpen(homeId: Types.ObjectId, cycle: string): Promise<boolean> {
    const status = await this.currentStatus(homeId, cycle);
    return status.status !== CycleStatus.Closed;
  },
};
