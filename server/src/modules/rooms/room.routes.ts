import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership, requireAdmin } from '../../middleware/rbac';
import { roomController } from './room.controller';
import {
  assignRoomSchema,
  createRoomSchema,
  roomIdParam,
  updateRoomSchema,
} from './room.validators';

const router = Router();

router.use(requireAuth, loadMembership);

router.get('/', roomController.list);
router.post('/', requireAdmin, validate({ body: createRoomSchema }), roomController.create);
router.patch(
  '/:id',
  requireAdmin,
  validate({ params: roomIdParam, body: updateRoomSchema }),
  roomController.update,
);
router.delete('/:id', requireAdmin, validate({ params: roomIdParam }), roomController.remove);
router.post('/assign', requireAdmin, validate({ body: assignRoomSchema }), roomController.assign);

export default router;
