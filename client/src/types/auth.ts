export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  phone?: string | null;
  emailVerified: boolean;
  activeMembershipId: string | null;
  // ── App Lock ──────────────────────────────────────
  isAppLocked: boolean;
  hasLockPin: boolean;
  lockTimeoutMin: number;
  // ── Notification Preferences ──────────────────────
  // Sparse record: missing key = opted-in (true), explicit false = opted-out
  notificationPrefs?: Record<string, boolean>;
}


export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * Result of dispatching a verification email (register / resend verification).
 * `verificationUrl` and `mailError` are only returned outside production, so a
 * developer can finish verification without an inbox when no mail provider is
 * configured — production always requires the emailed link.
 */
export interface VerificationDispatch {
  /** true when the mail provider accepted the verification email. */
  emailSent: boolean;
  /** true when the server still requires a verified email in order to log in. */
  verifyRequired: boolean;
  /** Verification link — returned only outside production. */
  verificationUrl?: string;
  /** Reason the email could not be sent (returned only outside production). */
  mailError?: string;
}
