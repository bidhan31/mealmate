import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership, requireAdmin } from '../../middleware/rbac';
import { paymentController } from './payment.controller';
import { paymentIdParam, paymentListQuery, reversePaymentSchema } from './payment.validators';

const router = Router();

router.use(requireAuth, loadMembership);

// Members see their own payments; admin sees all (scoping enforced in the controller).
router.get('/', validate({ query: paymentListQuery }), paymentController.list);

// Reversing a payment is admin-only.
router.post(
  '/:id/reverse',
  requireAdmin,
  validate({ params: paymentIdParam, body: reversePaymentSchema }),
  paymentController.reverse,
);

export default router;
