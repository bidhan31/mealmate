import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership } from '../../middleware/rbac';
import { dueController } from './due.controller';
import { dueListQuery } from './due.validators';

const router = Router();

router.use(requireAuth, loadMembership);

router.get('/', validate({ query: dueListQuery }), dueController.list);

export default router;
