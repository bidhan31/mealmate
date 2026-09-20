import { apiClient } from './client';
import type { ApiEnvelope, AuthResult, AuthUser, VerificationDispatch } from '@/types/auth';

export const authApi = {
  register: (name: string, email: string, password: string) =>
    apiClient.post<ApiEnvelope<{ user: AuthUser; message: string } & VerificationDispatch>>(
      '/auth/register',
      { name, email, password },
    ),

  verifyEmail: (token: string) =>
    apiClient.post<ApiEnvelope<{ user: AuthUser }>>('/auth/verify-email', { token }),

  resendVerification: (email: string) =>
    apiClient.post<ApiEnvelope<{ message: string } & VerificationDispatch>>('/auth/resend-verification', {
      email,
    }),

  login: (email: string, password: string) =>
    apiClient.post<ApiEnvelope<AuthResult>>('/auth/login', { email, password }),

  google: (idToken: string, name?: string) =>
    apiClient.post<ApiEnvelope<AuthResult & { needsName?: boolean }>>('/auth/google', { idToken, name }),

  logout: (refreshToken: string) =>
    apiClient.post<ApiEnvelope<{ message: string }>>('/auth/logout', { refreshToken }),

  forgotPassword: (email: string) =>
    apiClient.post<ApiEnvelope<{ message: string }>>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    apiClient.post<ApiEnvelope<{ message: string }>>('/auth/reset-password', { token, password }),

  me: () => apiClient.get<ApiEnvelope<{ user: AuthUser }>>('/auth/me'),

  // ── App Lock ─────────────────────────────────────────────────────────────

  /** Set or update the lock PIN (also enables lock automatically). */
  setLockPin: (pin: string, timeoutMin?: number) =>
    apiClient.post<ApiEnvelope<{ user: AuthUser }>>('/auth/lock-pin', { pin, timeoutMin }),

  /** Remove the lock PIN and disable the lock. */
  removeLockPin: () =>
    apiClient.delete<ApiEnvelope<{ user: AuthUser }>>('/auth/lock-pin'),

  /** Persist lock state to server (called when user presses Lock or timeout fires). */
  lockApp: () =>
    apiClient.post<ApiEnvelope<{ user: AuthUser }>>('/auth/lock'),

  /** Verify PIN and unlock on the server. */
  unlockApp: (pin: string) =>
    apiClient.post<ApiEnvelope<{ user: AuthUser }>>('/auth/unlock', { pin }),

  /** Update auto-lock timeout without changing the PIN. */
  updateLockSettings: (timeoutMin: number) =>
    apiClient.patch<ApiEnvelope<{ user: AuthUser }>>('/auth/lock-settings', { timeoutMin }),

  /** Ping the server to update last-active timestamp (prevents stale auto-lock). */
  pingActivity: () =>
    apiClient.post<ApiEnvelope<{ ok: boolean }>>('/auth/lock-activity'),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<ApiEnvelope<{ message: string }>>('/auth/change-password', { currentPassword, newPassword }),
};
