import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { authController } from './auth.controller';
import {
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  setLockPinSchema,
  unlockAppSchema,
  updateLockSettingsSchema,
  verifyEmailSchema,
} from './auth.validators';

const router = Router();

// ── Public auth routes ───────────────────────────────────────────────────────
router.post('/register', validate({ body: registerSchema }), authController.register);
router.post('/verify-email', validate({ body: verifyEmailSchema }), authController.verifyEmail);
router.post(
  '/resend-verification',
  validate({ body: resendVerificationSchema }),
  authController.resendVerification,
);
router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/refresh', validate({ body: refreshSchema }), authController.refresh);
router.post('/logout', validate({ body: refreshSchema }), authController.logout);
router.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);
router.post('/reset-password', validate({ body: resetPasswordSchema }), authController.resetPassword);
router.post('/google', validate({ body: googleAuthSchema }), authController.google);

// ── Authenticated user routes ────────────────────────────────────────────────
router.get('/me', requireAuth, authController.me);
router.patch(
  '/me',
  requireAuth,
  validate({
    body: z.object({
      name: z.string().min(1).max(80).optional(),
      avatar: z.string().nullable().optional(),
      phone: z.string().max(30).optional(),
    }),
  }),
  authController.updateProfile,
);

// ── App Lock routes ──────────────────────────────────────────────────────────
router.post(
  '/lock-pin',
  requireAuth,
  validate({ body: setLockPinSchema }),
  authController.setLockPin,
);
router.delete('/lock-pin', requireAuth, authController.removeLockPin);
router.post('/lock', requireAuth, authController.lockApp);
router.post(
  '/unlock',
  requireAuth,
  validate({ body: unlockAppSchema }),
  authController.unlockApp,
);
router.patch(
  '/lock-settings',
  requireAuth,
  validate({ body: updateLockSettingsSchema }),
  authController.updateLockSettings,
);
router.post('/lock-activity', requireAuth, authController.pingActivity);
router.post(
  '/change-password',
  requireAuth,
  validate({
    body: z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    }),
  }),
  authController.changePassword,
);

export default router;
