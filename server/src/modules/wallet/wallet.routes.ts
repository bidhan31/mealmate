import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership } from '../../middleware/rbac';
import { walletController } from './wallet.controller';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const router = Router();

router.use(requireAuth, loadMembership);

router.get('/', walletController.list);
router.get(
  '/:membershipId/transactions',
  validate({ params: z.object({ membershipId: objectId }) }),
  walletController.transactions,
);

export default router;
