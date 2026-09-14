import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { dashboardService } from './dashboard.service';
import { mealService } from '../meals/meal.service';
import { cycleFromDateKey } from '../../utils/dates';
import { User } from '../users/user.model';

export const dashboardController = {
  summary: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    const today = await mealService.todayForHome(homeId);
    const cycle = (req.query.cycle as string | undefined) ?? cycleFromDateKey(today);
    const result = await dashboardService.summary(homeId, today, cycle);
    sendSuccess(res, result, 'Dashboard summary');
  }),

  markPaid: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    const { expenseId, isPaid } = req.body;

    const user = await User.findById(req.user!.id).select('name').lean();
    const actor = {
      id: req.membership!._id,
      userId: req.membership!.userId,
      name: user?.name ?? 'Admin',
    };

    const result = await dashboardService.markPaid(homeId, actor, expenseId, isPaid);
    const message = result.rejected
      ? 'Payment rejected: insufficient wallet balance'
      : 'Payment status updated';
    sendSuccess(res, result, message);
  }),
};
