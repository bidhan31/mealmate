import mongoose, { Document, Schema, Types } from 'mongoose';
import { ExpenseCategory, ExpenseStatus } from '../../config/enums';

export interface IExpense extends Document {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  for?: Types.ObjectId | null; // optional payer; null = house-level
  purpose: string;
  type: ExpenseCategory;
  amount: number; // BDT
  date: string; // YYYY-MM-DD
  cycle: string; // YYYY-MM
  note?: string;
  status: ExpenseStatus; // unpaid | paid (settled from the member's wallet)
  paymentId?: Types.ObjectId | null; // the active paid Payment, when paid
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    for: { type: Schema.Types.ObjectId, ref: 'Membership', default: null },
    purpose: { type: String, required: true },
    type: { type: String, enum: Object.values(ExpenseCategory), required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true, index: true },
    cycle: { type: String, required: true, index: true },
    note: { type: String },
    status: {
      type: String,
      enum: Object.values(ExpenseStatus),
      default: ExpenseStatus.Unpaid,
      index: true,
    },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Membership', required: true },
  },
  { timestamps: true },
);

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);
