import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { AuthedRequest } from '../../middleware/requireAuth';
import { HomeScopedRequest } from '../../middleware/rbac';
import { homeService } from './home.service';

export const homeController = {
  create: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await homeService.createHome(req.user!.id, req.body.name, req.body.timezone);
    sendSuccess(res, result, 'Home created', 201);
  }),

  join: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await homeService.joinByInviteCode(req.user!.id, req.body.inviteCode);
    sendSuccess(res, result, 'Join request submitted', 201);
  }),

  myHome: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await homeService.getMyHome(req.user!.id);
    sendSuccess(res, result, 'My home');
  }),

  cancelJoinRequest: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await homeService.cancelJoinRequest(req.user!.id);
    sendSuccess(res, result, result.message);
  }),

  updateSettings: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await homeService.updateSettings(req.membership!.homeId, req.body);
    sendSuccess(res, result, 'Home settings updated');
  }),

  updateExpenseTypes: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await homeService.updateExpenseTypes(req.membership!.homeId, req.body.expenseTypes);
    sendSuccess(res, result, 'Expense types updated');
  }),

  leave: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await homeService.leaveHome(
      req.user!.id,
      req.membership!._id,
      req.membership!.role,
    );
    sendSuccess(res, result, result.message);
  }),

  listInvitations: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await homeService.listInvitations(req.user!.id);
    sendSuccess(res, result);
  }),

  acceptInvitation: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await homeService.acceptInvitation(req.user!.id, req.params.id);
    console.log('acceptInvitation result:', req.user);
    sendSuccess(res, result, result.message);
  }),

  rejectInvitation: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await homeService.rejectInvitation(req.user!.id, req.params.id);
    sendSuccess(res, result, result.message);
  }),

  regenerateInviteCode: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await homeService.regenerateInviteCode(req.membership!.homeId);
    sendSuccess(res, result, 'Invite code regenerated');
  }),

  exportData: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await homeService.exportHomeData(req.membership!.homeId);
    sendSuccess(res, result, 'Home data exported');
  }),
};
