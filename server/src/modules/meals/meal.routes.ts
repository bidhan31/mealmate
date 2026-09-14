import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership, requireAdmin } from '../../middleware/rbac';
import { mealController } from './meal.controller';
import {
  cycleQuery,
  dateQuery,
  disableSlotsSchema,
  guestMealSchema,
  guestStatusQuery,
  mealIdParam,
  removeHomeWindowSchema,
  setMealSchema,
  closeDaySchema,
} from './meal.validators';

const router = Router();

router.use(requireAuth, loadMembership);

router.put('/', validate({ body: setMealSchema }), mealController.setMeal);
router.post('/disable-slots', validate({ body: disableSlotsSchema }), mealController.disableSlots);
router.post(
  '/remove-home-window',
  requireAdmin,
  validate({ body: removeHomeWindowSchema }),
  mealController.removeHomeWindow,
);
router.post(
  '/remove-member-window',
  validate({ body: removeHomeWindowSchema }),
  mealController.removeMemberWindow,
);
router.get('/', validate({ query: dateQuery }), mealController.listByDate);
router.get('/monthly', validate({ query: cycleQuery }), mealController.monthly);
router.get('/monthly-calendar', validate({ query: cycleQuery }), mealController.monthlyCalendar);

router.post('/guest', validate({ body: guestMealSchema }), mealController.requestGuest);
router.get('/guest', validate({ query: guestStatusQuery }), mealController.listGuestRequests);
router.post('/guest/:id/approve', validate({ params: mealIdParam }), mealController.approveGuest);
router.post('/guest/:id/reject', validate({ params: mealIdParam }), mealController.rejectGuest);

router.post('/close-day', requireAdmin, validate({ body: closeDaySchema }), mealController.closeDay);

export default router;
