import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { AuthedRequest } from '../../middleware/requireAuth';
import { authService } from './auth.service';

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password } = req.body;
    const result = await authService.register(name, email, password);
    sendSuccess(res, result, result.message, 201);
  }),

  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.verifyEmail(req.body.token);
    sendSuccess(res, result, 'Email verified. You can now log in.');
  }),

  resendVerification: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resendVerification(req.body.email);
    sendSuccess(res, result, result.message);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body.email, req.body.password);
    sendSuccess(res, result, 'Logged in');
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken);
    sendSuccess(res, result, 'Token refreshed');
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.logout(req.body.refreshToken);
    sendSuccess(res, result, result.message);
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    sendSuccess(res, result, result.message);
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resetPassword(req.body.token, req.body.password);
    sendSuccess(res, result, result.message);
  }),

  google: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.googleAuth(req.body.idToken, req.body.name);
    sendSuccess(res, result, 'Logged in with Google');
  }),

  me: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await authService.me(req.user!.id);
    sendSuccess(res, result, 'Current user');
  }),

  updateProfile: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { name, avatar, phone } = req.body as { name?: string; avatar?: string; phone?: string };
    const result = await authService.updateProfile(req.user!.id, { name, avatar, phone });
    sendSuccess(res, result, 'Profile updated');
  }),

  // ── App Lock endpoints ────────────────────────────────────────────────────

  setLockPin: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { pin, timeoutMin } = req.body as { pin: string; timeoutMin?: number };
    const result = await authService.setLockPin(req.user!.id, pin, timeoutMin);
    sendSuccess(res, result, 'Lock PIN saved');
  }),

  removeLockPin: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await authService.removeLockPin(req.user!.id);
    sendSuccess(res, result, 'App lock removed');
  }),

  lockApp: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await authService.lockApp(req.user!.id);
    sendSuccess(res, result, 'App locked');
  }),

  unlockApp: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { pin } = req.body as { pin: string };
    const result = await authService.unlockApp(req.user!.id, pin);
    sendSuccess(res, result, 'App unlocked');
  }),

  updateLockSettings: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { timeoutMin } = req.body as { timeoutMin: number };
    const result = await authService.updateLockSettings(req.user!.id, timeoutMin);
    sendSuccess(res, result, 'Lock settings updated');
  }),

  pingActivity: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await authService.pingActivity(req.user!.id);
    sendSuccess(res, result, 'Activity updated');
  }),

  changePassword: asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user!.id, currentPassword, newPassword);
    sendSuccess(res, result, result.message);
  }),
};
