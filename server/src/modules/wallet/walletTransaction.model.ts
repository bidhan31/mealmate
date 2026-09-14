import mongoose, { Document, Schema, Types } from 'mongoose';
import { WalletTxnSource, WalletTxnType } from '../../config/enums';

/**
 * Append-only ledger. This is the SOURCE OF TRUTH for wallet balances.
 * Entries are never edited or deleted — corrections are made via compensating entries.
 */
export interface IWalletTransaction extends Document {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  membershipId: Types.ObjectId;
  walletId: Types.ObjectId;
  type: WalletTxnType; // credit | debit
  amount: number; // always positive
  balanceAfter: number; // wallet balance immediately after applying this entry
  source: WalletTxnSource; // deposit | payment | reversal | adjustment
  refModel?: 'Deposit' | 'Payment' | 'Refund' | null; // what this entry references
  refId?: Types.ObjectId | null;
  note?: string;
  createdBy: Types.ObjectId; // admin membership id
  createdAt: Date;
  updatedAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    type: { type: String, enum: Object.values(WalletTxnType), required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true },
    source: { type: String, enum: Object.values(WalletTxnSource), required: true },
    refModel: { type: String, enum: ['Deposit', 'Payment', 'Refund', null], default: null },
    refId: { type: Schema.Types.ObjectId, default: null },
    note: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Membership', required: true },
  },
  { timestamps: true },
);

walletTransactionSchema.index({ membershipId: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model<IWalletTransaction>(
  'WalletTransaction',
  walletTransactionSchema,
);
