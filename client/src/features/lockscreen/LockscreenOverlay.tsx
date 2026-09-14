import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { serverUnlockApp } from '@/features/lockscreen/lockSlice';
import { logout } from '@/features/auth/authSlice';
import { clearHome } from '@/features/home/homeSlice';
import { lockStore } from '@/features/lockscreen/lockStore';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function LockscreenOverlay() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const isLocked = useAppSelector((s) => s.lock.isLocked);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state whenever the overlay appears
  useEffect(() => {
    if (isLocked) {
      setPin('');
      setError(null);
      setAttempts(0);
      setLockedOut(false);
      setCountdown(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isLocked]);

  // Countdown after too many attempts
  useEffect(() => {
    if (countdown <= 0) {
      if (lockedOut) {
        setLockedOut(false);
        setAttempts(0);
        setError(null);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, lockedOut]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }, []);

  const handleVerify = useCallback(async (value: string) => {
    if (checking || lockedOut || value.length < 4) return;
    setChecking(true);

    const result = await dispatch(serverUnlockApp(value));
    setChecking(false);
    setPin('');

    if (serverUnlockApp.fulfilled.match(result)) {
      // Lock cleared on server → lock slice updates automatically via listener
      lockStore.updateLastActive();
      setAttempts(0);
      setError(null);
    } else {
      const next = attempts + 1;
      setAttempts(next);
      triggerShake();
      if (next >= MAX_ATTEMPTS) {
        setLockedOut(true);
        setCountdown(LOCKOUT_SECONDS);
        setError(`Too many attempts. Try again in ${LOCKOUT_SECONDS}s.`);
      } else {
        const remaining = MAX_ATTEMPTS - next;
        setError(`Incorrect PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
      }
    }
  }, [attempts, checking, lockedOut, dispatch, triggerShake]);

  const appendDigit = (d: string) => {
    if (lockedOut || checking) return;
    const next = (pin + d).slice(0, 8);
    setPin(next);
    setError(null);
  };

  const deleteDigit = () => {
    setPin((p) => p.slice(0, -1));
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length >= 4) handleVerify(pin);
  };

  const handleLogout = () => {
    dispatch(logout());
    dispatch(clearHome());
  };

  if (!isLocked) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl"
      style={{ animation: 'lockFadeIn 0.35s cubic-bezier(0.16,1,0.3,1)' }}
    >
      <style>{`
        @keyframes lockFadeIn {
          from { opacity: 0; transform: scale(1.04); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pinShake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-9px); }
          35%     { transform: translateX(9px); }
          55%     { transform: translateX(-6px); }
          75%     { transform: translateX(6px); }
          90%     { transform: translateX(-3px); }
        }
        @keyframes dotPop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-7 w-full max-w-xs px-6">

        {/* Branding */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-primary/30">
            <svg className="w-10 h-10 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">MealMate</h1>
          {user && (
            <p className="text-sm text-muted-foreground mt-1 truncate max-w-[200px]">{user.name}</p>
          )}
        </div>

        {/* Lock icon */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <p className="text-xs font-medium text-muted-foreground">App locked — enter your PIN</p>
        </div>

        {/* Hidden keyboard input */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => {
            if (lockedOut || checking) return;
            const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
            setPin(digits);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          className="sr-only"
          aria-label="PIN"
          disabled={lockedOut || checking}
          autoComplete="off"
        />

        {/* PIN dots — grow as user types */}
        <div
          className="flex items-center justify-center gap-3 min-h-[20px]"
          style={shake ? { animation: 'pinShake 0.6s ease-in-out' } : undefined}
          onClick={() => inputRef.current?.focus()}
        >
          {pin.length === 0 ? (
            // No input yet — show 4 faint empty slots as a hint
            Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full border-2 border-border/40 bg-transparent"
              />
            ))
          ) : (
            // One filled dot per typed digit — pops in with scale animation
            Array.from({ length: pin.length }, (_, i) => (
              <div
                key={i}
                className="w-3.5 h-3.5 rounded-full bg-primary border-2 border-primary"
                style={{
                  animation: i === pin.length - 1
                    ? 'dotPop 0.18s cubic-bezier(0.34,1.56,0.64,1) both'
                    : 'none',
                }}
              />
            ))
          )}
        </div>

        {/* Error / countdown */}
        {(error || lockedOut) && (
          <p className="text-center text-sm font-medium text-destructive px-2">
            {lockedOut && countdown > 0 ? `Too many attempts — try again in ${countdown}s` : error}
          </p>
        )}

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {['1','2','3','4','5','6','7','8','9'].map((d) => (
            <button
              key={d}
              onClick={() => appendDigit(d)}
              disabled={lockedOut || checking}
              className="h-14 rounded-2xl text-xl font-semibold text-foreground bg-muted hover:bg-muted/60 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none border border-border/40 shadow-sm"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => appendDigit('0')}
            disabled={lockedOut || checking}
            className="h-14 rounded-2xl text-xl font-semibold text-foreground bg-muted hover:bg-muted/60 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none border border-border/40 shadow-sm"
          >
            0
          </button>
          <button
            onClick={deleteDigit}
            disabled={lockedOut || checking || pin.length === 0}
            aria-label="Delete"
            className="h-14 rounded-2xl flex items-center justify-center text-muted-foreground bg-muted hover:bg-muted/60 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none border border-border/40 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l-7-7 7-7m7 7H5"/>
            </svg>
          </button>
        </div>

        {/* Unlock button */}
        <button
          onClick={() => handleVerify(pin)}
          disabled={pin.length < 4 || lockedOut || checking}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-primary/25"
        >
          {checking ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Checking…
            </span>
          ) : 'Unlock'}
        </button>

        {/* Sign-out escape hatch */}
        <button
          onClick={handleLogout}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          Forgot PIN? Sign out instead
        </button>
      </div>
    </div>
  );
}
