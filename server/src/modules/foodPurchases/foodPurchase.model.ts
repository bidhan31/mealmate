import mongoose, { Document, Schema, Types } from 'mongoose';
import { FoodPurchaseStatus } from '../../config/enums';

export interface IFoodPurchaseItem {
  name: string;
  qty: number;
  price: number; // BDT
}

export interface IFoodPurchase extends Document {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  membershipId: Types.ObjectId; // buyer
  items: IFoodPurchaseItem[];
  totalAmount: number; // BDT
  date: string; // YYYY-MM-DD
  cycle: string; // YYYY-MM
  note?: string;
  status: FoodPurchaseStatus;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const foodPurchaseSchema = new Schema<IFoodPurchase>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
    items: [
      {
        name: { type: String, required: true },
        qty: { type: Number, required: true, min: 0 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true, index: true },
    cycle: { type: String, required: true, index: true },
    note: { type: String },
    status: {
      type: String,
      enum: Object.values(FoodPurchaseStatus),
      default: FoodPurchaseStatus.Pending,
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Membership', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const FoodPurchase = mongoose.model<IFoodPurchase>('FoodPurchase', foodPurchaseSchema);
