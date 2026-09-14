import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadCurrentUser } from '@/features/auth/authSlice';
import { tokenStore } from '@/lib/tokenStore';

export default function GuestRoute({ children }: { children?: ReactNode }) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { user, status } = useAppSelector((s) => s.auth);
  const hasToken = !!tokenStore.getAccess();

  useEffect(() => {
    if (status === 'idle' && hasToken) {
      dispatch(loadCurrentUser());
    }
  }, [dispatch, status, hasToken]);

  if (hasToken && (status === 'idle' || status === 'loading')) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500 font-medium">
        Loading…
      </div>
    );
  }

  if (status === 'authenticated' && user) {
    const stateLocation = location.state as { from?: Location | string | { pathname: string } } | undefined;
    const from = stateLocation?.from;
    const redirectPath =
      typeof from === 'string'
        ? from
        : from && typeof from === 'object' && 'pathname' in from
        ? from.pathname
        : '/';

    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
