import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { roomService } from './room.service';

export const roomController = {
  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await roomService.list(req.membership!.homeId);
    sendSuccess(res, result, 'Rooms');
  }),

  create: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await roomService.create(req.membership!.homeId, req.body.name, req.body.totalRent);
    sendSuccess(res, result, 'Room created', 201);
  }),

  update: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await roomService.update(req.membership!.homeId, req.params.id, req.body);
    sendSuccess(res, result, 'Room updated');
  }),

  remove: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await roomService.remove(req.membership!.homeId, req.params.id);
    sendSuccess(res, result, result.message);
  }),

  assign: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await roomService.assignMember(
      req.membership!.homeId,
      req.body.membershipId,
      req.body.roomId,
    );
    sendSuccess(res, result, result.message);
  }),
};
