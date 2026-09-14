import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/authApi';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    if (!token) {
      setError('Missing reset token.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword(token, values.password);
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">Invalid link</h2>
        <p className="text-sm text-muted-foreground">This password reset link is missing or malformed.</p>
        <Link to="/forgot-password" className="inline-block text-sm font-medium text-primary hover:underline underline-offset-4">
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">Password reset!</h2>
        <p className="text-sm text-muted-foreground">
          Your password has been updated successfully. Redirecting to login…
        </p>
        <Link to="/login" className="inline-block text-sm font-medium text-primary hover:underline underline-offset-4">
          Go to login now →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">Set a new password</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Choose a strong password for your account.</p>
      </div>
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          id="password"
          type="password"
          label="New password"
          {...register('password')}
          error={errors.password?.message}
        />
        <Input
          id="confirm"
          type="password"
          label="Confirm password"
          {...register('confirm')}
          error={errors.confirm?.message}
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Reset password
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary hover:underline underline-offset-4">
          ← Back to login
        </Link>
      </p>
    </div>
  );
}
