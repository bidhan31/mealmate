import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { DepositType, MembershipStatus, NotificationType, WalletTxnSource } from '../../config/enums';
import { cycleFromDateKey, isValidDateKey } from '../../utils/dates';
import { withTransaction } from '../../utils/transaction';
import { Membership } from '../memberships/membership.model';
import { Refund } from './refund.model';
import { monthEndService } from '../monthEnd/monthEnd.service';
import { walletService } from '../wallet/wallet.service';
import { dueService } from '../dues/due.service';
import { auditLogService } from '../auditLog/auditLog.service';
import { notificationService } from '../notifications/notification.service';

interface Actor {
  id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
}

export const refundService = {
  /**
   * Record a cash refund for a member.
   *
   * Business rules:
   *  - Refund amount must be > 0 and <= member's available refundable wallet advance balance.
   *  - Refund can ONLY be issued if member's wallet has an advance balance (wallet.balance > 0).
   *  - Food purchase excess (foodPurchases > mealCost) CANNOT be refunded in the same cycle.
   *    It is automatically deposited to the wallet when the admin closes the month-end cycle.
   *  - Executing a refund DEBITS the member's wallet by `amount` in real time.
   */
  async create(
    homeId: Types.ObjectId,
    actor: Actor,
    data: {
      membershipId: string;
      amount: number;
      paymentMethod?: DepositType;
      date: string;
      note?: string;
    },
  ) {
    if (!isValidDateKey(data.date)) throw ApiError.badRequest('Invalid date');
    if (data.amount <= 0) throw ApiError.badRequest('Refund amount must be positive');

    const member = await Membership.findOne({
      _id: new Types.ObjectId(data.membershipId),
      homeId,
      status: MembershipStatus.Active,
    });
    if (!member) throw ApiError.notFound('Active member not found');

    const cycle = cycleFromDateKey(data.date);
    await monthEndService.assertCycleIsOpen(homeId, cycle);

    // Compute live dues to get exact wallet balance & current liabilities
    const dues = await dueService.compute(homeId, cycle);
    const memberRow = dues.members.find((m) => m.membershipId === data.membershipId);

    if (!memberRow) {
      throw ApiError.notFound('Member record not found');
    }

    const walletBalance = memberRow.walletBalance;
    if (walletBalance <= 0) {
      throw ApiError.badRequest(
        'Member has no advance balance in their wallet to refund. (Note: Food purchase surplus cannot be refunded in the current cycle; it will be automatically deposited to the wallet at month-end close).',
      );
    }

    // Liabilities that reduce the refundable portion of the wallet balance.
    // The refundable wallet is wallet advance less any current meal and unpaid expense liabilities.
    const foodCredit = Math.max(0, memberRow.foodPurchases);
    const mealCostDue = Math.max(0, memberRow.mealCost - foodCredit);
    const unpaidLiabilities = Math.max(0, (memberRow.mealCost + memberRow.expenseUnpaid) - foodCredit);
    const maxRefundable = Math.max(0, Math.round(walletBalance - unpaidLiabilities));

    if (maxRefundable <= 0) {
      throw ApiError.badRequest(
        `Member's wallet balance (৳${walletBalance}) is required to cover meal cost due (৳${mealCostDue}) and current liabilities, so no refund is available.`,
      );
    }

    const refundAmount = Math.round(data.amount);
    if (refundAmount > maxRefundable) {
      throw ApiError.badRequest(
        `Refund amount (৳${refundAmount}) exceeds maximum refundable wallet advance (৳${maxRefundable} = Wallet ৳${walletBalance} − Meal Cost Due ৳${mealCostDue}).`,
      );
    }

    const refund = await withTransaction(async (session) => {
      const [ref] = await Refund.create(
        [
          {
            homeId,
            createdBy: actor.id,
            membershipId: member._id,
            amount: refundAmount,
            paymentMethod: data.paymentMethod ?? DepositType.Cash,
            date: data.date,
            cycle,
            note: data.note ?? '',
          },
        ],
        { session },
      );

      // Debit wallet ledger (reflecting cash handed over to member)
      const { txn, wallet } = await walletService.debit(session, {
        homeId,
        membershipId: member._id,
        amount: refundAmount,
        source: WalletTxnSource.Refund,
        createdBy: actor.id,
        refModel: 'Refund',
        refId: ref._id,
        note: data.note || 'Cash refund',
      });

      ref.walletTxnId = txn._id;
      await ref.save({ session });
      return { ref, walletAfter: wallet.balance };
    });

    auditLogService
      .log({
        homeId,
        actorUserId: actor.userId,
        actorName: actor.name,
        action: 'REFUND_CREATE',
        targetModel: 'Refund',
        targetId: refund.ref._id.toString(),
        after: {
          membershipId: data.membershipId,
          amount: refundAmount,
          walletAfter: refund.walletAfter,
          cycle,
          note: data.note,
        },
      })
      .catch(() => {});

    notificationService
      .create({
        userId: member.userId as Types.ObjectId,
        homeId,
        type: NotificationType.RefundRecorded,
        message: `A cash refund of BDT ${refundAmount} has been issued to you. Remaining wallet balance: BDT ${refund.walletAfter}.`,
        meta: { refundId: refund.ref._id.toString(), amount: refundAmount, walletAfter: refund.walletAfter },
      })
      .catch(() => {});

    return { refund: refund.ref, walletAfter: refund.walletAfter };
  },

  async list(homeId: Types.ObjectId, cycle?: string) {
    const filter: Record<string, unknown> = { homeId };
    if (cycle) filter.cycle = cycle;
    const refunds = await Refund.find(filter)
      .populate({ path: 'membershipId', select: 'userId', populate: { path: 'userId', select: 'name' } })
      .sort({ date: -1 })
      .lean();
    const total = refunds.reduce((s, r) => s + r.amount, 0);
    return { total, refunds };
  },

  /**
   * Delete/Remove a refund. Atomically REVERSES the wallet debit (compensating credit).
   */
  async remove(homeId: Types.ObjectId, actor: Actor, id: string) {
    const refund = await Refund.findOne({ _id: new Types.ObjectId(id), homeId });
    if (!refund) throw ApiError.notFound('Refund not found');
    await monthEndService.assertCycleIsOpen(homeId, refund.cycle);

    await withTransaction(async (session) => {
      // Reverse the debit by crediting back to member wallet
      await walletService.credit(session, {
        homeId,
        membershipId: refund.membershipId,
        amount: refund.amount,
        source: WalletTxnSource.Reversal,
        createdBy: actor.id,
        refModel: 'Refund',
        refId: refund._id,
        note: 'Refund deletion reversal',
      });
      await refund.deleteOne({ session });
    });

    auditLogService
      .log({
        homeId,
        actorUserId: actor.userId,
        actorName: actor.name,
        action: 'REFUND_DELETE',
        targetModel: 'Refund',
        targetId: id,
        before: { membershipId: refund.membershipId.toString(), amount: refund.amount, cycle: refund.cycle },
      })
      .catch(() => {});

    return { message: 'Refund deleted and wallet balance restored' };
  },

  /**
   * GET /refunds/preview — live settlement snapshot for a member in a cycle.
   * Returns surplus/due status, max refundable, wallet balance, and full breakdown.
   * Read-only — does NOT mutate anything.
   */
  async preview(homeId: Types.ObjectId, membershipId: string, cycle: string) {
    const dues = await dueService.compute(homeId, cycle);
    const row = dues.members.find((m) => m.membershipId === membershipId);

    if (!row) {
      throw ApiError.notFound('Member not found in this home for the given cycle');
    }

    const walletBalance = row.walletBalance;
    const foodCredit = Math.max(0, row.foodPurchases);
    const mealCostDue = Math.max(0, row.mealCost - foodCredit);
    const unpaidLiabilities = Math.max(0, (row.mealCost + row.expenseUnpaid) - foodCredit);
    const maxRefundable = Math.max(0, Math.round(walletBalance - unpaidLiabilities));
    const foodExcess = Math.max(0, Math.round(row.foodPurchases - row.mealCost));
    const canRefund = maxRefundable > 0;

    return {
      membershipId,
      cycle,
      netDue: row.due,
      walletBalance,
      mealCostDue,
      unpaidLiabilities,
      maxRefundable,
      minRefundable: canRefund ? 1 : 0,
      canRefund,
      foodExcess,
      hasFoodExcessNotDeposited: foodExcess > 0,
      mealCost: row.mealCost,
      foodPurchases: row.foodPurchases,
      mealFoodDiff: Math.round(row.foodPurchases - row.mealCost),
      expensePaid: row.expensePaid,
      expenseUnpaid: row.expenseUnpaid,
      deposits: row.deposits,
      refunds: row.refunds,
      carriedOverBalance: row.carriedOverBalance,
      charge: row.charge,
    };
  },

  /**
   * POST /refunds/validate — dry-run a proposed refund amount.
   * Returns whether it is valid, boundary errors, and the projected wallet outcome.
   * Read-only — does NOT mutate anything.
   */
  async validate(
    homeId: Types.ObjectId,
    data: { membershipId: string; amount: number; date: string },
  ) {
    const cycle = cycleFromDateKey(data.date);
    const dues = await dueService.compute(homeId, cycle);
    const row = dues.members.find((m) => m.membershipId === data.membershipId);

    if (!row) {
      return {
        valid: false,
        error: 'Member not found for this cycle.',
        walletBalance: 0,
        mealCostDue: 0,
        maxRefundable: 0,
        walletAfter: 0,
        refundAmount: data.amount,
      };
    }

    const walletBalance = row.walletBalance;
    const foodCredit = Math.max(0, row.foodPurchases);
    const mealCostDue = Math.max(0, row.mealCost - foodCredit);
    const unpaidLiabilities = Math.max(0, (row.mealCost + row.expenseUnpaid) - foodCredit);
    const maxRefundable = Math.max(0, Math.round(walletBalance - unpaidLiabilities));
    const refundAmount = Math.round(data.amount);

    if (walletBalance <= 0) {
      return {
        valid: false,
        error: 'Member has no advance balance in wallet. Food purchase surplus can only be refunded after month-end close when deposited to wallet.',
        walletBalance,
        mealCostDue,
        maxRefundable: 0,
        walletAfter: walletBalance,
        refundAmount,
      };
    }

    if (maxRefundable <= 0) {
      return {
        valid: false,
        error: `Wallet balance (৳${walletBalance}) is required to cover meal cost due (৳${mealCostDue}) and liabilities.`,
        walletBalance,
        mealCostDue,
        maxRefundable: 0,
        walletAfter: walletBalance,
        refundAmount,
      };
    }

    if (refundAmount <= 0) {
      return {
        valid: false,
        error: 'Refund amount must be greater than zero.',
        walletBalance,
        mealCostDue,
        maxRefundable,
        walletAfter: walletBalance,
        refundAmount,
      };
    }

    if (refundAmount > maxRefundable) {
      return {
        valid: false,
        error: `Refund amount (৳${refundAmount}) exceeds maximum refundable wallet advance (৳${maxRefundable} = Wallet ৳${walletBalance} − Meal Cost Due ৳${mealCostDue}).`,
        walletBalance,
        mealCostDue,
        maxRefundable,
        walletAfter: walletBalance,
        refundAmount,
      };
    }

    const walletAfter = Math.max(0, walletBalance - refundAmount);

    return {
      valid: true,
      error: null,
      walletBalance,
      mealCostDue,
      maxRefundable,
      walletAfter,
      refundAmount,
      isFullWalletRefund: refundAmount === maxRefundable,
    };
  },
};

