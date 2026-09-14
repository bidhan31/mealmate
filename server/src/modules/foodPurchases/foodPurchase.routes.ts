import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership, requireAdmin } from '../../middleware/rbac';
import { foodPurchaseController } from './foodPurchase.controller';
import {
  createFoodPurchaseSchema,
  foodPurchaseIdParam,
  foodPurchaseListQuery,
  reviewFoodPurchaseSchema,
} from './foodPurchase.validators';

const router = Router();

router.use(requireAuth, loadMembership);

router.post('/', validate({ body: createFoodPurchaseSchema }), foodPurchaseController.create);
router.get('/', validate({ query: foodPurchaseListQuery }), foodPurchaseController.list);
router.patch(
  '/:id/review',
  requireAdmin,
  validate({ params: foodPurchaseIdParam, body: reviewFoodPurchaseSchema }),
  foodPurchaseController.review,
);
router.delete('/:id', validate({ params: foodPurchaseIdParam }), foodPurchaseController.remove);

export default router;
