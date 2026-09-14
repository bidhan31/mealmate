import mongoose, { Document, Schema, Types } from 'mongoose';
import { MealSlot, MembershipStatus, Role } from '../../config/enums';

/** A member's self-imposed meal-slot turn-off window (inclusive date range). */
export interface IMemberDisabledSlot {
  _id?: Types.ObjectId;
  slot: MealSlot;
  from: string; // YYYY-MM-DD (inclusive)
  to: string; // YYYY-MM-DD (inclusive)
}

export interface IMembership extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  homeId: Types.ObjectId;
  role: Role;
  status: MembershipStatus;
  roomId?: Types.ObjectId | null;
  joinedAt?: Date | null;
  disabledSlots: IMemberDisabledSlot[]; // member self turn-off windows
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<IMembership>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    role: { type: String, enum: Object.values(Role), default: Role.Member },
    status: {
      type: String,
      enum: Object.values(MembershipStatus),
      default: MembershipStatus.Pending,
      index: true,
    },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
    joinedAt: { type: Date, default: null },
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

// A user can have at most one membership record per home.
membershipSchema.index({ userId: 1, homeId: 1 }, { unique: true });

export const Membership = mongoose.model<IMembership>('Membership', membershipSchema);
