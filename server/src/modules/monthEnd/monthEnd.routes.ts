import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership, requireAdmin } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { monthEndController } from './monthEnd.controller';
import { closeMonthSchema, cycleQuerySchema } from './monthEnd.validators';

const router = Router();

router.use(requireAuth, loadMembership);

// Admin-only: close a cycle
router.post('/close', requireAdmin, validate({ body: closeMonthSchema }), monthEndController.close);

// Any active member: read history and status
router.get('/history', monthEndController.history);
router.get('/status', validate({ query: cycleQuerySchema }), monthEndController.status);

export default router;
