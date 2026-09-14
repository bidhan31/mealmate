import { Types } from 'mongoose';
import { AuditLog } from './auditLog.model';
import { NotificationType } from '../../config/enums';
import { Membership } from '../memberships/membership.model';
import { notificationService } from '../notifications/notification.service';

export interface AuditLogPayload {
  homeId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  actorName: string;
  action: string;
  targetModel: string;
  targetId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export const auditLogService = {
  /** Record an admin action. Fire-and-forget safe — errors are swallowed so they never block the main flow. */
  async log(payload: AuditLogPayload): Promise<void> {
    await AuditLog.create(payload);

    const privateFinancialActions = [
      'DEPOSIT_CREATE',
      'DEPOSIT_DELETE',
      'PAYMENT_PAID',
      'PAYMENT_REJECTED',
      'PAYMENT_REVERSED',
    ];

    // Financial actions must NEVER be broadcast to all home members.
    if (privateFinancialActions.includes(payload.action)) {
      const targetMembershipId = (payload.after?.membershipId || payload.before?.membershipId) as string | undefined;
      if (targetMembershipId) {
        Membership.findById(targetMembershipId)
          .then((m) => {
            if (m && m.userId.toString() !== payload.actorUserId.toString()) {
              notificationService.create({
                userId: m.userId as Types.ObjectId,
                homeId: payload.homeId,
                type: NotificationType.AdminOverride,
                message: `Admin ${payload.actorName} performed action: ${payload.action} on your account.`,
                meta: { action: payload.action, targetModel: payload.targetModel },
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }
      return;
    }

    // Non-financial home-wide administrative actions can be broadcast to active members
    Membership.find({ homeId: payload.homeId, userId: { $ne: payload.actorUserId } })
      .distinct('userId')
      .then((memberUserIds) => {
        if (memberUserIds.length) {
          notificationService.createForHomeMembers(
            memberUserIds as Types.ObjectId[],
            payload.homeId,
            NotificationType.AdminOverride,
            `Admin ${payload.actorName} performed action: ${payload.action} on ${payload.targetModel}.`,
            { action: payload.action, targetModel: payload.targetModel },
          ).catch(() => {});
        }
      })
      .catch(() => {});
  },

  async list(
    homeId: Types.ObjectId,
    opts: { limit?: number; skip?: number; action?: string } = {},
  ) {
    const filter: Record<string, unknown> = { homeId };
    if (opts.action) filter.action = opts.action;

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(opts.skip ?? 0)
      .limit(opts.limit ?? 50)
      .lean();

    return {
      total,
      logs: logs.map((l) => ({
        id: l._id.toString(),
        actorName: l.actorName,
        action: l.action,
        targetModel: l.targetModel,
        targetId: l.targetId,
        before: l.before ?? null,
        after: l.after ?? null,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  },
};
