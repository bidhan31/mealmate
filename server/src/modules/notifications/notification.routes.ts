import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership } from '../../middleware/rbac';
import { notificationController } from './notification.controller';

const router = Router();

router.use(requireAuth, loadMembership);

// NOTE: /read-all must be declared BEFORE /:id/read to avoid route conflict
router.patch('/read-all', notificationController.markAllRead);
router.get('/', notificationController.list);
router.patch('/:id/read', notificationController.markRead);

// ── Notification Preferences ──────────────────────────────────────────────────
// No homeId needed for prefs (they are per-user, not per-home), but loadMembership
// still needed for requireAuth context. Prefs routes have no conflict with /:id/read.
router.get('/prefs', notificationController.getPrefs);
router.patch('/prefs', notificationController.updatePrefs);

export default router;
