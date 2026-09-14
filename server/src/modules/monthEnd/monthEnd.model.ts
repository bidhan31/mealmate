import mongoose, { Document, Schema, Types } from 'mongoose';
import { CycleStatus } from '../../config/enums';

export interface IMonthCycleTotals {
  meals: number;
  foodPurchases: number;
  expenses: number;
  fixedExpenses: number;
  deposits: number;
  totalCharge: number;
  totalCredit: number;
  totalDue: number;
}

export interface IMonthCycleMemberSnapshot {
  membershipId: string;
  userName: string;
  due: number;         // positive = owes, negative = advance
  carriedOver: number; // amount carried from a prior unpaid cycle
}

export interface IMonthCycle extends Document {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  cycle: string; // YYYY-MM
  status: CycleStatus;
  mealRate: number;
  totals: IMonthCycleTotals;
  memberSnapshot: IMonthCycleMemberSnapshot[];
  closedBy?: Types.ObjectId;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const monthCycleSchema = new Schema<IMonthCycle>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    cycle: { type: String, required: true },
    status: { type: String, enum: Object.values(CycleStatus), default: CycleStatus.Open },
    mealRate: { type: Number, default: 0 },
    totals: {
      meals: { type: Number, default: 0 },
      foodPurchases: { type: Number, default: 0 },
      expenses: { type: Number, default: 0 },
      fixedExpenses: { type: Number, default: 0 },
      deposits: { type: Number, default: 0 },
      totalCharge: { type: Number, default: 0 },
      totalCredit: { type: Number, default: 0 },
      totalDue: { type: Number, default: 0 },
    },
    memberSnapshot: [
      {
        membershipId: { type: String, required: true },
        userName: { type: String, required: true },
        due: { type: Number, required: true },
        carriedOver: { type: Number, default: 0 },
      },
    ],
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date },
  },
  { timestamps: true },
);

// One record per home per cycle
monthCycleSchema.index({ homeId: 1, cycle: 1 }, { unique: true });

export const MonthCycle = mongoose.model<IMonthCycle>('MonthCycle', monthCycleSchema);
