import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { withTransaction } from '../../utils/transaction';
import { ExpenseStatus, NotificationType, PaymentStatus, WalletTxnSource } from '../../config/enums';
import { Expense } from '../expenses/expense.model';
import { monthEndService } from '../monthEnd/monthEnd.service';
import { walletService } from '../wallet/wallet.service';
import { auditLogService } from '../auditLog/auditLog.service';
import { Payment } from './payment.model';
import { Membership } from '../memberships/membership.model';
import { notificationService } from '../notifications/notification.service';

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Actor {
  id: Types.ObjectId; // admin membership id
  userId: Types.ObjectId;
  name: string;
}

export const paymentService = {
  /**
   * Pay a specific expense instance from the owner's wallet.
   *  - Sufficient funds  → DEBIT wallet, expense.status = paid, Payment(paid).
   *  - Insufficient funds → no wallet movement, expense stays unpaid, Payment(rejected).
   * Idempotency & double-pay are prevented by the partial unique index + explicit guard.
   */
  async payExpense(homeId: Types.ObjectId, actor: Actor, expenseId: string) {
    const result = await withTransaction(async (session) => {
      const expense = await Expense.findOne({
        _id: new Types.ObjectId(expenseId),
        homeId,
      }).session(session);
      if (!expense) throw ApiError.notFound('Expense not found');
      if (!expense.for) {
        throw ApiError.badRequest('This expense is not assigned to a specific member and cannot be paid');
      }

      await monthEndService.assertCycleIsOpen(homeId, expense.cycle);

      if (expense.status === ExpenseStatus.Paid) {
        throw ApiError.conflict('Expense is already paid');
      }

      const memberId = expense.for as Types.ObjectId;
      const amount = money(expense.amount);

      if (amount <= 0) {
        throw ApiError.badRequest('Expense amount must be positive to record a payment');
      }

      const canAfford = await walletService.canAfford(memberId, amount);

      if (!canAfford) {
        const balance = await walletService.balanceOf(memberId);
        // Record a rejected payment for audit; no wallet movement, expense stays unpaid.
        const [rejected] = await Payment.create(
          [
            {
              homeId,
              membershipId: memberId,
              expenseId: expense._id,
              amount,
              cycle: expense.cycle,
              purpose: expense.purpose,
              status: PaymentStatus.Rejected,
              reason: `Insufficient wallet balance (available ৳${balance}, required ৳${amount})`,
              createdBy: actor.id,
            },
          ],
          { session },
        );
        return { payment: rejected, expense, rejected: true, balance };
      }

      // Create the payment record first so the ledger entry can reference it.
      const [paid] = await Payment.create(
        [
          {
            homeId,
            membershipId: memberId,
            expenseId: expense._id,
            amount,
            cycle: expense.cycle,
            purpose: expense.purpose,
            status: PaymentStatus.Paid,
            createdBy: actor.id,
          },
        ],
        { session },
      );

      // Debit wallet + record ledger entry (throws if a race made it insufficient).
      const { txn } = await walletService.debit(session, {
        homeId,
        membershipId: memberId,
        amount,
        source: WalletTxnSource.Payment,
        createdBy: actor.id,
        refModel: 'Payment',
        refId: paid._id,
        note: `Payment for ${expense.purpose}`,
      });

      paid.walletTxnId = txn._id;
      await paid.save({ session });

      expense.status = ExpenseStatus.Paid;
      expense.paymentId = paid._id;
      await expense.save({ session });

      return { payment: paid, expense, rejected: false, balance: 0 };
    });

    auditLogService
      .log({
        homeId,
        actorUserId: actor.userId,
        actorName: actor.name,
        action: result.rejected ? 'PAYMENT_REJECTED' : 'PAYMENT_PAID',
        targetModel: 'Payment',
        targetId: result.payment._id.toString(),
        after: {
          membershipId: result.payment.membershipId.toString(),
          expenseId: expenseId,
          amount: result.payment.amount,
          purpose: result.payment.purpose,
          status: result.payment.status,
          reason: result.payment.reason,
        },
      })
      .catch(() => {});

    // Notify ONLY the respected target member
    Membership.findById(result.payment.membershipId)
      .then((m) => {
        if (m) {
          notificationService.create({
            userId: m.userId as Types.ObjectId,
            homeId,
            type: NotificationType.ExpenseStatusChanged,
            message: result.rejected
              ? `Payment attempt of BDT ${result.payment.amount} for "${result.payment.purpose}" failed due to insufficient wallet funds.`
              : `Expense payment of BDT ${result.payment.amount} for "${result.payment.purpose}" was completed.`,
            meta: { expenseId, amount: result.payment.amount, status: result.payment.status },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return result;
  },

  /**
   * Reverse a PAID payment: refund the wallet (compensating CREDIT), mark payment reversed,
   * reopen the expense to unpaid. Admin only.
   */
  async reverse(homeId: Types.ObjectId, actor: Actor, paymentId: string, reason?: string) {
    const result = await withTransaction(async (session) => {
      const payment = await Payment.findOne({
        _id: new Types.ObjectId(paymentId),
        homeId,
      }).session(session);
      if (!payment) throw ApiError.notFound('Payment not found');
      if (payment.status !== PaymentStatus.Paid) {
        throw ApiError.badRequest(`Only paid payments can be reversed (current: ${payment.status})`);
      }

      await monthEndService.assertCycleIsOpen(homeId, payment.cycle);

      // Refund the wallet.
      const { txn } = await walletService.credit(session, {
        homeId,
        membershipId: payment.membershipId,
        amount: payment.amount,
        source: WalletTxnSource.Reversal,
        createdBy: actor.id,
        refModel: 'Payment',
        refId: payment._id,
        note: `Reversal of payment for ${payment.purpose}`,
      });

      payment.status = PaymentStatus.Reversed;
      payment.reason = reason ?? 'Reversed by admin';
      payment.reversalTxnId = txn._id;
      payment.reversedBy = actor.id;
      payment.reversedAt = new Date();
      await payment.save({ session });

      // Reopen the expense.
      const expense = await Expense.findOne({ _id: payment.expenseId, homeId }).session(session);
      if (expense) {
        expense.status = ExpenseStatus.Unpaid;
        expense.paymentId = null;
        await expense.save({ session });
      }

      return { payment, expense };
    });

    auditLogService
      .log({
        homeId,
        actorUserId: actor.userId,
        actorName: actor.name,
        action: 'PAYMENT_REVERSED',
        targetModel: 'Payment',
        targetId: paymentId,
        after: {
          membershipId: result.payment.membershipId.toString(),
          amount: result.payment.amount,
          purpose: result.payment.purpose,
          reason: result.payment.reason,
        },
      })
      .catch(() => {});

    // Notify ONLY the respected target member
    Membership.findById(result.payment.membershipId)
      .then((m) => {
        if (m) {
          notificationService.create({
            userId: m.userId as Types.ObjectId,
            homeId,
            type: NotificationType.ExpenseStatusChanged,
            message: `Payment of BDT ${result.payment.amount} for "${result.payment.purpose}" was reversed by Admin.`,
            meta: { paymentId, amount: result.payment.amount, status: 'reversed' },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return result;
  },

  /** List payments in a home, optionally filtered by cycle / member / status. */
  async list(
    homeId: Types.ObjectId,
    opts: { cycle?: string; membershipId?: string; status?: PaymentStatus } = {},
  ) {
    const filter: Record<string, unknown> = { homeId };
    if (opts.cycle) filter.cycle = opts.cycle;
    if (opts.membershipId) filter.membershipId = new Types.ObjectId(opts.membershipId);
    if (opts.status) filter.status = opts.status;

    const payments = await Payment.find(filter)
      .populate({ path: 'membershipId', select: 'userId', populate: { path: 'userId', select: 'name' } })
      .sort({ createdAt: -1 })
      .lean();

    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.Paid)
      .reduce((s, p) => s + p.amount, 0);

    return { totalPaid, payments };
  },
};
