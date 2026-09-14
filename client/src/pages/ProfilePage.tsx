import { useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { apiClient } from '@/api/client';
import { homeApi } from '@/api/homeApi';
import { dueApi, walletApi } from '@/api/financeApi';
import { setUser } from '@/features/auth/authSlice';
import type { ApiEnvelope, AuthUser } from '@/types/auth';
import type { HomeDto, MyMembership } from '@/types/home';
import type { MemberDueRow } from '@/types/finance';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AvatarPickerModal } from '@/components/profile/AvatarPickerModal';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import {
  User as UserIcon,
  Home as HomeIcon,
  Wallet,
  ShieldCheck,
  Lock,
  Camera,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  Sparkles,
  Utensils,
  KeyRound,
  Eye,
  EyeOff,
  SlidersHorizontal,
} from 'lucide-react';

type TabType = 'personal' | 'household' | 'financial' | 'security' | 'preferences';

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<TabType>('personal');

  // Form state
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Avatar Modal State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  // Household & Membership Data
  const [homeData, setHomeData] = useState<{ home: HomeDto | null; membership: MyMembership | null }>({
    home: null,
    membership: null,
  });
  const [loadingHome, setLoadingHome] = useState(true);

  // Financial & Stats Data
  const [myDuesInfo, setMyDuesInfo] = useState<MemberDueRow | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Lock PIN Management State
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [lockTimeout, setLockTimeout] = useState<number>(user?.lockTimeoutMin ?? 5);
  const [lockActionMsg, setLockActionMsg] = useState<string | null>(null);
  const [lockActionErr, setLockActionErr] = useState<string | null>(null);
  const [lockLoading, setLockLoading] = useState(false);

  // Email verification resend state
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  // Synchronize state when user changes
  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone ?? '');
      setAvatar(user.avatar ?? '');
      setLockTimeout(user.lockTimeoutMin ?? 5);
    }
  }, [user]);

  // Fetch Home & Dues details
  useEffect(() => {
    async function loadHouseholdData() {
      try {
        setLoadingHome(true);
        const homeRes = await homeApi.myHome();
        setHomeData(homeRes.data.data);

        // Fetch Dues & Wallet if active membership exists
        const memId = homeRes.data.data.membership?.id;
        if (memId) {
          try {
            const duesRes = await dueApi.list();
            const foundMember = duesRes.data.data.members.find(
              (m: MemberDueRow) => m.membershipId === memId,
            );
            if (foundMember) setMyDuesInfo(foundMember);

            const walletRes = await walletApi.list();
            const wallets = walletRes.data.data.wallets;
            if (wallets && wallets.length > 0) {
              const myWallet = wallets.find((w) => {
                const idStr = typeof w.membershipId === 'string' ? w.membershipId : w.membershipId._id;
                return idStr === memId;
              }) || wallets[0];
              setWalletBalance(myWallet.balance);
            }
          } catch (e) {
            console.error('Financial stats load error:', e);
          }
        }
      } catch (e) {
        console.error('Failed to load household details:', e);
      } finally {
        setLoadingHome(false);
      }
    }
    loadHouseholdData();
  }, []);

  // Handle Save Profile
  const handleSaveProfile = useCallback(async () => {
    if (!name.trim()) return;
    setMsg(null);
    setErr(null);
    setSaving(true);
    try {
      const res = await apiClient.patch<ApiEnvelope<{ user: AuthUser }>>('/auth/me', {
        name: name.trim(),
        phone: phone.trim(),
        avatar: avatar || null,
      });
      dispatch(setUser(res.data.data.user));
      setMsg('Profile updated successfully.');
      setTimeout(() => setMsg(null), 3500);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setErr(x.response?.data?.message ?? 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [name, phone, avatar, dispatch]);

  // Handle Resend Verification Email
  const handleResendVerification = async () => {
    if (!user?.email) return;
    setVerifyingEmail(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await apiClient.post<ApiEnvelope<{ message: string }>>('/auth/resend-verification', {
        email: user.email,
      });
      setMsg(res.data.message || 'Verification link sent to your email.');
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setErr(x.response?.data?.message ?? 'Failed to send verification email');
    } finally {
      setVerifyingEmail(false);
    }
  };

  // Handle Set / Update Lock PIN
  const handleSetLockPin = async () => {
    if (pin.length < 4 || pin !== confirmPin) {
      setLockActionErr('PINs must match and be at least 4 digits long');
      return;
    }
    setLockActionErr(null);
    setLockActionMsg(null);
    setLockLoading(true);
    try {
      const res = await apiClient.post<ApiEnvelope<{ user: AuthUser }>>('/auth/lock-pin', {
        pin,
        timeoutMin: lockTimeout,
      });
      dispatch(setUser(res.data.data.user));
      setLockActionMsg('Security PIN configured successfully.');
      setPin('');
      setConfirmPin('');
      setTimeout(() => setLockActionMsg(null), 3500);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setLockActionErr(x.response?.data?.message ?? 'Failed to configure PIN');
    } finally {
      setLockLoading(false);
    }
  };

  // Handle Remove Lock PIN
  const handleRemoveLockPin = async () => {
    setLockActionErr(null);
    setLockActionMsg(null);
    setLockLoading(true);
    try {
      const res = await apiClient.delete<ApiEnvelope<{ user: AuthUser }>>('/auth/lock-pin');
      dispatch(setUser(res.data.data.user));
      setLockActionMsg('App lock protection removed.');
      setTimeout(() => setLockActionMsg(null), 3500);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setLockActionErr(x.response?.data?.message ?? 'Failed to remove PIN');
    } finally {
      setLockLoading(false);
    }
  };

  // Handle Update Lock Timeout
  const handleUpdateTimeout = async (newTimeout: number) => {
    setLockTimeout(newTimeout);
    try {
      const res = await apiClient.patch<ApiEnvelope<{ user: AuthUser }>>('/auth/lock-settings', {
        timeoutMin: newTimeout,
      });
      dispatch(setUser(res.data.data.user));
      setLockActionMsg(`Lock inactivity timeout set to ${newTimeout === 0 ? 'Never' : `${newTimeout} mins`}.`);
      setTimeout(() => setLockActionMsg(null), 3000);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setLockActionErr(x.response?.data?.message ?? 'Failed to update timeout');
    }
  };

  // Handle Instant Lock
  const handleLockNow = async () => {
    try {
      const res = await apiClient.post<ApiEnvelope<{ user: AuthUser }>>('/auth/lock');
      dispatch(setUser(res.data.data.user));
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setLockActionErr(x.response?.data?.message ?? 'Failed to lock app');
    }
  };

  if (!user) return null;

  const currentRole = homeData.membership?.role;
  const homeName = homeData.home?.name ?? 'No Active Home';

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Top Header Title ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            User Profile & Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your account identity, household affiliation, financial summaries, and app security preferences.
          </p>
        </div>
      </div>

      {/* ── Industry Hero Profile Card ── */}
      <Card className="border-border/60 shadow-xl overflow-hidden bg-card/60 backdrop-blur-xl relative">
        {/* Ambient Gradient Cover Banner */}
        <div className="h-36 sm:h-44 w-full bg-gradient-to-r from-primary/40 via-purple-500/20 to-primary/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)]" />
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/40 text-white backdrop-blur-md border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
          </div>
        </div>

        <CardContent className="px-6 sm:px-8 pb-8">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-16 sm:-mt-20 mb-6">
            {/* Interactive Avatar */}
            <div className="relative group">
              <img
                src={avatar || user.avatar || '/default-avatar.png'}
                alt={user.name}
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-card bg-muted shadow-2xl transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix';
                }}
              />
              <button
                onClick={() => setIsAvatarModalOpen(true)}
                className="absolute bottom-1 right-1 p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-110 ring-4 ring-card"
                title="Change Avatar"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Meta Header */}
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{user.name}</h2>
                {user.emailVerified ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400 gap-1 px-2.5 py-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1 px-2.5 py-0.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Unverified
                  </Badge>
                )}
                {currentRole && (
                  <Badge className="capitalize bg-primary/20 text-primary border-primary/30 font-semibold">
                    {currentRole} Role
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-primary/70" />
                  {user.email}
                </span>
                {user.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-primary/70" />
                    {user.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <HomeIcon className="w-4 h-4 text-primary/70" />
                  {homeName}
                </span>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAvatarModalOpen(true)}
                className="w-full md:w-auto gap-2 border-border/80"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                Change Avatar
              </Button>
            </div>
          </div>

          {/* ── Key Metrics Strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-border/50">
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <HomeIcon className="w-3.5 h-3.5 text-primary" /> Household
              </p>
              <p className="text-sm ml-5 font-semibold text-foreground truncate">{homeName}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <Wallet className="w-3.5 h-3.5 text-emerald-500" /> Wallet Balance
              </p>
              <p className="text-sm ml-5 font-semibold text-foreground">
                {walletBalance !== null ? `৳${walletBalance.toLocaleString()}` : '৳0'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <Utensils className="w-3.5 h-3.5 text-amber-500" /> Monthly Meals
              </p>
              <p className="text-sm ml-5 font-semibold text-foreground">
                {myDuesInfo?.mealCount ?? 0} Meals
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <Lock className="w-3.5 h-3.5 text-indigo-500" /> App Lock Status
              </p>
              <p className="text-sm ml-5 font-semibold text-foreground">
                {user.hasLockPin ? 'Protected (PIN)' : 'Unprotected'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Modern Navigation Tabs ── */}
      <div className="flex border-b border-border/60 overflow-x-auto gap-2 sm:gap-6 no-scrollbar">
        <button
          onClick={() => setActiveTab('personal')}
          className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'personal'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          Personal Identity
        </button>

        <button
          onClick={() => setActiveTab('household')}
          className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'household'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <HomeIcon className="w-4 h-4" />
          Household & Room
        </button>

        <button
          onClick={() => setActiveTab('financial')}
          className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'financial'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Finance & Stats
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'security'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Security & PIN Lock
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'preferences'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Preferences
        </button>
      </div>

      {/* ── Global Messages ── */}
      {msg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-sm font-medium text-destructive flex items-center gap-2 animate-in fade-in duration-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {err}
        </div>
      )}

      {/* ── TAB 1: Personal Identity ── */}
      {activeTab === 'personal' && (
        <Card className="border-border/60 shadow-sm bg-card/40 backdrop-blur-xl">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">Personal Information</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update your display name, contact phone number, and avatar image.
              </p>
            </div>

            <div className="grid gap-6 max-w-xl">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-muted-foreground" /> Display Name
                </label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" /> Phone Number
                </label>
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +8801712345678"
                  type="tel"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Camera className="w-4 h-4 text-muted-foreground" /> Avatar Image Source
                </label>
                <div className="flex gap-2">
                  <Input
                    id="profile-avatar"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    type="url"
                    className="flex-1"
                  />
                  <Button variant="outline" type="button" onClick={() => setIsAvatarModalOpen(true)}>
                    Presets
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={
                    !name.trim() ||
                    (name === user.name && phone === (user.phone ?? '') && avatar === (user.avatar ?? '')) ||
                    saving
                  }
                  loading={saving}
                  className="w-full sm:w-auto"
                >
                  Save Profile Changes
                </Button>
              </div>

              <div className="space-y-2 pt-6 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" /> Registered Email Address
                  </label>
                  {!user.emailVerified && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResendVerification}
                      loading={verifyingEmail}
                      className="text-xs text-primary hover:underline h-auto p-0"
                    >
                      Resend verification email
                    </Button>
                  )}
                </div>
                <Input
                  id="profile-email"
                  value={user.email}
                  disabled
                  className="bg-muted/50 text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Primary login email addresses cannot be modified directly. Contact household admin if needed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 2: Household & Membership ── */}
      {activeTab === 'household' && (
        <Card className="border-border/60 shadow-sm bg-card/40 backdrop-blur-xl">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">Household Membership</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Overview of your current shared home, assigned room, and active membership role.
              </p>
            </div>

            {loadingHome ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading household details...</div>
            ) : homeData.home ? (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl border border-border/50 bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <HomeIcon className="w-4 h-4 text-primary" /> Active Household
                    </h4>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {homeData.membership?.role.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground pt-2">
                    <p className="flex justify-between">
                      <span>Home Name:</span>
                      <strong className="text-foreground">{homeData.home.name}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span>Invite Code:</span>
                      <code className="px-2 py-0.5 rounded bg-muted font-mono text-xs text-foreground">
                        {homeData.home.inviteCode}
                      </code>
                    </p>
                    <p className="flex justify-between">
                      <span>Timezone:</span>
                      <span className="text-foreground">{homeData.home.timezone || 'UTC'}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Active Cycle:</span>
                      <span className="text-foreground">{homeData.home.currentCycle}</span>
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-border/50 bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-amber-500" /> Meal Preferences & Room
                  </h4>

                  <div className="space-y-2 text-sm text-muted-foreground pt-2">
                    <p className="flex justify-between">
                      <span>Assigned Room:</span>
                      <strong className="text-foreground">
                        {homeData.membership?.roomId ? `Room Assigned` : 'No Room Assigned'}
                      </strong>
                    </p>
                    <p className="flex justify-between">
                      <span>Membership Status:</span>
                      <span className="capitalize text-emerald-500 font-medium">
                        {homeData.membership?.status || 'Active'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-border/60 rounded-2xl space-y-3">
                <p className="text-sm text-muted-foreground">You are not currently enrolled in any active household.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── TAB 3: Finance & Stats ── */}
      {activeTab === 'financial' && (
        <Card className="border-border/60 shadow-sm bg-card/40 backdrop-blur-xl">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">Financial & Monthly Activity Summary</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Summary of your personal financial contributions, wallet balance, and monthly meal metrics.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-border/50 bg-muted/20 space-y-2">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-500" /> Personal Wallet Balance
                </p>
                <h4 className="text-2xl font-bold text-foreground">
                  {walletBalance !== null ? `৳${walletBalance.toLocaleString()}` : '৳0'}
                </h4>
                <p className="text-xs text-muted-foreground">Available balance for household payments</p>
              </div>

              <div className="p-5 rounded-2xl border border-border/50 bg-muted/20 space-y-2">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-amber-500" /> Monthly Meal Count
                </p>
                <h4 className="text-2xl font-bold text-foreground">
                  {myDuesInfo?.mealCount ?? 0}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Est. Meal Cost: ৳{myDuesInfo?.mealCost?.toLocaleString() ?? 0}
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-border/50 bg-muted/20 space-y-2">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" /> Net Dues Position
                </p>
                <h4 className="text-2xl font-bold text-foreground">
                  ৳{myDuesInfo?.due?.toLocaleString() ?? 0}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {(myDuesInfo?.due ?? 0) < 0 ? 'Surplus / Advance Credit' : 'Current Net Outstanding'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 4: Security & App Lock ── */}
      {activeTab === 'security' && (
        <Card className="border-border/60 shadow-sm bg-card/40 backdrop-blur-xl">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> Security & App Lock Control
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure your 4-digit security PIN lock to protect your MealMate session on idle inactivity.
              </p>
            </div>

            {lockActionMsg && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {lockActionMsg}
              </div>
            )}
            {lockActionErr && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm font-medium text-destructive">
                {lockActionErr}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-8 pt-2">
              {/* Configure / Update Lock PIN */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  {user.hasLockPin ? 'Change Security PIN' : 'Set Up App Lock PIN'}
                </h4>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Enter 4-Digit Security PIN</label>
                    <div className="relative">
                      <Input
                        type={showPin ? 'text' : 'password'}
                        maxLength={6}
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="••••"
                        className="font-mono tracking-widest text-center text-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Confirm Security PIN</label>
                    <Input
                      type={showPin ? 'text' : 'password'}
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="••••"
                      className="font-mono tracking-widest text-center text-lg"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={handleSetLockPin}
                      disabled={!pin || pin !== confirmPin || lockLoading}
                      loading={lockLoading}
                      className="flex-1"
                    >
                      {user.hasLockPin ? 'Update PIN' : 'Enable Lock PIN'}
                    </Button>
                    {user.hasLockPin && (
                      <Button
                        variant="destructive"
                        onClick={handleRemoveLockPin}
                        disabled={lockLoading}
                        type="button"
                      >
                        Remove PIN
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Lock Settings & Immediate Lock */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-500" />
                    Inactivity Timeout Setting
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Choose after how long of inactivity MealMate automatically locks your screen.
                  </p>

                  <select
                    value={lockTimeout}
                    onChange={(e) => handleUpdateTimeout(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value={1}>1 Minute Inactivity</option>
                    <option value={5}>5 Minutes Inactivity</option>
                    <option value={15}>15 Minutes Inactivity</option>
                    <option value={30}>30 Minutes Inactivity</option>
                    <option value={0}>Never Lock Automatically</option>
                  </select>
                </div>

                {user.hasLockPin && (
                  <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
                    <h5 className="text-sm font-semibold text-foreground">Lock Application Now</h5>
                    <p className="text-xs text-muted-foreground">
                      Instantly lock your screen. Requires PIN to unlock.
                    </p>
                    <Button variant="outline" size="sm" onClick={handleLockNow} className="w-full gap-2">
                      <Lock className="w-4 h-4 text-primary" /> Lock Screen Now
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 5: Preferences ── */}
      {activeTab === 'preferences' && (
        <Card className="border-border/60 shadow-sm bg-card/40 backdrop-blur-xl">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" /> App Appearance & Preferences
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customize your visual theme and interface mode settings.
              </p>
            </div>

            <div className="space-y-6 max-w-md">
              <div className="p-5 rounded-2xl border border-border/50 bg-muted/20 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-foreground text-sm">Theme Mode</h4>
                  <p className="text-xs text-muted-foreground">Switch between light, dark, or system mode</p>
                </div>
                <ThemeSwitcher />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatar={avatar}
        onSelectAvatar={(newAvatar) => setAvatar(newAvatar)}
      />
    </div>
  );
}
