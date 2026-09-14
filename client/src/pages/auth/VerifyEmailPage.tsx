import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/authApi';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified! You can now log in.');
        // Auto-redirect to login after 3 seconds
        setTimeout(() => navigate('/login'), 3000);
      })
      .catch((err) => {
        const e = err as { response?: { data?: { message?: string } } };
        setStatus('error');
        setMessage(e.response?.data?.message ?? 'Verification failed. The link may have expired.');
      });
  }, [token, navigate]);

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-2xl font-semibold text-foreground tracking-tight">Email verification</h2>

      {status === 'verifying' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <svg className="animate-spin h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-muted-foreground">Verifying your email address…</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="rounded-lg bg-primary/10 px-4 py-3 text-sm font-medium text-primary">{message}</p>
          <p className="text-xs text-muted-foreground">Redirecting to login in 3 seconds…</p>
          <Link to="/login" className="inline-block text-sm font-medium text-primary hover:underline underline-offset-4">
            Go to login now →
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{message}</p>
          <Link to="/login" className="inline-block text-sm font-medium text-primary hover:underline underline-offset-4">
            Go to login
          </Link>
        </div>
      )}
    </div>
  );
}
