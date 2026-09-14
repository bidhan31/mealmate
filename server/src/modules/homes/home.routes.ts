import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership, requireAdmin } from '../../middleware/rbac';
import { homeController } from './home.controller';
import { createHomeSchema, joinHomeSchema, updateHomeSchema, updateExpenseTypesSchema } from './home.validators';

const router = Router();

router.use(requireAuth);

// Onboarding — no active membership required yet.
router.post('/', validate({ body: createHomeSchema }), homeController.create);
router.post('/join', validate({ body: joinHomeSchema }), homeController.join);
router.get('/me', homeController.myHome);
router.post('/join-request/cancel', homeController.cancelJoinRequest);

router.get('/invitations', homeController.listInvitations);
router.post('/invitations/:id/accept', homeController.acceptInvitation);
router.post('/invitations/:id/reject', homeController.rejectInvitation);

// Requires active membership.
router.patch(
  '/settings',
  loadMembership,
  requireAdmin,
  validate({ body: updateHomeSchema }),
  homeController.updateSettings,
);
router.put(
  '/expense-types',
  loadMembership,
  requireAdmin,
  validate({ body: updateExpenseTypesSchema }),
  homeController.updateExpenseTypes,
);
router.post('/leave', loadMembership, homeController.leave);
router.post('/regenerate-invite', loadMembership, requireAdmin, homeController.regenerateInviteCode);
router.get('/export-data', loadMembership, homeController.exportData);

export default router;
