import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRoom extends Document {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  name: string;
  totalRent: number; // BDT, split across members assigned to the room
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    name: { type: String, required: true, trim: true },
    totalRent: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

roomSchema.index({ homeId: 1, name: 1 }, { unique: true });

export const Room = mongoose.model<IRoom>('Room', roomSchema);
