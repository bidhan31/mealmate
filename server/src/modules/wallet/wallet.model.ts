import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * A member's persistent, global wallet. One per membership.
 * `balance` is a cached value that is ONLY ever mutated inside a transaction
 * alongside an append-only WalletTransaction entry, so it can never desync.
 */
export interface IWallet extends Document {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  membershipId: Types.ObjectId;
  balance: number; // BDT, cached running balance (>= 0 always)
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    membershipId: {
      type: Schema.Types.ObjectId,
      ref: 'Membership',
      required: true,
      unique: true,
      index: true,
    },
    balance: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);
