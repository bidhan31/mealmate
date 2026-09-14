import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { googleLogin, clearPendingGoogle } from '@/features/auth/authSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * Shown when a Google sign-up succeeds but the account has no display name
 * (name was derived from email). The user must provide their full name before
 * the account creation is finalised.
 */
export default function GoogleNameModal() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const pendingIdToken = useAppSelector((s) => s.auth.pendingGoogleIdToken);
  const authError = useAppSelector((s) => s.auth.error);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!pendingIdToken) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError('Please enter your full name (at least 2 characters)');
      return;
    }
    setNameError(null);
    setSubmitting(true);
    const result = await dispatch(googleLogin({ idToken: pendingIdToken, name: trimmed }));
    setSubmitting(false);
    if (googleLogin.fulfilled.match(result) && !result.payload.needsName) {
      navigate('/');
    }
  };

  const handleCancel = () => {
    dispatch(clearPendingGoogle());
  };

  return (
    // Backdrop
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm mx-4 bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 px-6 pt-8 pb-6 text-center border-b border-border">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">One last step</h2>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Your Google account doesn't have a display name set.<br />
            What should we call you?
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {(authError || nameError) && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
              {nameError ?? authError}
            </p>
          )}
          <Input
            id="google-name"
            label="Full name"
            placeholder="e.g. Fuad Ahmed"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(null); }}
            autoFocus
            error={nameError ?? undefined}
          />
          <Button type="submit" className="w-full" loading={submitting}>
            Continue
          </Button>
          <button
            type="button"
            onClick={handleCancel}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
