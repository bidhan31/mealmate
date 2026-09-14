import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  homeId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  actorName: string;
  action: string; // e.g. 'CLOSE_MONTH', 'DELETE_EXPENSE', 'APPROVE_MEMBER'
  targetModel: string; // e.g. 'Expense', 'Membership', 'MonthCycle'
  targetId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetModel: { type: String, required: true },
    targetId: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
