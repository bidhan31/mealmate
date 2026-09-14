import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { login, googleLogin } from '@/features/auth/authSlice';
import { authApi } from '@/api/authApi';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton';
import GoogleNameModal from '@/features/auth/GoogleNameModal';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const authError = useAppSelector((s) => s.auth.error);
  const pendingGoogleIdToken = useAppSelector((s) => s.auth.pendingGoogleIdToken);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Email verification state
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const stateLocation = location.state as { from?: Location | string | { pathname: string } } | undefined;
  const from = stateLocation?.from;
  const targetDestination =
    typeof from === 'string'
      ? from
      : from && typeof from === 'object' && 'pathname' in from
      ? from.pathname
      : '/';

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setResendStatus(null);
    const result = await dispatch(login(values));
    setSubmitting(false);
    if (login.fulfilled.match(result)) navigate(targetDestination, { replace: true });
  };

  const handleInitiateVerification = async () => {
    setResendStatus(null);
    const emailVal = getValues('email')?.trim();

    if (!emailVal) {
      setResendStatus({ type: 'error', message: 'Please enter your email address to verify.' });
      return;
    }

    const emailCheck = z.string().email().safeParse(emailVal);
    if (!emailCheck.success) {
      setResendStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setResendingEmail(true);
    try {
      const res = await authApi.resendVerification(emailVal);
      setResendStatus({
        type: 'success',
        message: res.data.message || `Verification email sent to ${emailVal}. Please check your inbox.`,
      });
    } catch (err) {
      const x = err as { response?: { data?: { message?: string } } };
      setResendStatus({
        type: 'error',
        message: x.response?.data?.message ?? 'Failed to send verification email.',
      });
    } finally {
      setResendingEmail(false);
    }
  };

  // Called by GoogleSignInButton when the OAuth popup succeeds
  const handleCredential = useCallback(async (idToken: string) => {
    setGoogleLoading(true);
    const result = await dispatch(googleLogin({ idToken }));
    setGoogleLoading(false);
    if (googleLogin.fulfilled.match(result) && !result.payload.needsName) {
      navigate(targetDestination, { replace: true });
    }
  }, [dispatch, navigate, targetDestination]);

  return (
    <>
      {/* Name collection modal for Google accounts without a display name */}
      {pendingGoogleIdToken && <GoogleNameModal />}

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">Welcome back</h2>

        {authError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm font-medium text-destructive space-y-2">
            <p>{authError}</p>
            {authError.toLowerCase().includes('verify') && (
              <button
                type="button"
                onClick={handleInitiateVerification}
                disabled={resendingEmail}
                className="text-xs underline font-semibold text-destructive hover:opacity-80 block"
              >
                {resendingEmail ? 'Initiating verification...' : '→ Click here to send verification email now'}
              </button>
            )}
          </div>
        )}

        {resendStatus && (
          <div
            className={`rounded-lg p-3 text-sm font-medium border flex items-start justify-between gap-2 animate-in fade-in ${
              resendStatus.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}
          >
            <span>{resendStatus.message}</span>
            <button
              onClick={() => setResendStatus(null)}
              className="opacity-70 hover:opacity-100 font-bold px-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Google Sign-In Button (renderButton overlay approach) */}
        {GOOGLE_CLIENT_ID && (
          <>
            <GoogleSignInButton
              onCredential={handleCredential}
              loading={googleLoading}
              label="Continue with Google"
            />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground tracking-widest font-medium">or</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            id="email"
            type="email"
            label="Email"
            autoComplete="username"
            {...register('email')}
            error={errors.email?.message}
          />
          <Input
            id="password"
            type="password"
            label="Password"
            autoComplete="current-password"
            {...register('password')}
            error={errors.password?.message}
          />

          <div className="flex items-center justify-between text-xs sm:text-sm">
            <button
              type="button"
              onClick={handleInitiateVerification}
              disabled={resendingEmail}
              className="font-medium text-primary hover:underline underline-offset-4 disabled:opacity-50"
            >
              {resendingEmail ? 'Checking & sending...' : 'Verify email / Resend link'}
            </button>
            <Link to="/forgot-password" className="font-medium text-primary hover:underline underline-offset-4">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={submitting}>
            Log in
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </div>
    </>
  );
}
