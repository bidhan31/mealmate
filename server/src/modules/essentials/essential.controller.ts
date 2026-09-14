import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { essentialService } from './essential.service';

export const essentialController = {
  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId.toString();
    const items = await essentialService.list(homeId);
    sendSuccess(res, { items }, 'Essentials retrieved successfully');
  }),

  create: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId.toString();
    const userId = req.user!.id;
    const item = await essentialService.create(homeId, userId, req.body);
    sendSuccess(res, { item }, 'Essential item created successfully', 201);
  }),

  update: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId.toString();
    const itemId = req.params.id;
    const item = await essentialService.update(homeId, itemId, req.body);
    if (!item) {
      return sendSuccess(res, null, 'Essential item not found', 404);
    }
    sendSuccess(res, { item }, 'Essential item updated successfully');
  }),

  remove: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId.toString();
    const itemId = req.params.id;
    const success = await essentialService.delete(homeId, itemId);
    if (!success) {
      return sendSuccess(res, null, 'Essential item not found', 404);
    }
    sendSuccess(res, { deleted: true }, 'Essential item deleted successfully');
  }),
};
