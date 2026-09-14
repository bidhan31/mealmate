import mongoose, { Document, Schema, Types } from 'mongoose';
import { DepositType } from '../../config/enums';

export interface IDeposit extends Document {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  membershipId: Types.ObjectId; // whose wallet is credited
  amount: number; // BDT (always positive)
  depositType: DepositType;
  walletTxnId?: Types.ObjectId | null; // the CREDIT ledger entry this deposit created
  date: string; // YYYY-MM-DD
  cycle: string; // YYYY-MM
  createdBy: Types.ObjectId; // admin who recorded it
  createdAt: Date;
  updatedAt: Date;
}

const depositSchema = new Schema<IDeposit>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    depositType: { type: String, enum: Object.values(DepositType), default: DepositType.Cash },
    walletTxnId: { type: Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
    date: { type: String, required: true, index: true },
    cycle: { type: String, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Membership', required: true },
  },
  { timestamps: true },
);

export const Deposit = mongoose.model<IDeposit>('Deposit', depositSchema);
