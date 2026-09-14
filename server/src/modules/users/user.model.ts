import mongoose, { Document, Schema, Types } from 'mongoose';
import { NotificationType } from '../../config/enums';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash?: string;
  name: string;
  avatar?: string;
  phone?: string;
  emailVerified: boolean;
  googleId?: string;
  activeMembershipId?: Types.ObjectId | null;
  // ── App Lock ─────────────────────────────────────────────
  isAppLocked: boolean;
  lockPinHash?: string;       // SHA-256 hex of the PIN (bcrypt-hashed server-side)
  lockTimeoutMin: number;     // 0 = never, otherwise minutes of inactivity
  lockLastActive?: Date;      // updated by /auth/lock-activity
  // ── Notification Preferences ─────────────────────────────
  // Sparse map: missing key = opted-in (true). Explicit false = opted-out.
  notificationPrefs: Map<string, boolean>;
  // ─────────────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, select: false },
    name: { type: String, required: true, trim: true },
    avatar: { type: String },
    phone: { type: String, trim: true },
    emailVerified: { type: Boolean, default: false },
    googleId: { type: String, index: true, sparse: true },
    activeMembershipId: { type: Schema.Types.ObjectId, ref: 'Membership', default: null },
    // App Lock fields — all hidden from toJSON by default
    isAppLocked:   { type: Boolean, default: false },
    lockPinHash:   { type: String, select: false },
    lockTimeoutMin:{ type: Number, default: 5 },
    lockLastActive:{ type: Date },
    // Notification preferences: sparse map, absent key = opted-in
    notificationPrefs: {
      type: Map,
      of: Boolean,
      default: () => new Map<string, boolean>(),
      validate: {
        validator: (m: Map<string, boolean>) => {
          const valid = Object.values(NotificationType) as string[];
          for (const k of m.keys()) {
            if (!valid.includes(k)) return false;
          }
          return true;
        },
        message: 'Invalid notification type key in notificationPrefs',
      },
    },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    delete r.passwordHash;
    delete r.lockPinHash;   // never expose hash to client
    delete r.__v;
    return r;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);
