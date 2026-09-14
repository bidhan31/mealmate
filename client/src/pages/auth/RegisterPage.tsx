import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/authApi';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { googleLogin } from '@/features/auth/authSlice';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton';
import GoogleNameModal from '@/features/auth/GoogleNameModal';

const schema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const pendingGoogleIdToken = useAppSelector((s) => s.auth.pendingGoogleIdToken);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.register(values.name, values.email, values.password);
      setDone(true);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Called by GoogleSignInButton when the OAuth popup succeeds
  const handleCredential = useCallback(async (idToken: string) => {
    setGoogleLoading(true);
    const result = await dispatch(googleLogin({ idToken }));
    setGoogleLoading(false);
    if (googleLogin.fulfilled.match(result) && !result.payload.needsName) {
      navigate('/');
    }
  }, [dispatch, navigate]);

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">Check your email</h2>
        <p className="text-sm text-muted-foreground font-medium leading-relaxed">
          We&apos;ve sent a verification link to your inbox.<br />
          Verify your email, then log in.
        </p>
        <p className="text-xs text-muted-foreground opacity-75">Didn&apos;t receive it? Check your spam folder.</p>
        <Link to="/login" className="inline-block text-primary hover:underline underline-offset-4 text-sm font-medium">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Name collection modal for Google accounts without a display name */}
      {pendingGoogleIdToken && <GoogleNameModal />}

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">Create your account</h2>

        {error && (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>
        )}

        {/* Google Sign-Up Button (renderButton overlay approach) */}
        {GOOGLE_CLIENT_ID && (
          <>
            <GoogleSignInButton
              onCredential={handleCredential}
              loading={googleLoading}
              label="Sign up with Google"
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
          <Input id="name" label="Full name" {...register('name')} error={errors.name?.message} />
          <Input id="email" type="email" label="Email" {...register('email')} error={errors.email?.message} />
          <Input
            id="password"
            type="password"
            label="Password"
            {...register('password')}
            error={errors.password?.message}
          />
          <Button type="submit" className="w-full" loading={submitting}>
            Sign up
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline underline-offset-4">
            Log in
          </Link>
        </p>
      </div>
    </>
  );
}
