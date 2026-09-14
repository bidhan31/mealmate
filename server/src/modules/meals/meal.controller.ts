import { Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { GuestMealStatus, MealSlot } from '../../config/enums';
import { currentCycle } from '../../utils/dates';
import { mealService } from './meal.service';

import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';

export const mealController = {
  setMeal: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    let targetMembershipId = req.membership!._id;
    if (req.body.membershipId && req.body.membershipId !== req.membership!._id.toString()) {
      if (req.membership!.role !== 'admin') {
        throw ApiError.forbidden('Only admins can modify other members meals');
      }
      targetMembershipId = new Types.ObjectId(req.body.membershipId);
    }

    const result = await mealService.setSlots(
      req.membership!.homeId,
      targetMembershipId,
      req.body.date,
      req.body.slots,
    );
    sendSuccess(res, result, 'Meal updated');
  }),

  disableSlots: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const { slots, from, to, scope } = req.body as {
      slots: MealSlot[];
      from: string;
      to: string;
      scope: 'self' | 'home';
    };

    if (scope === 'home') {
      if (req.membership!.role !== 'admin') {
        throw ApiError.forbidden('Only admins can turn off meals for the whole home');
      }
      const result = await mealService.disableHomeSlots(
        req.membership!.homeId,
        req.membership!._id,
        slots,
        from,
        to,
      );
      return sendSuccess(res, result, result.message);
    }

    const result = await mealService.disableMemberSlots(
      req.membership!.homeId,
      req.membership!._id,
      slots,
      from,
      to,
    );
    sendSuccess(res, result, result.message);
  }),

  removeHomeWindow: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await mealService.removeHomeSlotWindow(
      req.membership!.homeId,
      req.body.windowId,
    );
    sendSuccess(res, result, result.message);
  }),

  removeMemberWindow: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await mealService.removeMemberSlotWindow(
      req.membership!.homeId,
      req.membership!._id,
      req.body.windowId,
    );
    sendSuccess(res, result, result.message);
  }),

  listByDate: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const date = (req.query.date as string) || (await mealService.todayForHome(req.membership!.homeId));
    const result = await mealService.listByDate(req.membership!.homeId, date);
    sendSuccess(res, result, 'Meals for day');
  }),

  monthly: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const tz = await mealService.getHomeTimezone(req.membership!.homeId);
    const cycle = (req.query.cycle as string) || currentCycle(tz);
    const result = await mealService.monthlySummary(req.membership!.homeId, cycle);
    sendSuccess(res, result, 'Monthly meal summary');
  }),

  monthlyCalendar: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const tz = await mealService.getHomeTimezone(req.membership!.homeId);
    const cycle = (req.query.cycle as string) || currentCycle(tz);
    const result = await mealService.monthlyCalendar(req.membership!.homeId, cycle);
    sendSuccess(res, result, 'Monthly meal calendar');
  }),

  requestGuest: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await mealService.requestGuestMeal(
      req.membership!.homeId,
      req.membership!._id,
      req.body.date,
      req.body.slot,
      req.body.count,
      req.body.note,
    );
    sendSuccess(res, result, 'Guest meal requested', 201);
  }),

  listGuestRequests: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const status = req.query.status as GuestMealStatus | undefined;
    const result = await mealService.listGuestRequests(req.membership!.homeId, status);
    sendSuccess(res, result, 'Guest meal requests');
  }),

  approveGuest: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await mealService.resolveGuestMeal(req.membership!.homeId, req.params.id, true);
    sendSuccess(res, result, result.message);
  }),

  rejectGuest: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await mealService.resolveGuestMeal(req.membership!.homeId, req.params.id, false);
    sendSuccess(res, result, result.message);
  }),

  closeDay: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const result = await mealService.closeDay(req.membership!.homeId, req.body.date, req.membership!._id);
    sendSuccess(res, result, result.message);
  }),
};
