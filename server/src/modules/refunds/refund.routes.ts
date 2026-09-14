import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership, requireAdmin } from '../../middleware/rbac';
import { refundController } from './refund.controller';
import {
  createRefundSchema,
  refundIdParam,
  refundListQuery,
  refundPreviewQuery,
  validateRefundSchema,
} from './refund.validators';

const router = Router();

router.use(requireAuth, loadMembership);

router.get('/', validate({ query: refundListQuery }), refundController.list);
// Preview: live read-only snapshot — no mutation, open to any authenticated member
router.get('/preview', validate({ query: refundPreviewQuery }), refundController.preview);
// Validate: dry-run check — no mutation, open to any authenticated member
router.post('/validate', validate({ body: validateRefundSchema }), refundController.validate);
router.post('/', requireAdmin, validate({ body: createRefundSchema }), refundController.create);
router.delete('/:id', requireAdmin, validate({ params: refundIdParam }), refundController.remove);

export default router;
