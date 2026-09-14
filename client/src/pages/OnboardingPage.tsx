import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { logout } from '@/features/auth/authSlice';
import { clearHome, loadMyHome } from '@/features/home/homeSlice';
import { homeApi } from '@/api/homeApi';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

type Mode = 'choose' | 'create' | 'join';
type Invitation = { id: string; homeId: string; homeName: string; role: string };

export default function OnboardingPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { home, membership, status: homeStatus } = useAppSelector((s) => s.home);
  const [mode, setMode] = useState<Mode>('choose');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  // Membership status is always read from the API after login/page load. No
  // local flag or cookie is used to decide whether a request is pending.
  useEffect(() => {
    dispatch(loadMyHome());
  }, [dispatch]);

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        const res = await homeApi.listInvitations();
        setInvitations(res.data.data.invitations ?? []);
      } catch {
        // Invitations are supplementary; the onboarding choices still work if this call fails.
      } finally {
        setLoadingInvites(false);
      }
    };
    fetchInvitations();
  }, []);

  const showError = (e: unknown) => {
    const response = e as { response?: { data?: { message?: string } } };
    setError(response.response?.data?.message ?? 'Something went wrong');
  };

  const refreshMembership = async () => {
    await dispatch(loadMyHome()).unwrap();
  };

  const handleCreate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await homeApi.create(name.trim());
      await refreshMembership();
      navigate('/', { replace: true });
    } catch (e) {
      showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await homeApi.join(inviteCode.trim());
      await refreshMembership();
      setMode('choose');
    } catch (e) {
      showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await homeApi.cancelJoinRequest();
      await refreshMembership();
      setMode('choose');
    } catch (e) {
      showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptInvite = async (id: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await homeApi.acceptInvitation(id);
      await refreshMembership();
      navigate('/', { replace: true });
    } catch (e) {
      showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectInvite = async (id: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await homeApi.rejectInvitation(id);
      setInvitations((current) => current.filter((invitation) => invitation.id !== id));
    } catch (e) {
      showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await dispatch(logout());
    dispatch(clearHome());
    navigate('/login', { replace: true });
  };

  if (homeStatus === 'idle' || homeStatus === 'loading') {
    return <div className="flex h-screen items-center justify-center text-gray-500">Loading...</div>;
  }

  if (membership?.status === 'active') {
    return <Navigate to="/" replace />;
  }

  const hasPendingRequest = membership?.status === 'pending';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-grey-50 to-grey-100 px-4 py-8">
      <div className="w-full max-w-lg bg-grey-100 rounded-2xl shadow-sm border border-border p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand-600">MealMate</h1>
          <p className="text-sm text-gray-500 mt-1">Set up your household to get started</p>
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        {hasPendingRequest ? (
          <div className="text-center space-y-2">
            <p className="rounded-lg text-blue-300 font-semibold tracking-wider bg-primary/10 p-3 text-sm">
              Your request to join {home?.name ?? 'this home'} is pending. An admin needs to approve you before you can access the home.
            </p>
            <Button className="mt-4" variant="outline" loading={submitting} onClick={handleCancelRequest}>
              Cancel request
            </Button>
          </div>
        ) : mode === 'choose' ? (
          <div className="space-y-3">
            <Button className="w-full text-card" onClick={() => setMode('create')}>
              Create a new home
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setMode('join')}>
              Join with an invite code
            </Button>
          </div>
        ) : mode === 'create' ? (
          <div className="space-y-4">
            <Input
              id="home-name"
              label="Home name"
              placeholder="e.g. Flat 4B"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button className="w-full" loading={submitting} onClick={handleCreate} disabled={name.trim().length < 2}>
              Create home
            </Button>
            <button type="button" className="text-sm text-gray-500 w-full" onClick={() => setMode('choose')}>
              Back
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              id="invite-code"
              label="Invite code"
              placeholder="8-character code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            />
            <Button className="w-full" loading={submitting} onClick={handleJoin} disabled={inviteCode.trim().length < 4}>
              Request to join
            </Button>
            <button type="button" className="text-sm text-gray-500 w-full" onClick={() => setMode('choose')}>
              Back
            </button>
          </div>
        )}
      </div>

      {!loadingInvites && invitations.length > 0 && !hasPendingRequest && mode === 'choose' && (
        <div className="w-full max-w-md mt-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Direct Invitations</h2>
          {invitations.map((invitation) => (
            <Card key={invitation.id} className=" border border-primary/40 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-brand-900">{invitation.homeName}</p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">Role: {invitation.role}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" loading={submitting} onClick={() => handleAcceptInvite(invitation.id)}>Accept</Button>
                  <Button variant="outline" size="sm" disabled={submitting} onClick={() => handleRejectInvite(invitation.id)}>Decline</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <button
        type="button"
        className="mt-6 text-sm text-gray-500 hover:text-gray-700 underline underline-offset-4"
        onClick={handleLogout}
      >
        Log out
      </button>
    </div>
  );
}
