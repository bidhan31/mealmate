import mongoose, { Document, Schema, Types } from 'mongoose';
import { ExpenseCategory, MealSlot } from '../../config/enums';

export interface IMealSettings {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

/** A home-wide meal-slot disable window set by the admin (inclusive date range). */
export interface IDisabledSlot {
  slot: MealSlot;
  from: string; // YYYY-MM-DD (inclusive)
  to: string; // YYYY-MM-DD (inclusive)
}

export interface IHome extends Document {
  _id: Types.ObjectId;
  name: string;
  adminUserId: Types.ObjectId;
  mealSettings: IMealSettings;
  currentCycle: string; // YYYY-MM
  timezone: string;
  descoAccountNo?: string | null;
  inviteCode: string;
  expenseTypes: {
    name: string;
    category: ExpenseCategory;
    defaultAmount: number;
  }[];
  closedMealDates: string[]; // YYYY-MM-DD
  disabledSlots: IDisabledSlot[]; // home-wide slot disable windows (admin)
  createdAt: Date;
  updatedAt: Date;
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const homeSchema = new Schema<IHome>(
  {
    name: { type: String, required: true, trim: true },
    adminUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mealSettings: {
      breakfast: { type: Boolean, default: true },
      lunch: { type: Boolean, default: true },
      dinner: { type: Boolean, default: true },
    },
    currentCycle: { type: String, default: currentYearMonth },
    timezone: { type: String, default: 'Asia/Dhaka' },
    descoAccountNo: { type: String, trim: true, default: '' },
    inviteCode: { type: String, required: true, unique: true, index: true },
    expenseTypes: [
      {
        name: { type: String, required: true },
        category: { type: String, enum: Object.values(ExpenseCategory), required: true },
        defaultAmount: { type: Number, required: true },
      },
    ],
    closedMealDates: { type: [String], default: [] },
    disabledSlots: {
      type: [
        {
          slot: { type: String, enum: Object.values(MealSlot), required: true },
          from: { type: String, required: true },
          to: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export const Home = mongoose.model<IHome>('Home', homeSchema);
export { currentYearMonth };
