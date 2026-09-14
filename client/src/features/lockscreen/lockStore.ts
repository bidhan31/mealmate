/**
 * Lockscreen client-side store.
 *
 * The authoritative lock state (isAppLocked, hasLockPin, lockTimeoutMin) now
 * lives on the SERVER and is returned by every /auth/me, /auth/login, etc.
 * call.  This file only tracks the last-active timestamp locally so the
 * inactivity timer can fire without a roundtrip on every mouse move.
 */

const KEY_LAST_ACTIVE = 'mm_lock_last_active';

export const lockStore = {
  updateLastActive() {
    localStorage.setItem(KEY_LAST_ACTIVE, Date.now().toString());
  },

  /** Returns true if the given timeout (minutes) has elapsed since last activity. */
  isTimedOut(timeoutMin: number): boolean {
    if (timeoutMin === 0) return false;
    const raw = localStorage.getItem(KEY_LAST_ACTIVE);
    if (!raw) return false;
    const elapsed = (Date.now() - Number(raw)) / 1000 / 60;
    return elapsed >= timeoutMin;
  },

  clearLastActive() {
    localStorage.removeItem(KEY_LAST_ACTIVE);
  },
};
