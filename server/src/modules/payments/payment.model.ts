import mongoose, { Document, Schema, Types } from 'mongoose';
import { PaymentStatus } from '../../config/enums';

/**
 * A payment attempt against a SPECIFIC expense instance.
 * Created only via the dashboard mark-paid flow.
 *  - paid:     wallet was debited, expense marked paid
 *  - rejected: attempt failed (e.g. insufficient funds); recorded for audit, no wallet movement
 *  - reversed: a previously-paid payment was undone; wallet refunded, expense reopened
 *
 * At most ONE active (paid) payment may exist per expense — enforced by a partial unique index.
 */
export interface IPayment extends Document {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  membershipId: Types.ObjectId; // the member whose expense is being paid
  expenseId: Types.ObjectId;
  amount: number; // BDT
  cycle: string; // YYYY-MM (copied from the expense)
  purpose: string; // copied from the expense at pay-time (why this payment was made)
  status: PaymentStatus;
  reason?: string; // populated for rejected / reversed
  walletTxnId?: Types.ObjectId | null; // debit entry (paid) — refund entry recorded separately
  reversalTxnId?: Types.ObjectId | null; // credit entry created on reversal
  createdBy: Types.ObjectId; // admin who triggered it
  reversedBy?: Types.ObjectId | null;
  reversedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
    expenseId: { type: Schema.Types.ObjectId, ref: 'Expense', required: true },
    amount: { type: Number, required: true, min: 0 },
    cycle: { type: String, required: true, index: true },
    purpose: { type: String, required: true },
    status: { type: String, enum: Object.values(PaymentStatus), required: true },
    reason: { type: String },
    walletTxnId: { type: Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
    reversalTxnId: { type: Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Membership', required: true },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'Membership', default: null },
    reversedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Guarantee: only one PAID payment can exist per expense at any time.
paymentSchema.index(
  { expenseId: 1 },
  { unique: true, partialFilterExpression: { status: PaymentStatus.Paid } },
);

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
