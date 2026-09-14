import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { MembershipStatus } from '../../config/enums';
import { membershipService } from './membership.service';

export const membershipController = {
  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const status = req.query.status as MembershipStatus | undefined;
    const result = await membershipService.listMembers(req.membership!.homeId, status);
    sendSuccess(res, result, 'Members');
  }),

  approve: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await membershipService.approve(req.membership!.homeId, req.params.id);
    sendSuccess(res, result, result.message);
  }),

  reject: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await membershipService.reject(req.membership!.homeId, req.params.id);
    sendSuccess(res, result, result.message);
  }),

  remove: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await membershipService.remove(
      req.membership!.homeId,
      req.params.id,
      req.user!.id,
    );
    sendSuccess(res, result, result.message);
  }),

  updateRole: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await membershipService.updateRole(
      req.membership!.homeId,
      req.params.id,
      req.body.role,
      req.user!.id,
    );
    sendSuccess(res, result, result.message);
  }),

  invite: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await membershipService.invite(req.membership!.homeId, req.body.email);
    sendSuccess(res, result, result.message);
  }),
};
