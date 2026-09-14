import mongoose, { Document, Schema, Types } from 'mongoose';
import { DepositType } from '../../config/enums';

export interface IRefund extends Document {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  membershipId: Types.ObjectId; // whose wallet is debited (cash paid out)
  amount: number; // BDT (always positive)
  paymentMethod: DepositType;
  walletTxnId?: Types.ObjectId | null; // the DEBIT ledger entry this refund created
  date: string; // YYYY-MM-DD
  cycle: string; // YYYY-MM
  note?: string;
  createdBy: Types.ObjectId; // admin who recorded it
  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<IRefund>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: Object.values(DepositType), default: DepositType.Cash },
    walletTxnId: { type: Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
    date: { type: String, required: true, index: true },
    cycle: { type: String, required: true, index: true },
    note: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Membership', required: true },
  },
  { timestamps: true },
);

export const Refund = mongoose.model<IRefund>('Refund', refundSchema);
