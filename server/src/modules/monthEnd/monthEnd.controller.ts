import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { monthEndService } from './monthEnd.service';
import { mealService } from '../meals/meal.service';
import { cycleFromDateKey } from '../../utils/dates';
import { User } from '../users/user.model';

export const monthEndController = {
  close: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    const today = await mealService.todayForHome(homeId);
    const cycle = (req.body.cycle as string | undefined) ?? cycleFromDateKey(today);

    // Resolve actor name for audit log
    const actor = await User.findById(req.user!.id).select('name').lean();
    const actorName = actor?.name ?? 'Admin';

    const result = await monthEndService.close(homeId, cycle, req.membership!.userId, actorName);
    sendSuccess(res, result, `Month ${cycle} closed successfully`);
  }),

  history: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    const result = await monthEndService.history(homeId);
    sendSuccess(res, result, 'Month-end history');
  }),

  status: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    const today = await mealService.todayForHome(homeId);
    const cycle = (req.query.cycle as string | undefined) ?? cycleFromDateKey(today);
    const result = await monthEndService.currentStatus(homeId, cycle);
    sendSuccess(res, result, 'Cycle status');
  }),
};
