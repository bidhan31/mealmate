import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { User } from '../users/user.model';
import { depositService } from './deposit.service';

async function actorFrom(req: HomeScopedRequest) {
  const actor = await User.findById(req.user!.id).select('name').lean();
  return {
    id: req.membership!._id,
    userId: req.membership!.userId,
    name: actor?.name ?? 'Admin',
  };
}

export const depositController = {
  create: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await depositService.create(
      req.membership!.homeId,
      await actorFrom(req),
      req.body,
    );
    sendSuccess(res, result, 'Deposit recorded', 201);
  }),

  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await depositService.list(req.membership!.homeId, req.query.cycle as string | undefined);
    sendSuccess(res, result, 'Deposits');
  }),

  remove: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await depositService.remove(
      req.membership!.homeId,
      await actorFrom(req),
      req.params.id,
    );
    sendSuccess(res, result, result.message);
  }),
};
