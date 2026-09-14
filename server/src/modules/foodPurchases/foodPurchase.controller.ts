import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { foodPurchaseService } from './foodPurchase.service';
import { Role } from '../../config/enums';

export const foodPurchaseController = {
  create: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const isAdmin = req.membership!.role === Role.Admin;
    const result = await foodPurchaseService.create(
      req.membership!.homeId,
      req.membership!._id,
      req.body,
      isAdmin,
    );
    const msg = isAdmin
      ? 'Food purchase recorded and approved'
      : 'Food purchase request submitted for Admin review';
    sendSuccess(res, result, msg, 201);
  }),

  review: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await foodPurchaseService.review(
      req.membership!.homeId,
      req.membership!._id,
      req.params.id,
      req.body.status,
    );
    sendSuccess(res, result, `Food purchase request ${req.body.status}`);
  }),

  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await foodPurchaseService.list(
      req.membership!.homeId,
      req.query.cycle as string | undefined,
      req.query.status as string | undefined,
    );
    sendSuccess(res, result, 'Food purchases');
  }),

  remove: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await foodPurchaseService.remove(req.membership!.homeId, req.params.id);
    sendSuccess(res, result, result.message);
  }),
};
