import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { auditLogService } from './auditLog.service';

export const auditLogController = {
  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const skip = Number(req.query.skip ?? 0);
    const action = req.query.action as string | undefined;
    const result = await auditLogService.list(homeId, { limit, skip, action });
    sendSuccess(res, result, 'Audit log');
  }),
};
