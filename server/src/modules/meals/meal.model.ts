import mongoose, { Document, Schema, Types } from 'mongoose';
import { GuestMealStatus, MealSlot, MealType } from '../../config/enums';

export interface IMealSlots {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

export interface IMeal extends Document {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  membershipId: Types.ObjectId; // whose meal count this contributes to
  date: string; // YYYY-MM-DD (home timezone)
  cycle: string; // YYYY-MM
  type: MealType;
  slots: IMealSlots; // per-slot state (normal meals only)
  count: number; // DERIVED effective count = enabled slots (normal) or guest count
  slot?: MealSlot; // which meal slot the guest meal is for (guest meals only)
  guestStatus?: GuestMealStatus; // only for guest meals
  requestedByMembershipId?: Types.ObjectId | null; // who requested the guest meal
  note?: string;
  createdBy: Types.ObjectId; // membership that created the record
  createdAt: Date;
  updatedAt: Date;
}

const mealSchema = new Schema<IMeal>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
    date: { type: String, required: true, index: true },
    cycle: { type: String, required: true, index: true },
    type: { type: String, enum: Object.values(MealType), default: MealType.Normal },
    slots: {
      breakfast: { type: Boolean, default: false },
      lunch: { type: Boolean, default: false },
      dinner: { type: Boolean, default: false },
    },
    count: { type: Number, required: true, min: 0, default: 0 },
    slot: { type: String, enum: Object.values(MealSlot) },
    guestStatus: { type: String, enum: Object.values(GuestMealStatus) },
    requestedByMembershipId: { type: Schema.Types.ObjectId, ref: 'Membership', default: null },
    note: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Membership', required: true },
  },
  { timestamps: true },
);

// One NORMAL meal record per member per day. Guest meals are separate rows.
mealSchema.index(
  { homeId: 1, membershipId: 1, date: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: MealType.Normal } },
);

export const Meal = mongoose.model<IMeal>('Meal', mealSchema);
