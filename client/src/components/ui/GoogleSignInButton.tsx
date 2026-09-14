import { useCallback, useEffect, useRef } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

// Google Identity Services supports one global callback. Keep it current as
// users navigate between login and registration without re-initializing GIS.
let googleHasBeenInitialized = false;
let credentialHandler: ((idToken: string) => void) | null = null;

interface Props {
  onCredential: (idToken: string) => void;
  loading?: boolean;
  label?: string;
  disabled?: boolean;
}

export function GoogleSignInButton({ onCredential, loading = false, label = 'Continue with Google', disabled = false }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const hasRendered = useRef(false);

  useEffect(() => {
    credentialHandler = onCredential;
    return () => {
      if (credentialHandler === onCredential) credentialHandler = null;
    };
  }, [onCredential]);

  const renderGoogleButton = useCallback(() => {
    if (!buttonRef.current || !window.google || hasRendered.current) return;

    if (!googleHasBeenInitialized) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => credentialHandler?.(response.credential),
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      googleHasBeenInitialized = true;
    }

    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      size: 'large',
      theme: 'filled_blue',
      width: 400,
      text: label.toLowerCase().startsWith('sign up') ? 'signup_with' : 'continue_with',
      shape: 'rectangular',
    });
    hasRendered.current = true;
  }, [label]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || loading || disabled) return;

    if (window.google) {
      renderGoogleButton();
      return;
    }

    const id = window.setInterval(() => {
      if (window.google) {
        window.clearInterval(id);
        renderGoogleButton();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [disabled, loading, renderGoogleButton]);

  return (
    <div className={loading || disabled ? 'pointer-events-none opacity-60' : ''} aria-busy={loading}>
      <div ref={buttonRef} className="flex min-h-11 w-full justify-center" />
    </div>
  );
}
