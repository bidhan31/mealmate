import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { DepositType, MembershipStatus, NotificationType, WalletTxnSource } from '../../config/enums';
import { cycleFromDateKey, isValidDateKey } from '../../utils/dates';
import { withTransaction } from '../../utils/transaction';
import { Membership } from '../memberships/membership.model';
import { Deposit } from './deposit.model';
import { monthEndService } from '../monthEnd/monthEnd.service';
import { walletService } from '../wallet/wallet.service';
import { auditLogService } from '../auditLog/auditLog.service';
import { notificationService } from '../notifications/notification.service';

interface Actor {
  id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
}

export const depositService = {
  /**
   * Record a deposit for a member. Deposits are independent and minimal —
   * they carry NO purpose. Creating one atomically CREDITS the member's wallet.
   */
  async create(
    homeId: Types.ObjectId,
    actor: Actor,
    data: {
      membershipId: string;
      amount: number;
      depositType?: DepositType;
      date: string;
    },
  ) {
    if (!isValidDateKey(data.date)) throw ApiError.badRequest('Invalid date');
    if (data.amount <= 0) throw ApiError.badRequest('Deposit amount must be positive');

    const member = await Membership.findOne({
      _id: new Types.ObjectId(data.membershipId),
      homeId,
      status: MembershipStatus.Active,
    });
    if (!member) throw ApiError.notFound('Active member not found');

    const cycle = cycleFromDateKey(data.date);
    await monthEndService.assertCycleIsOpen(homeId, cycle);

    const deposit = await withTransaction(async (session) => {
      const [dep] = await Deposit.create(
        [
          {
            homeId,
            createdBy: actor.id,
            membershipId: member._id,
            amount: data.amount,
            depositType: data.depositType ?? DepositType.Cash,
            date: data.date,
            cycle,
          },
        ],
        { session },
      );

      const { txn } = await walletService.credit(session, {
        homeId,
        membershipId: member._id,
        amount: data.amount,
        source: WalletTxnSource.Deposit,
        createdBy: actor.id,
        refModel: 'Deposit',
        refId: dep._id,
        note: 'Deposit',
      });

      dep.walletTxnId = txn._id;
      await dep.save({ session });
      return dep;
    });

    auditLogService
      .log({
        homeId,
        actorUserId: actor.userId,
        actorName: actor.name,
        action: 'DEPOSIT_CREATE',
        targetModel: 'Deposit',
        targetId: deposit._id.toString(),
        after: { membershipId: data.membershipId, amount: data.amount, cycle },
      })
      .catch(() => {});

    notificationService
      .create({
        userId: member.userId as Types.ObjectId,
        homeId,
        type: NotificationType.DepositRecorded,
        message: `A deposit of BDT ${data.amount} has been recorded for your account.`,
        meta: { depositId: deposit._id.toString(), amount: data.amount },
      })
      .catch(() => {});

    return { deposit };
  },

  async list(homeId: Types.ObjectId, cycle?: string) {
    const filter: Record<string, unknown> = { homeId };
    if (cycle) filter.cycle = cycle;
    const deposits = await Deposit.find(filter)
      .populate({ path: 'membershipId', select: 'userId', populate: { path: 'userId', select: 'name' } })
      .sort({ date: -1 })
      .lean();
    const total = deposits.reduce((s, d) => s + d.amount, 0);
    return { total, deposits };
  },

  /**
   * Delete a deposit. Atomically REVERSES the wallet credit (compensating debit).
   * Blocked if the member has already spent the money (would overdraw the wallet).
   */
  async remove(homeId: Types.ObjectId, actor: Actor, id: string) {
    const deposit = await Deposit.findOne({ _id: new Types.ObjectId(id), homeId });
    if (!deposit) throw ApiError.notFound('Deposit not found');
    await monthEndService.assertCycleIsOpen(homeId, deposit.cycle);

    await withTransaction(async (session) => {
      // Reverse the original credit. Throws (insufficient funds) if already spent.
      await walletService.debit(session, {
        homeId,
        membershipId: deposit.membershipId,
        amount: deposit.amount,
        source: WalletTxnSource.Reversal,
        createdBy: actor.id,
        refModel: 'Deposit',
        refId: deposit._id,
        note: 'Deposit deletion reversal',
      });
      await deposit.deleteOne({ session });
    });

    auditLogService
      .log({
        homeId,
        actorUserId: actor.userId,
        actorName: actor.name,
        action: 'DEPOSIT_DELETE',
        targetModel: 'Deposit',
        targetId: id,
        before: { membershipId: deposit.membershipId.toString(), amount: deposit.amount, cycle: deposit.cycle },
      })
      .catch(() => {});

    return { message: 'Deposit deleted and wallet balance reversed' };
  },
};
