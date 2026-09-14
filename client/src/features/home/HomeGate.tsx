import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadMyHome } from '@/features/home/homeSlice';

export default function HomeGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { status, membership } = useAppSelector((s) => s.home);

  useEffect(() => {
    if (status === 'idle') dispatch(loadMyHome());
  }, [dispatch, status]);

  if (status === 'idle' || status === 'loading') {
    return <div className="flex h-screen items-center justify-center text-gray-500">Loading…</div>;
  }

  // No active membership (either none, or pending approval) → onboarding.
  if (!membership || membership.status !== 'active') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
