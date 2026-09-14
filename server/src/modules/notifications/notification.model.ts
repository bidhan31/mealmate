import mongoose, { Document, Schema, Types } from 'mongoose';
import { NotificationType } from '../../config/enums';

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  homeId: Types.ObjectId;
  type: NotificationType;
  message: string;
  read: boolean;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Index for efficient per-user unread count
notificationSchema.index({ userId: 1, homeId: 1, read: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
