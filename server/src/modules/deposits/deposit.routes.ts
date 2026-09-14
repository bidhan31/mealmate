import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership, requireAdmin } from '../../middleware/rbac';
import { depositController } from './deposit.controller';
import { createDepositSchema, depositIdParam, depositListQuery } from './deposit.validators';

const router = Router();

router.use(requireAuth, loadMembership);

router.get('/', validate({ query: depositListQuery }), depositController.list);
router.post('/', requireAdmin, validate({ body: createDepositSchema }), depositController.create);
router.delete('/:id', requireAdmin, validate({ params: depositIdParam }), depositController.remove);

export default router;
