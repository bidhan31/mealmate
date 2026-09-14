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
