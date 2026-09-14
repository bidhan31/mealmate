import { Types } from 'mongoose';
import { NotificationType } from '../../config/enums';
import { Notification } from './notification.model';
import { User } from '../users/user.model';

/** Returns true if the user wants to receive this notification type. */
async function isOptedIn(userId: Types.ObjectId, type: NotificationType): Promise<boolean> {
  const user = await User.findById(userId).select('notificationPrefs').lean();
  if (!user) return false;
  const prefs = user.notificationPrefs as unknown as Map<string, boolean> | Record<string, boolean> | undefined;
  if (!prefs) return true; // absent map = all on
  // Mongoose lean() returns Map as a plain object
  const val = prefs instanceof Map ? prefs.get(type) : (prefs as Record<string, boolean>)[type];
  return val !== false; // undefined or true => opted in
}

/** Fetch opted-in userIds from a batch for a given notification type (avoids N queries). */
async function filterOptedIn(
  userIds: Types.ObjectId[],
  type: NotificationType,
): Promise<Types.ObjectId[]> {
  if (userIds.length === 0) return [];
  const users = await User.find({ _id: { $in: userIds } })
    .select('_id notificationPrefs')
    .lean();

  return users
    .filter((u) => {
      const prefs = u.notificationPrefs as unknown as Map<string, boolean> | Record<string, boolean> | undefined;
      if (!prefs) return true;
      const val = prefs instanceof Map ? prefs.get(type) : (prefs as Record<string, boolean>)[type];
      return val !== false;
    })
    .map((u) => u._id as Types.ObjectId);
}

export const notificationService = {
  /** Create a single notification for one user — respects their notification preferences. */
  async create(payload: {
    userId: Types.ObjectId;
    homeId: Types.ObjectId;
    type: NotificationType;
    message: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    const optedIn = await isOptedIn(payload.userId, payload.type);
    if (!optedIn) return; // User opted out of this type
    await Notification.create(payload);
  },

  /** Bulk-create the same notification for multiple users — respects individual preferences. */
  async createForHomeMembers(
    memberUserIds: Types.ObjectId[],
    homeId: Types.ObjectId,
    type: NotificationType,
    message: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    if (!memberUserIds.length) return;
    const eligible = await filterOptedIn(memberUserIds, type);
    if (!eligible.length) return;
    await Notification.insertMany(
      eligible.map((userId) => ({ userId, homeId, type, message, meta })),
    );
  },

  async listForUser(userId: Types.ObjectId, homeId: Types.ObjectId) {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId, homeId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Notification.countDocuments({ userId, homeId, read: false }),
    ]);
    return {
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        message: n.message,
        read: n.read,
        meta: n.meta ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  },

  async markRead(id: string, userId: Types.ObjectId): Promise<void> {
    await Notification.updateOne(
      { _id: new Types.ObjectId(id), userId },
      { $set: { read: true } },
    );
  },

  async markAllRead(userId: Types.ObjectId, homeId: Types.ObjectId): Promise<void> {
    await Notification.updateMany(
      { userId, homeId, read: false },
      { $set: { read: true } },
    );
  },

  // ── Notification Preference CRUD ────────────────────────────────────────────

  /**
   * Returns a full prefs object for all known types.
   * Missing keys in the DB map default to `true` (opted-in).
   */
  async getUserPrefs(userId: Types.ObjectId): Promise<Record<string, boolean>> {
    const user = await User.findById(userId).select('notificationPrefs').lean();
    const prefs = user?.notificationPrefs as unknown as Map<string, boolean> | Record<string, boolean> | undefined;

    const all = Object.values(NotificationType) as string[];
    const result: Record<string, boolean> = {};
    for (const type of all) {
      if (!prefs) {
        result[type] = true;
      } else {
        const val = prefs instanceof Map ? prefs.get(type) : (prefs as Record<string, boolean>)[type];
        result[type] = val !== false;
      }
    }
    return result;
  },

  /**
   * Merge-updates user preferences. Only the provided keys are changed.
   * Setting a key to `true` removes it from the map (keeps storage lean).
   */
  async updateUserPrefs(
    userId: Types.ObjectId,
    updates: Partial<Record<string, boolean>>,
  ): Promise<Record<string, boolean>> {
    const validTypes = new Set(Object.values(NotificationType) as string[]);
    const setOps: Record<string, boolean> = {};
    const unsetOps: Record<string, number> = {};

    for (const [key, val] of Object.entries(updates)) {
      if (!validTypes.has(key)) continue;
      if (val === false) {
        setOps[`notificationPrefs.${key}`] = false;
      } else {
        // Opted-in = default; remove the key to keep the map lean
        unsetOps[`notificationPrefs.${key}`] = 1;
      }
    }

    const update: Record<string, unknown> = {};
    if (Object.keys(setOps).length) update['$set'] = setOps;
    if (Object.keys(unsetOps).length) update['$unset'] = unsetOps;

    if (Object.keys(update).length) {
      await User.updateOne({ _id: userId }, update);
    }

    return this.getUserPrefs(userId);
  },
};
