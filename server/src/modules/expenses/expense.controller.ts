import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { expenseService } from './expense.service';
import { mealService } from '../meals/meal.service';
import { cycleFromDateKey } from '../../utils/dates';

export const expenseController = {
  create: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await expenseService.create(req.membership!.homeId, req.membership!._id, req.body);
    sendSuccess(res, result, 'Expense recorded', 201);
  }),

  initializeRent: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await expenseService.initializeRent(req.membership!.homeId, req.membership!._id, req.body.cycle);
    sendSuccess(res, result, 'Rent initialized', 201);
  }),

  initializeShared: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await expenseService.initializeShared(req.membership!.homeId, req.membership!._id, req.body.cycle, req.body.expenses);
    sendSuccess(res, result, 'Shared expenses initialized', 201);
  }),

  initializeIndividual: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await expenseService.initializeIndividual(req.membership!.homeId, req.membership!._id, req.body.cycle, req.body);
    sendSuccess(res, result, 'Individual expense initialized', 201);
  }),

  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await expenseService.list(
      req.membership!.homeId,
      { membershipId: req.membership!._id, role: req.membership!.role },
      req.query.cycle as string | undefined,
    );
    sendSuccess(res, result, 'Expenses');
  }),

  manage: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    const today = await mealService.todayForHome(homeId);
    const cycle = (req.query.cycle as string | undefined) ?? cycleFromDateKey(today);
    const result = await expenseService.manage(homeId, cycle);
    sendSuccess(res, result, 'Expense management');
  }),

  update: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await expenseService.update(req.membership!.homeId, req.params.id, req.body);
    sendSuccess(res, result, 'Expense updated');
  }),

  remove: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await expenseService.remove(req.membership!.homeId, req.params.id);
    sendSuccess(res, result, result.message);
  }),
};
