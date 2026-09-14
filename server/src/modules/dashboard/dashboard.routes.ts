import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership } from '../../middleware/rbac';
import { dashboardController } from './dashboard.controller';
import { dashboardQuery, markPaidSchema } from './dashboard.validators';
import { requireAdmin } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth, loadMembership);

router.get('/summary', validate({ query: dashboardQuery }), dashboardController.summary);
router.post('/mark-paid', requireAdmin, validate({ body: markPaidSchema }), dashboardController.markPaid);

export default router;
