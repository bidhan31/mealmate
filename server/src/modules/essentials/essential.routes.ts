import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership } from '../../middleware/rbac';
import { essentialController } from './essential.controller';

const router = Router();

router.use(requireAuth, loadMembership);

router.get('/', essentialController.list);
router.post('/', essentialController.create);
router.patch('/:id', essentialController.update);
router.delete('/:id', essentialController.remove);

export default router;
