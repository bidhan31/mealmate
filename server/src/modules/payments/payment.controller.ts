import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { PaymentStatus, Role } from '../../config/enums';
import { User } from '../users/user.model';
import { paymentService } from './payment.service';

async function actorFrom(req: HomeScopedRequest) {
  const actor = await User.findById(req.user!.id).select('name').lean();
  return {
    id: req.membership!._id,
    userId: req.membership!.userId,
    name: actor?.name ?? 'Admin',
  };
}

export const paymentController = {
  /** List/filter payments. Members are scoped to their own; admin sees all. */
  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    const isAdmin = req.membership!.role === Role.Admin;
    const membershipId = isAdmin
      ? (req.query.membershipId as string | undefined)
      : req.membership!._id.toString();
    const result = await paymentService.list(homeId, {
      cycle: req.query.cycle as string | undefined,
      membershipId,
      status: req.query.status as PaymentStatus | undefined,
    });
    sendSuccess(res, result, 'Payments');
  }),

  /** Reverse a paid payment (admin only). */
  reverse: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    const result = await paymentService.reverse(
      homeId,
      await actorFrom(req),
      req.params.id,
      req.body?.reason,
    );
    sendSuccess(res, result, 'Payment reversed');
  }),
};
