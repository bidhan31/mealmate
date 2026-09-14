import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { notificationService } from './notification.service';

export const notificationController = {
  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const userId = new Types.ObjectId(req.user!.id);
    const homeId = req.membership!.homeId;
    const result = await notificationService.listForUser(userId, homeId);
    sendSuccess(res, result, 'Notifications');
  }),

  markRead: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const userId = new Types.ObjectId(req.user!.id);
    await notificationService.markRead(req.params.id, userId);
    sendSuccess(res, null, 'Notification marked as read');
  }),

  markAllRead: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const userId = new Types.ObjectId(req.user!.id);
    const homeId = req.membership!.homeId;
    await notificationService.markAllRead(userId, homeId);
    sendSuccess(res, null, 'All notifications marked as read');
  }),

  // ── Notification Preferences ─────────────────────────────────────────────────

  getPrefs: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const userId = new Types.ObjectId(req.user!.id);
    const prefs = await notificationService.getUserPrefs(userId);
    sendSuccess(res, { prefs }, 'Notification preferences');
  }),

  updatePrefs: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const userId = new Types.ObjectId(req.user!.id);
    const updates = req.body as Record<string, boolean>;

    if (typeof updates !== 'object' || Array.isArray(updates)) {
      res.status(400).json({ code: 400, message: 'Body must be an object of { notificationType: boolean }' });
      return;
    }

    const prefs = await notificationService.updateUserPrefs(userId, updates);
    sendSuccess(res, { prefs }, 'Notification preferences updated');
  }),
};
