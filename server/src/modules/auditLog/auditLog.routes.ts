import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership, requireAdmin } from '../../middleware/rbac';
import { auditLogController } from './auditLog.controller';

const router = Router();

// Admin-only — all audit log reads
router.use(requireAuth, loadMembership, requireAdmin);

router.get('/', auditLogController.list);

export default router;
