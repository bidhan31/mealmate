import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership, requireAdmin } from '../../middleware/rbac';
import { membershipController } from './membership.controller';
import { inviteSchema, listMembersQuery, membershipIdParam, updateRoleSchema } from './membership.validators';

const router = Router();

router.use(requireAuth, loadMembership);

router.get('/', validate({ query: listMembersQuery }), membershipController.list);
router.post('/invite', requireAdmin, validate({ body: inviteSchema }), membershipController.invite);
router.post('/:id/approve', requireAdmin, validate({ params: membershipIdParam }), membershipController.approve);
router.post('/:id/reject', requireAdmin, validate({ params: membershipIdParam }), membershipController.reject);
router.patch('/:id/role', requireAdmin, validate({ params: membershipIdParam, body: updateRoleSchema }), membershipController.updateRole);
router.delete('/:id', requireAdmin, validate({ params: membershipIdParam }), membershipController.remove);

export default router;
