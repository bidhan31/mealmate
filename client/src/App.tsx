import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { serverLockApp } from '@/features/lockscreen/lockSlice';
import { lockStore } from '@/features/lockscreen/lockStore';
import { authApi } from '@/api/authApi';
import LockscreenOverlay from '@/features/lockscreen/LockscreenOverlay';
import AppShell from '@/layouts/AppShell';
import AuthLayout from '@/layouts/AuthLayout';
import ProtectedRoute from '@/features/auth/ProtectedRoute';
import GuestRoute from '@/features/auth/GuestRoute';
import HomeGate from '@/features/home/HomeGate';
import DashboardPage from '@/pages/DashboardPage';
import MembersPage from '@/pages/MembersPage';
import MealsPage from '@/pages/MealsPage';
import MealCalendarPage from '@/pages/MealCalendarPage';
import FoodPurchasesPage from '@/pages/FoodPurchasesPage';
import ExpensesPage from '@/pages/ExpensesPage';
import DepositsPage from '@/pages/DepositsPage';
import PaymentsPage from '@/pages/PaymentsPage';
import DuesPage from '@/pages/DuesPage';
import ReportsPage from '@/pages/ReportsPage';
import EssentialsPage from '@/pages/EssentialsPage';
import SettingsPage from '@/pages/SettingsPage';
import ProfilePage from '@/pages/ProfilePage';
import AuditLogPage from '@/pages/AuditLogPage';
import OnboardingPage from '@/pages/OnboardingPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import { Toaster } from 'sonner';

const router = createBrowserRouter([
  {
    element: (
      <GuestRoute>
        <AuthLayout />
      </GuestRoute>
    ),
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    path: '/onboarding',
    element: (
      <ProtectedRoute>
        <OnboardingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <HomeGate>
          <AppShell />
        </HomeGate>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'meals', element: <MealsPage /> },
      { path: 'calendar', element: <MealCalendarPage /> },
      { path: 'food-purchases', element: <FoodPurchasesPage /> },
      { path: 'expenses', element: <ExpensesPage /> },
      { path: 'deposits', element: <DepositsPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'dues', element: <DuesPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'members', element: <MembersPage /> },
      { path: 'essentials', element: <EssentialsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'audit-log', element: <AuditLogPage /> },
    ],
  },
]);

/**
 * Tracks user inactivity and:
 *  • updates last-active in localStorage on every interaction (cheap)
 *  • pings the server every 2 min to keep the session alive
 *  • checks every 30s if the configured timeout has elapsed and locks server-side if so
 */
function InactivityTracker() {
  const dispatch = useAppDispatch();
  const isLocked   = useAppSelector((s) => s.lock.isLocked);
  const isEnabled  = useAppSelector((s) => s.lock.isEnabled);
  const timeoutMin = useAppSelector((s) => s.lock.timeoutMin);
  const isAuthed   = useAppSelector((s) => s.auth.status === 'authenticated');
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update local timestamp on any user interaction (no network call)
  const handleActivity = useCallback(() => {
    if (!isLocked) lockStore.updateLastActive();
  }, [isLocked]);

  useEffect(() => {
    if (!isEnabled || !isAuthed) return;
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, handleActivity));
  }, [isEnabled, isAuthed, handleActivity]);

  // Periodic server ping every 2 min to keep last-active fresh on server
  useEffect(() => {
    if (!isEnabled || !isAuthed || isLocked) return;
    pingRef.current = setInterval(() => {
      authApi.pingActivity().catch(() => {/* ignore */});
    }, 2 * 60_000);
    return () => { if (pingRef.current) clearInterval(pingRef.current); };
  }, [isEnabled, isAuthed, isLocked]);

  // Check inactivity every 30s; lock on server if timed out
  useEffect(() => {
    if (!isEnabled || !isAuthed || timeoutMin === 0) return;
    const interval = setInterval(() => {
      if (!isLocked && lockStore.isTimedOut(timeoutMin)) {
        dispatch(serverLockApp());
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [isEnabled, isAuthed, isLocked, timeoutMin, dispatch]);

  return null;
}

export default function App() {
  const dispatch = useAppDispatch();

  // Seed the last-active timestamp on mount
  useEffect(() => {
    lockStore.updateLastActive();
  }, [dispatch]);

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <InactivityTracker />
      <LockscreenOverlay />
      <RouterProvider router={router} />
    </>
  );
}
