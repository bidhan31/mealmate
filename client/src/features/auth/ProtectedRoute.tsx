import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadCurrentUser } from '@/features/auth/authSlice';
import { tokenStore } from '@/lib/tokenStore';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { user, status } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (status === 'idle' && tokenStore.getAccess()) {
      dispatch(loadCurrentUser());
    }
  }, [dispatch, status]);

  const hasToken = !!tokenStore.getAccess();

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">Loading…</div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
