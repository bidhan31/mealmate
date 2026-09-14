import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { User } from '../users/user.model';
import { refundService } from './refund.service';
import { cycleFromDateKey } from '../../utils/dates';

async function actorFrom(req: HomeScopedRequest) {
  const actor = await User.findById(req.user!.id).select('name').lean();
  return {
    id: req.membership!._id,
    userId: req.membership!.userId,
    name: actor?.name ?? 'Admin',
  };
}

export const refundController = {
  create: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await refundService.create(
      req.membership!.homeId,
      await actorFrom(req),
      req.body,
    );
    sendSuccess(res, result, 'Refund recorded', 201);
  }),

  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await refundService.list(req.membership!.homeId, req.query.cycle as string | undefined);
    sendSuccess(res, result, 'Refunds');
  }),

  remove: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await refundService.remove(
      req.membership!.homeId,
      await actorFrom(req),
      req.params.id,
    );
    sendSuccess(res, result, result.message);
  }),

  /**
   * GET /refunds/preview?membershipId=&cycle=
   * Live read-only settlement snapshot — no mutation.
   */
  preview: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const { membershipId, cycle } = req.query as { membershipId: string; cycle: string };
    const result = await refundService.preview(req.membership!.homeId, membershipId, cycle);
    sendSuccess(res, result, 'Refund preview');
  }),

  /**
   * POST /refunds/validate
   * Dry-run: validates a proposed refund amount and returns projected outcome.
   * No mutation. Safe to call on every keystroke.
   */
  validate: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const { membershipId, amount, date } = req.body as {
      membershipId: string;
      amount: number;
      date: string;
    };
    // Derive cycle from date if not provided
    const cycle = cycleFromDateKey(date);
    const result = await refundService.validate(req.membership!.homeId, { membershipId, amount, date });
    void cycle; // used only for context
    sendSuccess(res, result, 'Refund validation');
  }),
};
