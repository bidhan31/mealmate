import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  Palette,
  Shield,
  Home as HomeIcon,
  Bell,
  Wallet,
  Download,
  Search,
  Copy,
  QrCode,
  RotateCw,
  Lock,
  KeyRound,
  Check,
  AlertTriangle,
  LogOut,
  Clock,
  Globe,
  DollarSign,
  Calendar,
  Utensils,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  Building,
  UtensilsCrossed,
  Users,
  AlertCircle,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { homeApi } from '@/api/homeApi';
import { authApi } from '@/api/authApi';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { savePrefs, setPref } from '@/features/notifications/notificationSlice';
import { setHome } from '@/features/home/homeSlice';
import {
  serverSetLockPin,
  serverRemoveLockPin,
  serverLockApp,
  serverUpdateLockSettings,
} from '@/features/lockscreen/lockSlice';
import type { MealSettings } from '@/types/home';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { QRCodeModal } from '@/components/QRCodeModal';
import { toast } from 'sonner';

type TabKey = 'appearance' | 'security' | 'home' | 'notifications' | 'financial' | 'data';

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const home = useAppSelector((s) => s.home.home);
  const isAdmin = useAppSelector((s) => s.home.membership?.role === 'admin');

  // Search & Navigation
  const [activeTab, setActiveTab] = useState<TabKey>('appearance');
  const [searchQuery, setSearchQuery] = useState('');

  // Lock state from server
  const isLockEnabled = useAppSelector((s) => s.lock.isEnabled);
  const lockTimeoutMin = useAppSelector((s) => s.lock.timeoutMin);

  // Home settings state
  const [homeName, setHomeName] = useState(home?.name ?? '');
  const [timezone, setTimezone] = useState(home?.timezone ?? 'Asia/Dhaka');
  const [descoAccountNo, setDescoAccountNo] = useState(home?.descoAccountNo ?? '');
  const [mealSettings, setMealSettings] = useState<MealSettings>(
    home?.mealSettings ?? { breakfast: true, lunch: true, dinner: true },
  );
  const [homeSaving, setHomeSaving] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);

  // App Lock UI state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);
  const [showChangePinForm, setShowChangePinForm] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);

  // Preferences State
  const [currencySymbol, setCurrencySymbol] = useState(() => {
    return localStorage.getItem('mealmate_currency') || '৳';
  });
  const [dateFormat, setDateFormat] = useState(() => {
    return localStorage.getItem('mealmate_date_format') || 'YYYY-MM-DD';
  });

  // Notification Preferences (from Redux — persisted to server)
  const notifPrefs = useAppSelector((s) => s.notifications.prefs);
  const notifStatus = useAppSelector((s) => s.notifications.status);
  const notifError = useAppSelector((s) => s.notifications.error);
  const [notifSaved, setNotifSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefsRef = useRef<Record<string, boolean>>({});

  // Expense Categories State (Admin)
  const [expenseTypes, setExpenseTypes] = useState(home?.expenseTypes ?? []);
  const [newExpName, setNewExpName] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const [savingExpTypes, setSavingExpTypes] = useState(false);

  // Modals & Extras
  const [showQRModal, setShowQRModal] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [leavingHome, setLeavingHome] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const TIMEOUT_OPTIONS = [
    { label: 'Never', value: 0 },
    { label: '1 minute', value: 1 },
    { label: '5 minutes', value: 5 },
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
  ];

  const CURRENCIES = [
    { code: 'BDT', symbol: '৳', label: 'BDT (৳)' },
    { code: 'USD', symbol: '$', label: 'USD ($)' },
    { code: 'EUR', symbol: '€', label: 'EUR (€)' },
    { code: 'INR', symbol: '₹', label: 'INR (₹)' },
    { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  ];

  const TIMEZONES = [
    'Asia/Dhaka',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Dubai',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'UTC',
  ];

  // Sync state when home changes
  useEffect(() => {
    if (home) {
      setHomeName(home.name);
      setTimezone(home.timezone ?? 'Asia/Dhaka');
      setDescoAccountNo(home.descoAccountNo ?? '');
      setMealSettings(home.mealSettings);
      setExpenseTypes(home.expenseTypes ?? []);
    }
  }, [home]);

  // Handle Currency change
  const handleCurrencyChange = (sym: string) => {
    setCurrencySymbol(sym);
    localStorage.setItem('mealmate_currency', sym);
    toast.success(`Currency symbol set to ${sym}`);
  };

  // Debounced notification toggle handler
  const handleNotifToggle = useCallback(
    (type: string, val: boolean) => {
      // 1. Optimistic Redux state update
      dispatch(setPref({ type, value: val }));

      // 2. Accumulate pending updates
      pendingPrefsRef.current[type] = val;

      // 3. Clear existing debounce timer
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      // 4. Set debounce timer to save to server after 400ms
      saveTimerRef.current = setTimeout(async () => {
        const payload = { ...pendingPrefsRef.current };
        pendingPrefsRef.current = {};
        const result = await dispatch(savePrefs(payload));
        if (savePrefs.fulfilled.match(result)) {
          setNotifSaved(true);
          setTimeout(() => setNotifSaved(false), 2500);
        } else {
          toast.error('Failed to save notification preference.');
        }
      }, 400);
    },
    [dispatch],
  );


  // Handle Date Format change
  const handleDateFormatChange = (fmt: string) => {
    setDateFormat(fmt);
    localStorage.setItem('mealmate_date_format', fmt);
    toast.success(`Date format updated to ${fmt}`);
  };

  // Handle Copy Invite Code
  const handleCopyCode = () => {
    if (!home?.inviteCode) return;
    navigator.clipboard.writeText(home.inviteCode);
    setCodeCopied(true);
    toast.success('Invite code copied to clipboard!');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // Handle Regenerate Invite Code
  const handleRegenerateInviteCode = async () => {
    if (!isAdmin) return;
    setRegeneratingCode(true);
    try {
      const res = await homeApi.regenerateInviteCode();
      dispatch(setHome(res.data.data.home));
      toast.success('New invite code generated successfully!');
    } catch {
      toast.error('Failed to regenerate invite code.');
    } finally {
      setRegeneratingCode(false);
    }
  };

  // Save Home Settings
  const saveHomeSettings = useCallback(async () => {
    setHomeSaving(true);
    try {
      const res = await homeApi.updateSettings({
        name: homeName.trim(),
        timezone,
        descoAccountNo: descoAccountNo.trim(),
        mealSettings,
      });
      dispatch(setHome(res.data.data.home));
      toast.success('Home settings updated successfully.');
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      toast.error(x.response?.data?.message ?? 'Failed to save home settings.');
    } finally {
      setHomeSaving(false);
    }
  }, [homeName, timezone, descoAccountNo, mealSettings, dispatch]);

  const toggleMealSlot = (slot: keyof MealSettings) => {
    setMealSettings((prev) => ({ ...prev, [slot]: !prev[slot] }));
  };

  // Lock Actions
  const handleToggleLock = async (enable: boolean) => {
    if (enable && !isLockEnabled && !user?.hasLockPin) {
      setPinError('Set a PIN first before enabling the lock.');
      setShowChangePinForm(true);
      return;
    }
    if (!enable) {
      const result = await dispatch(serverRemoveLockPin());
      if (serverRemoveLockPin.fulfilled.match(result)) {
        toast.success('App lock disabled.');
      } else {
        toast.error('Failed to disable lock.');
      }
    }
  };

  const handleSavePin = async () => {
    setPinError(null);
    if (newPin.length < 4) {
      setPinError('PIN must be at least 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match.');
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      setPinError('PIN must be numeric digits only.');
      return;
    }

    setPinSaving(true);
    const result = await dispatch(serverSetLockPin({ pin: newPin, timeoutMin: lockTimeoutMin }));
    setPinSaving(false);
    setNewPin('');
    setConfirmPin('');

    if (serverSetLockPin.fulfilled.match(result)) {
      setShowChangePinForm(false);
      toast.success(user?.hasLockPin ? 'PIN updated successfully.' : 'PIN saved — app lock enabled.');
    } else {
      setPinError((result.payload as string) ?? 'Failed to save PIN.');
    }
  };

  const handleTimeoutChange = async (minutes: number) => {
    await dispatch(serverUpdateLockSettings(minutes));
    toast.success(`Auto-lock timeout set to ${minutes === 0 ? 'Never' : `${minutes} min`}`);
  };

  const handleLockNow = () => {
    dispatch(serverLockApp());
    toast.info('App locked.');
  };

  const handleClearLock = async () => {
    const result = await dispatch(serverRemoveLockPin());
    if (serverRemoveLockPin.fulfilled.match(result)) {
      setNewPin('');
      setConfirmPin('');
      setShowChangePinForm(false);
      toast.success('App lock PIN removed.');
    } else {
      toast.error('Failed to remove lock.');
    }
  };

  // Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setPassSaving(true);
    try {
      const res = await authApi.changePassword(currentPassword, newPassword);
      toast.success(res.data.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const x = err as { response?: { data?: { message?: string } } };
      toast.error(x.response?.data?.message || 'Failed to update password.');
    } finally {
      setPassSaving(false);
    }
  };

  // Expense Categories Add/Delete (Admin)
  const handleAddExpenseType = async () => {
    if (!newExpName.trim() || !newExpAmount || isNaN(Number(newExpAmount))) {
      toast.error('Please provide a valid name and default amount.');
      return;
    }
    const updated = [
      ...expenseTypes,
      {
        name: newExpName.trim(),
        category: 'equally_shared',
        defaultAmount: Number(newExpAmount),
      },
    ];
    setSavingExpTypes(true);
    try {
      if (home?.id) {
        const res = await homeApi.updateExpenseTypes(updated);
        dispatch(setHome(res.data.data.home));
        setExpenseTypes(res.data.data.home.expenseTypes ?? []);
        setNewExpName('');
        setNewExpAmount('');
        toast.success('Expense category added.');
      }
    } catch {
      toast.error('Failed to update expense categories.');
    } finally {
      setSavingExpTypes(false);
    }
  };

  const handleDeleteExpenseType = async (index: number) => {
    const updated = expenseTypes.filter((_, i) => i !== index);
    setSavingExpTypes(true);
    try {
      if (home?.id) {
        const res = await homeApi.updateExpenseTypes(updated);
        dispatch(setHome(res.data.data.home));
        setExpenseTypes(res.data.data.home.expenseTypes ?? []);
        toast.success('Expense category removed.');
      }
    } catch {
      toast.error('Failed to remove expense category.');
    } finally {
      setSavingExpTypes(false);
    }
  };

  // Export Data
  const handleExportData = async () => {
    setExportingData(true);
    try {
      const res = await homeApi.exportData();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `mealmate-export-${home?.name || 'data'}-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Home data exported as JSON file!');
    } catch {
      toast.error('Failed to export home data.');
    } finally {
      setExportingData(false);
    }
  };

  // Leave Home
  const handleLeaveHome = async () => {
    if (!window.confirm('Are you sure you want to leave this Home?')) return;
    setLeavingHome(true);
    try {
      await homeApi.leave();
      toast.success('You have left the home.');
      window.location.href = '/onboarding';
    } catch (e: unknown) {
      const x = e as { response?: { data?: { message?: string } } };
      toast.error(x.response?.data?.message || 'Failed to leave home.');
    } finally {
      setLeavingHome(false);
    }
  };

  // Filter tabs based on search
  const tabsList: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = useMemo(
    () => [
      { key: 'appearance', label: 'Appearance & Local', icon: Palette },
      { key: 'security', label: 'Security & App Lock', icon: Shield },
      { key: 'home', label: 'Home & Household', icon: HomeIcon },
      { key: 'notifications', label: 'Notifications', icon: Bell },
      ...(isAdmin ? [{ key: 'financial' as TabKey, label: 'Expense Defaults', icon: Wallet }] : []),
      { key: 'data', label: 'Data & Privacy', icon: Download },
    ],
    [isAdmin],
  );

  // Jump tab if search query matches tab content keyword
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes('theme') || q.includes('dark') || q.includes('light') || q.includes('currency') || q.includes('zone')) {
      setActiveTab('appearance');
    } else if (q.includes('pin') || q.includes('pass') || q.includes('lock') || q.includes('security')) {
      setActiveTab('security');
    } else if (q.includes('invite') || q.includes('qr') || q.includes('meal') || q.includes('slot') || q.includes('name')) {
      setActiveTab('home');
    } else if (q.includes('notif') || q.includes('alert') || q.includes('reminder') || q.includes('sound')) {
      setActiveTab('notifications');
    } else if (q.includes('expense') || q.includes('rule') || q.includes('category') || q.includes('rent')) {
      setActiveTab('financial');
    } else if (q.includes('export') || q.includes('leave') || q.includes('json') || q.includes('delete')) {
      setActiveTab('data');
    }
  }, [searchQuery]);

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* ── Top Header & Global Search Bar ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">System Settings</h1>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin Access
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your personal preferences, security locks, home meal policies, and financial defaults.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search settings (e.g. PIN, QR, Currency)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted/40 pl-9 pr-4 py-2 text-sm transition-colors focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* ── Categorized Navigation Layout ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Navigation Tabs Bar */}
        <div className="md:col-span-3 space-y-1">
          <div className="flex md:flex-col overflow-x-auto pb-2 md:pb-0 gap-1.5 scrollbar-none">
            {tabsList.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all text-left ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Tab Panel Content */}
        <div className="md:col-span-9 space-y-6">
          {/* 🎨 1. APPEARANCE & LOCALIZATION TAB */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card className="border border-border/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Palette className="h-5 w-5 text-primary" /> Visual Appearance
                  </CardTitle>
                  <CardDescription>Customize the theme, layout contrast, and color modes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="text-sm font-medium block mb-2">Color Mode</label>
                    <div className="max-w-md">
                      <ThemeSwitcher />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Globe className="h-5 w-5 text-primary" /> Regional & Display Preferences
                  </CardTitle>
                  <CardDescription>Set your preferred currency symbol, timezone, and date format.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Currency Symbol Selection */}
                  <div>
                    <label className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" /> Preferred Currency Symbol
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleCurrencyChange(c.symbol)}
                          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                            currencySymbol === c.symbol
                              ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <span className="text-base font-extrabold">{c.symbol}</span>
                          <span>{c.code}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      All financial amounts (expenses, deposits, meal rates) will be displayed with {currencySymbol}.
                    </p>
                  </div>

                  {/* Date Format */}
                  <div className="pt-2 border-t border-border/60">
                    <label className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" /> Date Display Format
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'].map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => handleDateFormatChange(fmt)}
                          className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                            dateFormat === fmt
                              ? 'border-primary bg-primary/10 text-primary font-bold'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 🔒 2. SECURITY & APP LOCK TAB */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* App Lock Card */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Shield className="h-5 w-5 text-primary" /> App Lock Protection
                  </CardTitle>
                  <CardDescription>
                    Protect your confidential financial and meal records with a cross-device PIN lock.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {pinError && (
                    <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 text-sm font-medium text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{pinError}</span>
                    </div>
                  )}

                  {/* Toggle Switch */}
                  <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
                    <div>
                      <p className="text-sm font-bold">Enable App Lock</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {user?.hasLockPin
                          ? 'PIN lock is configured & active across all devices'
                          : 'Set a security PIN to turn on app lock'}
                      </p>
                    </div>
                    <button
                      id="lock-toggle"
                      role="switch"
                      aria-checked={isLockEnabled}
                      onClick={() => handleToggleLock(!isLockEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isLockEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          isLockEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Auto-lock Timeout selection */}
                  {user?.hasLockPin && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-muted-foreground" /> Inactivity Auto-Lock Timeout
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {TIMEOUT_OPTIONS.map(({ label, value }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleTimeoutChange(value)}
                            className={`rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-all ${
                              lockTimeoutMin === value
                                ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                                : 'border-border bg-card text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PIN Form / Actions */}
                  {!user?.hasLockPin || showChangePinForm ? (
                    <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-5">
                      <p className="text-sm font-bold flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-primary" />
                        {user?.hasLockPin ? 'Change Security PIN' : 'Configure New PIN'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          id="new-pin"
                          type="password"
                          inputMode="numeric"
                          label="New PIN (4–8 digits)"
                          value={newPin}
                          onChange={(e) => {
                            setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8));
                            setPinError(null);
                          }}
                          placeholder="••••"
                        />
                        <Input
                          id="confirm-pin"
                          type="password"
                          inputMode="numeric"
                          label="Confirm PIN"
                          value={confirmPin}
                          onChange={(e) => {
                            setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8));
                            setPinError(null);
                          }}
                          placeholder="••••"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button onClick={handleSavePin} disabled={pinSaving || newPin.length < 4}>
                          {pinSaving ? 'Saving…' : user?.hasLockPin ? 'Update PIN' : 'Save & Enable Lock'}
                        </Button>
                        {user?.hasLockPin && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowChangePinForm(false);
                              setNewPin('');
                              setConfirmPin('');
                              setPinError(null);
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2.5 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowChangePinForm(true);
                          setPinError(null);
                        }}
                        className="gap-2"
                      >
                        <KeyRound className="h-4 w-4" /> Change PIN
                      </Button>
                      {isLockEnabled && (
                        <Button onClick={handleLockNow} className="gap-2">
                          <Lock className="h-4 w-4" /> Lock App Now
                        </Button>
                      )}
                      <Button variant="destructive" onClick={handleClearLock}>
                        Remove PIN Lock
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Password Change Card */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <KeyRound className="h-5 w-5 text-primary" /> Password & Authentication
                  </CardTitle>
                  <CardDescription>Update your account password to ensure maximum account security.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                    <Input
                      id="current-password"
                      type="password"
                      label="Current Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                    <Input
                      id="new-password"
                      type="password"
                      label="New Password (min 6 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                    <Input
                      id="confirm-password"
                      type="password"
                      label="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                    <Button type="submit" disabled={passSaving} className="mt-2">
                      {passSaving ? 'Updating Password…' : 'Update Password'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 🏠 3. HOME & HOUSEHOLD TAB */}
          {activeTab === 'home' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Home Profile Card */}
              {home ? (
                <Card className="border border-border/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                      <HomeIcon className="h-5 w-5 text-primary" /> Household Profile
                    </CardTitle>
                    <CardDescription>Manage home details, timezone, and invitation credentials.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Invite Code & QR Sharing */}
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold tracking-wider text-primary uppercase">Home Invite Code</p>
                          <div className="flex items-center gap-3 mt-1">
                            <code className="font-mono text-2xl font-extrabold tracking-widest text-foreground">
                              {home.inviteCode}
                            </code>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" onClick={handleCopyCode} className="gap-1.5">
                            {codeCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                            {codeCopied ? 'Copied' : 'Copy Code'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowQRModal(true)} className="gap-1.5">
                            <QrCode className="h-4 w-4" /> QR Code
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={handleRegenerateInviteCode}
                              disabled={regeneratingCode}
                              className="gap-1.5"
                            >
                              <RotateCw className={`h-4 w-4 ${regeneratingCode ? 'animate-spin' : ''}`} />
                              Regenerate
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Share this invite code or QR code with prospective housemates so they can request to join.
                      </p>
                    </div>

                    {/* Admin Editable Fields */}
                    {isAdmin ? (
                      <div className="space-y-5 max-w-md pt-2">
                        <Input
                          id="home-name-input"
                          label="Home Name"
                          value={homeName}
                          onChange={(e) => setHomeName(e.target.value)}
                        />

                        <div>
                          <label className="text-sm font-medium block mb-1.5">Home Timezone</label>
                          <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {TIMEZONES.map((tz) => (
                              <option key={tz} value={tz}>
                                {tz}
                              </option>
                            ))}
                          </select>
                        </div>

                        <Input
                          id="desco-account-no-input"
                          label="DESCO Account Number"
                          value={descoAccountNo}
                          onChange={(e) => setDescoAccountNo(e.target.value)}
                          placeholder="e.g. 1234567890"
                        />

                        {/* Meal Slot Toggles */}
                        <div>
                          <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                            <Utensils className="h-4 w-4 text-primary" /> Active Daily Meal Slots
                          </p>
                          <div className="flex flex-wrap gap-2.5">
                            {(['breakfast', 'lunch', 'dinner'] as (keyof MealSettings)[]).map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => toggleMealSlot(slot)}
                                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold capitalize transition-all ${
                                  mealSettings[slot]
                                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                    : 'border-border bg-card text-muted-foreground opacity-60 hover:opacity-100'
                                }`}
                              >
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    mealSettings[slot] ? 'bg-primary' : 'bg-muted-foreground/30'
                                  }`}
                                />
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>

                        <Button onClick={saveHomeSettings} disabled={homeSaving || !homeName.trim()} className="mt-4">
                          {homeSaving ? 'Saving Home Settings…' : 'Save Home Settings'}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Member View</p>
                        <p className="mt-1">Only the home Admin can update home settings or meal slot configurations.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No active Home associated with your account.
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 🔔 4. NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header Status Bar */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Control exactly which events trigger in-app notifications. Changes save automatically.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {notifStatus === 'saving' && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Save className="h-3.5 w-3.5 animate-pulse" /> Saving…
                    </span>
                  )}
                  {notifSaved && notifStatus === 'idle' && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                    </span>
                  )}
                  {notifError && (
                    <span className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" /> Failed to save
                    </span>
                  )}
                </div>
              </div>

              {/* ── Group 1: Meal & Food ─────────────────────────────────── */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <UtensilsCrossed className="h-4.5 w-4.5 text-orange-500" /> Meal & Food Notifications
                  </CardTitle>
                  <CardDescription>Alerts related to daily meals, guest requests, and food purchases.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {([
                    { type: 'meal_cutoff_warning',         label: 'Meal Cutoff Warning',              desc: 'Reminder before the daily meal registration deadline closes' },
                    { type: 'meal_modified_by_admin',       label: 'Meal Modified by Admin',           desc: 'An admin has changed your meal entry for a given date' },
                    { type: 'guest_meal_requested',         label: 'Guest Meal Requested',             desc: 'A member has submitted a guest meal request for approval' },
                    { type: 'guest_meal_resolved',          label: 'Guest Meal Approved / Rejected',   desc: 'Your guest meal request has been approved or rejected' },
                    { type: 'food_turn',                    label: 'Food Purchase Turn',               desc: 'It is your scheduled turn to buy food supplies for the house' },
                    { type: 'new_food_purchase',            label: 'New Food Purchase Recorded',       desc: 'A member has submitted a food purchase for admin review' },
                    { type: 'food_purchase_status_changed', label: 'Food Purchase Approved / Rejected', desc: 'Admin has approved or rejected a food purchase record' },
                  ] as { type: string; label: string; desc: string }[]).map(({ type, label, desc }) => (
                    <NotifToggleRow
                      key={type}
                      type={type}
                      label={label}
                      desc={desc}
                      checked={notifPrefs[type] !== false}
                      disabled={notifStatus === 'saving'}
                      onChange={(val) => handleNotifToggle(type, val)}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* ── Group 2: Financial ───────────────────────────────────── */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Wallet className="h-4.5 w-4.5 text-emerald-500" /> Financial Notifications
                  </CardTitle>
                  <CardDescription>Dues, deposits, expenses, wallet balance, and refund events.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {([
                    { type: 'new_due',                  label: 'New Due Calculated',          desc: 'Monthly dues have been calculated and posted to your account' },
                    { type: 'deposit_recorded',         label: 'Deposit Recorded',             desc: 'Admin has recorded a deposit to your account' },
                    { type: 'deposit_status_changed',   label: 'Deposit Status Changed',       desc: 'A deposit has been verified, rejected, or updated' },
                    { type: 'new_expense_added',        label: 'New Expense Added',            desc: 'A shared or individual expense has been posted this month' },
                    { type: 'expense_status_changed',   label: 'Expense Paid / Reversed',      desc: 'An expense payment status has been updated' },
                    { type: 'wallet_balance_updated',   label: 'Wallet Balance Updated',       desc: 'Your wallet balance has changed due to a transaction' },
                    { type: 'low_wallet_balance',       label: 'Low Wallet Balance Alert',     desc: 'Your wallet balance has fallen below the minimum threshold' },
                    { type: 'refund_recorded',          label: 'Refund Recorded',              desc: 'Admin has issued a refund to your account' },
                  ] as { type: string; label: string; desc: string }[]).map(({ type, label, desc }) => (
                    <NotifToggleRow
                      key={type}
                      type={type}
                      label={label}
                      desc={desc}
                      checked={notifPrefs[type] !== false}
                      disabled={notifStatus === 'saving'}
                      onChange={(val) => handleNotifToggle(type, val)}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* ── Group 3: Member Events ───────────────────────────────── */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Users className="h-4.5 w-4.5 text-blue-500" /> Member & Membership Events
                  </CardTitle>
                  <CardDescription>Join requests, invitations, role changes, and membership updates.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {([
                    { type: 'member_joined',           label: 'New Member Joined',           desc: 'A new member has been approved and joined the home' },
                    { type: 'member_left',             label: 'Member Left Home',            desc: 'A member has voluntarily left the home' },
                    { type: 'member_removed',          label: 'Member Removed by Admin',     desc: 'Admin has removed a member from the home' },
                    { type: 'join_request_submitted',  label: 'Join Request Submitted',      desc: 'Someone has requested to join your home (admin only)' },
                    { type: 'join_request_approved',   label: 'Join Request Approved',       desc: 'Your join request has been approved by the admin' },
                    { type: 'join_request_rejected',   label: 'Join Request Rejected',       desc: 'Your join request has been rejected by the admin' },
                    { type: 'invitation_received',     label: 'Home Invitation Received',    desc: 'An admin has invited you to join a home' },
                    { type: 'admin_role_transferred',  label: 'Admin Role Transferred',      desc: 'The admin role has been passed to another member' },
                  ] as { type: string; label: string; desc: string }[]).map(({ type, label, desc }) => (
                    <NotifToggleRow
                      key={type}
                      type={type}
                      label={label}
                      desc={desc}
                      checked={notifPrefs[type] !== false}
                      disabled={notifStatus === 'saving'}
                      onChange={(val) => handleNotifToggle(type, val)}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* ── Group 4: Home & System ───────────────────────────────── */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <HomeIcon className="h-4.5 w-4.5 text-violet-500" /> Home & System Notifications
                  </CardTitle>
                  <CardDescription>Month-end cycles, room assignments, and administrative actions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {([
                    { type: 'month_closed',          label: 'Month Closed',               desc: 'Admin has closed the current billing cycle and locked meal records' },
                    { type: 'home_settings_updated', label: 'Home Settings Updated',       desc: 'Admin has changed the home name, timezone, or meal slot configuration' },
                    { type: 'room_assigned',         label: 'Room Assignment Changed',     desc: 'Your room assignment has been updated by admin' },
                    { type: 'room_rent_updated',     label: 'Room Rent Updated',           desc: 'The rent for your assigned room has been changed' },
                    { type: 'admin_override',        label: 'Admin Override / Correction', desc: 'Admin has manually corrected a record on your behalf' },
                  ] as { type: string; label: string; desc: string }[]).map(({ type, label, desc }) => (
                    <NotifToggleRow
                      key={type}
                      type={type}
                      label={label}
                      desc={desc}
                      checked={notifPrefs[type] !== false}
                      disabled={notifStatus === 'saving'}
                      onChange={(val) => handleNotifToggle(type, val)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 💼 5. EXPENSE DEFAULTS TAB (Admin Only) */}
          {activeTab === 'financial' && isAdmin && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card className="border border-border/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Wallet className="h-5 w-5 text-primary" /> Equally Shared Expense Defaults
                  </CardTitle>
                  <CardDescription>
                    Define default recurring monthly costs (Maid, Internet, Electricity, Utilities, Gas, Water) that will be pre-loaded into the Expense page for equal division among members.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Rent Policy Callout */}
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs text-blue-600 dark:text-blue-400 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Building className="h-4 w-4" /> Rent Policy & Automatic Calculation
                    </p>
                    <p>
                      Rent is fixed and calculated automatically for each member based on Room details and room assignments. Rent is NOT added in Settings expense defaults. All categories configured here are saved as <strong>Equally Shared Expenses</strong> and loaded directly into the Expense Page.
                    </p>
                  </div>

                  {/* Expense Items List */}
                  <div className="space-y-3">
                    {expenseTypes.map((exp, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3.5"
                      >
                        <div>
                          <p className="text-sm font-bold">{exp.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Category: <span className="font-semibold text-emerald-500 capitalize">Equally Shared</span> • Default Amount: {currencySymbol}
                            {exp.defaultAmount}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteExpenseType(idx)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {expenseTypes.length === 0 && (
                      <p className="text-sm text-muted-foreground italic py-2">No default shared expense categories configured yet.</p>
                    )}
                  </div>

                  {/* Add New Expense Form */}
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">Add Shared Expense Category</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Expense name (e.g. Internet, Maid, Electricity)"
                        value={newExpName}
                        onChange={(e) => setNewExpName(e.target.value)}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Default amount"
                        value={newExpAmount}
                        onChange={(e) => setNewExpAmount(e.target.value)}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground italic">
                        * Automatically added as an Equally Shared Expense
                      </span>
                      <Button size="sm" onClick={handleAddExpenseType} disabled={savingExpTypes} className="gap-1.5">
                        <Plus className="h-4 w-4" /> Add Shared Category
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Formula & Policy Card */}
              <Card className="border border-border/80 shadow-sm bg-muted/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <Sparkles className="h-4 w-4 text-amber-500" /> Financial Calculation Reference
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    • <strong className="text-foreground">Rent Calculation:</strong> Total Room Rent / Number of Members assigned to that Room.
                  </p>
                  <p>
                    • <strong className="text-foreground">Equally Shared Expenses:</strong> Total Cost / Total Active Members in the Home.
                  </p>
                  <p>
                    • <strong className="text-foreground">Meal Rate Formula:</strong> Total Monthly Food Purchases / Total Monthly House Meals.
                  </p>
                  <p>
                    • <strong className="text-foreground">Member Meal Cost:</strong> Member Meal Count × Meal Rate.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 📦 6. DATA & DANGER ZONE TAB */}
          {activeTab === 'data' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card className="border border-border/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Download className="h-5 w-5 text-primary" /> Backup & Data Export
                  </CardTitle>
                  <CardDescription>
                    Download a full JSON dump of your home's meal logs, expenses, deposits, and dues.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleExportData} disabled={exportingData} className="gap-2">
                    <Download className="h-4 w-4" />
                    {exportingData ? 'Generating Backup...' : 'Export Home Data (.JSON)'}
                  </Button>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="border border-destructive/30 bg-destructive/5 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-destructive">
                    <AlertTriangle className="h-5 w-5" /> Danger Zone
                  </CardTitle>
                  <CardDescription>Irreversible household management actions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isAdmin ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold">Leave Home</p>
                        <p className="text-xs text-muted-foreground">
                          Relinquish your membership in this home. You can join another home afterwards.
                        </p>
                      </div>
                      <Button variant="destructive" size="sm" onClick={handleLeaveHome} disabled={leavingHome}>
                        <LogOut className="h-4 w-4 mr-1.5" /> Leave Home
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      As Admin, you cannot leave the home directly. Transfer ownership first in Members Page if you wish to exit.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Generator Modal */}
      {home && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          inviteCode={home.inviteCode}
          homeName={home.name}
        />
      )}
    </div>
  );
}

function NotifToggleRow({
  type,
  label,
  desc,
  checked,
  disabled,
  onChange,
}: {
  type: string;
  label: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div
      data-notification-type={type}
      className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5 transition-colors hover:bg-muted/30"
    >
      <div className="pr-4">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}


