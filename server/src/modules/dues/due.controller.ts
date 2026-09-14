import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { dueService } from './due.service';
import { mealService } from '../meals/meal.service';
import { cycleFromDateKey } from '../../utils/dates';

export const dueController = {
  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    const cycle =
      (req.query.cycle as string | undefined) ??
      cycleFromDateKey(await mealService.todayForHome(homeId));
    const result = await dueService.compute(homeId, cycle);
    sendSuccess(res, result, 'Dues');
  }),
};
