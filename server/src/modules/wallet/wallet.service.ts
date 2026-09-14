import { ClientSession, Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { NotificationType, WalletTxnSource, WalletTxnType } from '../../config/enums';
import { Wallet } from './wallet.model';
import { WalletTransaction } from './walletTransaction.model';
import { Membership } from '../memberships/membership.model';
import { notificationService } from '../notifications/notification.service';

/** Round money to 2 decimals to avoid float drift in the ledger. */
function money(n: number): number {
  return Math.round(n * 100) / 100;
}

interface MoveParams {
  homeId: Types.ObjectId;
  membershipId: Types.ObjectId;
  amount: number;
  source: WalletTxnSource;
  createdBy: Types.ObjectId;
  refModel?: 'Deposit' | 'Payment' | 'Refund' | null;
  refId?: Types.ObjectId | null;
  note?: string;
}

export const walletService = {
  /** Fetch (or lazily create) a member's wallet. Must be given a session when mutating. */
  async getOrCreate(
    homeId: Types.ObjectId,
    membershipId: Types.ObjectId,
    session?: ClientSession,
  ) {
    let wallet = await Wallet.findOne({ membershipId }).session(session ?? null);
    if (!wallet) {
      const created = await Wallet.create(
        [{ homeId, membershipId, balance: 0 }],
        session ? { session } : undefined,
      );
      wallet = created[0];
    }
    return wallet;
  },

  /**
   * Apply a CREDIT (increase balance). Records an append-only ledger entry.
   * MUST run inside a transaction session.
   */
  async credit(session: ClientSession, p: MoveParams) {
    const amount = money(p.amount);
    if (amount <= 0) throw ApiError.badRequest('Credit amount must be positive');

    const wallet = await this.getOrCreate(p.homeId, p.membershipId, session);
    const balanceAfter = money(wallet.balance + amount);
    wallet.balance = balanceAfter;
    await wallet.save({ session });

    const [txn] = await WalletTransaction.create(
      [
        {
          homeId: p.homeId,
          membershipId: p.membershipId,
          walletId: wallet._id,
          type: WalletTxnType.Credit,
          amount,
          balanceAfter,
          source: p.source,
          refModel: p.refModel ?? null,
          refId: p.refId ?? null,
          note: p.note,
          createdBy: p.createdBy,
        },
      ],
      { session },
    );

    Membership.findById(p.membershipId)
      .then((m) => {
        if (m) {
          notificationService.create({
            userId: m.userId as Types.ObjectId,
            homeId: p.homeId,
            type: NotificationType.WalletBalanceUpdated,
            message: `Your wallet was credited with BDT ${amount}. New balance: BDT ${balanceAfter}.`,
            meta: { balance: balanceAfter, amount, type: 'credit' },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return { wallet, txn };
  },

  /**
   * Apply a DEBIT (decrease balance). Throws (insufficient funds) if the wallet
   * cannot cover the amount — the caller decides how to record that.
   * MUST run inside a transaction session.
   */
  async debit(session: ClientSession, p: MoveParams) {
    const amount = money(p.amount);
    if (amount <= 0) throw ApiError.badRequest('Debit amount must be positive');

    const wallet = await this.getOrCreate(p.homeId, p.membershipId, session);
    const isRefundOrReversal =
      p.source === WalletTxnSource.Refund ||
      p.source === WalletTxnSource.Reversal ||
      p.source === WalletTxnSource.Adjustment;

    if (!isRefundOrReversal && money(wallet.balance) < amount) {
      throw ApiError.badRequest(
        `Insufficient wallet balance. Available ৳${money(wallet.balance)}, required ৳${amount}.`,
      );
    }

    const balanceAfter = money(wallet.balance - amount);
    wallet.balance = balanceAfter;
    await wallet.save({ session });

    const [txn] = await WalletTransaction.create(
      [
        {
          homeId: p.homeId,
          membershipId: p.membershipId,
          walletId: wallet._id,
          type: WalletTxnType.Debit,
          amount,
          balanceAfter,
          source: p.source,
          refModel: p.refModel ?? null,
          refId: p.refId ?? null,
          note: p.note,
          createdBy: p.createdBy,
        },
      ],
      { session },
    );

    Membership.findById(p.membershipId)
      .then((m) => {
        if (m) {
          notificationService.create({
            userId: m.userId as Types.ObjectId,
            homeId: p.homeId,
            type: balanceAfter < 200 ? NotificationType.LowWalletBalance : NotificationType.WalletBalanceUpdated,
            message: balanceAfter < 200
              ? `Warning: Your wallet balance is low (BDT ${balanceAfter}).`
              : `Your wallet was debited by BDT ${amount}. New balance: BDT ${balanceAfter}.`,
            meta: { balance: balanceAfter, amount, type: 'debit' },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return { wallet, txn };
  },

  /** True if the member's wallet can currently cover `amount`. */
  async canAfford(membershipId: Types.ObjectId, amount: number): Promise<boolean> {
    const wallet = await Wallet.findOne({ membershipId }).lean();
    return money(wallet?.balance ?? 0) >= money(amount);
  },

  /** Current cached balance for a member (0 if no wallet yet). */
  async balanceOf(membershipId: Types.ObjectId): Promise<number> {
    const wallet = await Wallet.findOne({ membershipId }).lean();
    return money(wallet?.balance ?? 0);
  },

  /** Map of membershipId -> balance for all wallets in a home. */
  async balancesForHome(homeId: Types.ObjectId): Promise<Map<string, number>> {
    const wallets = await Wallet.find({ homeId }).lean();
    const map = new Map<string, number>();
    for (const w of wallets) map.set(w.membershipId.toString(), money(w.balance));
    return map;
  },

  /**
   * Directly set the wallet balance to `targetBalance` (must be >= 0).
   * Records the delta as a single ledger entry (credit if balance goes up, debit if it goes down).
   * MUST run inside a transaction session.
   */
  async setBalance(
    session: ClientSession,
    p: Omit<MoveParams, 'amount'> & { targetBalance: number },
  ) {
    const target = money(p.targetBalance);
    if (target < 0) throw ApiError.badRequest('Wallet balance cannot be set below 0');

    const wallet = await this.getOrCreate(p.homeId, p.membershipId, session);
    const prev = money(wallet.balance);
    const delta = money(Math.abs(target - prev));
    const isCredit = target >= prev;

    wallet.balance = target;
    await wallet.save({ session });

    // Only record a ledger entry if there is actually a change
    if (delta > 0) {
      const [txn] = await WalletTransaction.create(
        [
          {
            homeId: p.homeId,
            membershipId: p.membershipId,
            walletId: wallet._id,
            type: isCredit ? WalletTxnType.Credit : WalletTxnType.Debit,
            amount: delta,
            balanceAfter: target,
            source: p.source,
            refModel: p.refModel ?? null,
            refId: p.refId ?? null,
            note: p.note,
            createdBy: p.createdBy,
          },
        ],
        { session },
      );
      return { wallet, txn };
    }

    return { wallet, txn: null };
  },

  /** Ledger for a member (most recent first). */
  async transactions(homeId: Types.ObjectId, membershipId: Types.ObjectId) {
    const txns = await WalletTransaction.find({ homeId, membershipId })
      .sort({ createdAt: -1 })
      .lean();
    return { transactions: txns };
  },
};
