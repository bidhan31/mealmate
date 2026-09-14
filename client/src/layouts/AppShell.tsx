import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  CalendarDays,
  ShoppingCart,
  Receipt,
  Wallet,
  CreditCard,
  FileWarning,
  Home,
  Settings,
  LogOut,
  Bell,
  ShieldCheck,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Lock,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { logout } from '@/features/auth/authSlice';
import { clearHome } from '@/features/home/homeSlice';
import { serverLockApp } from '@/features/lockscreen/lockSlice';
import { notificationApi } from '@/api/financeApi';
import type { NotificationDto } from '@/types/finance';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { formatNotificationTime } from '@/lib/format';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/meals', label: 'Meal Management', icon: UtensilsCrossed },
  { to: '/calendar', label: 'Meal Calendar', icon: CalendarDays },
  { to: '/food-purchases', label: 'Food Purchases', icon: ShoppingCart },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/deposits', label: 'Deposits', icon: Wallet },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/dues', label: 'Settlements', icon: FileWarning },
  { to: '/reports', label: 'Reports', icon: Receipt },
  { to: '/members', label: 'Rooms & Members', icon: Home },
  { to: '/essentials', label: 'Essentials', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
];

// Sidebar sizing (expanded width is user-adjustable via drag).
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 400;
const SIDEBAR_DEFAULT_WIDTH = 256;
const SIDEBAR_COLLAPSED_WIDTH = 72;
const WIDTH_KEY = 'sidebar:width';
const COLLAPSED_KEY = 'sidebar:collapsed';

function getNotificationRoute(type: string): string {
  switch (type) {
    case 'food_turn':
    case 'new_food_purchase':
    case 'food_purchase_status_changed':
      return '/food-purchases';
    case 'guest_meal_requested':
    case 'guest_meal_resolved':
    case 'meal_cutoff_warning':
    case 'meal_modified_by_admin':
      return '/meals';
    case 'new_due':
      return '/dues';
    case 'month_closed':
      return '/calendar';
    case 'member_joined':
    case 'join_request_submitted':
    case 'member_left':
    case 'admin_role_transferred':
    case 'room_assigned':
    case 'room_rent_updated':
      return '/members';
    case 'invitation_received':
    case 'home_settings_updated':
      return '/settings';
    case 'new_expense_added':
    case 'expense_status_changed':
      return '/expenses';
    case 'deposit_recorded':
    case 'deposit_status_changed':
    case 'wallet_balance_updated':
    case 'low_wallet_balance':
      return '/deposits';
    case 'admin_override':
      return '/audit-log';
    case 'join_request_approved':
    case 'join_request_rejected':
    case 'member_removed':
    default:
      return '/';
  }
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await notificationApi.list();
      setUnread(res.data.data.unreadCount);
      setNotifications(res.data.data.notifications);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const markRead = async (id: string) => {
    await notificationApi.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAll = async () => {
    await notificationApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const handleNotificationClick = async (n: NotificationDto) => {
    if (!n.read) {
      await markRead(n.id);
    }
    setOpen(false);
    navigate(getNotificationRoute(n.type));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:bg-muted transition-colors"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-11 z-50 w-72 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y divide-border/50">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet.</li>
            ) : (
              notifications.map((n) => (
                <li
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    n.read ? 'hover:bg-muted/50' : 'bg-primary/5 hover:bg-primary/10'
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-muted-foreground/30' : 'bg-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{n.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground opacity-80" title={new Date(n.createdAt).toLocaleString()}>
                      {formatNotificationTime(n.createdAt)}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function ThemePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:bg-muted transition-colors"
      >
        <Palette size={18} />
      </button>
      {open && (
        <div className="absolute left-0 bottom-11 z-50 animate-in fade-in slide-in-from-bottom-2">
          <ThemeSwitcher />
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = useAppSelector((s) => s.home.membership?.role === 'admin');
  const isLockEnabled = useAppSelector((s) => s.lock.isEnabled);
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    return saved >= SIDEBAR_MIN_WIDTH && saved <= SIDEBAR_MAX_WIDTH ? saved : SIDEBAR_DEFAULT_WIDTH;
  });
  const [resizing, setResizing] = useState(false);
  // Mobile off-canvas drawer (independent of desktop collapse).
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem(WIDTH_KEY, String(width));
  }, [width]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Drag-to-resize: listen on the document while the handle is held.
  useEffect(() => {
    if (!resizing) return;
    function onMove(e: MouseEvent) {
      const next = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, e.clientX));
      setWidth(next);
    }
    function onUp() {
      setResizing(false);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    // Prevent text selection while dragging.
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = prev;
    };
  }, [resizing]);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : width;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden z-100">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        style={{ width: sidebarWidth }}
        className={`fixed inset-y-0 left-0 z-50 md:relative shrink-0 border-r border-border bg-card md:bg-card/50 h-screen backdrop-blur-xl flex flex-col max-md:!w-72 ${
          resizing ? '' : 'transition-transform md:transition-[width] duration-200'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} `}
      >
        <div className={`h-16 flex items-center justify-between border-b border-border ${collapsed ? 'md:px-3 px-4' : 'px-4'}`}>
          <div className="flex items-center gap-2.5 text-primary overflow-hidden">
            <UtensilsCrossed size={24} className="shrink-0" />
            <span className={`text-lg font-bold tracking-tight whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>MealMate</span>
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5 ">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  collapsed ? 'md:justify-center' : ''
                } ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink
              to="/audit-log"
              title={collapsed ? 'Audit Log' : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mt-4 ${
                  collapsed ? 'md:justify-center' : ''
                } ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <ShieldCheck size={18} className="shrink-0" />
              <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>Audit Log</span>
            </NavLink>
          )}
        </nav>

        {/* Bottom controls: theme, notifications, lock, user, logout */}
        <div className={`flex items-center justify-around ${collapsed ? 'md:flex-col md:gap-1' : ''} py-2 gap-1 px-2`}>
            <ThemePopover />
            <NotificationBell />
            {isLockEnabled && (
              <button
                onClick={() => dispatch(serverLockApp())}
                className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                title="Lock app"
              >
                <Lock size={17} />
              </button>
            )}
            <div>
              <Link to="/profile" title="View Profile" className="flex shrink-0 transition-transform hover:scale-105 active:scale-95">
                <UserAvatar name={user?.name} avatar={user?.avatar} size="sm" />
              </Link>
            </div>
            <button
              onClick={() => {
                dispatch(logout());
                dispatch(clearHome());
              }}
              className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-destructive transition-colors border border text-center"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
        </div>

        <div className={`flex items-center text-left gap-3 px-4 py-3 border-t border-border ${collapsed ? 'md:flex-col md:gap-1' : ''}`}>
          {user && (
            <Link to="/profile" className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity">
              <UserAvatar name={user.name} avatar={user.avatar} size="sm" />
              <div className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
                <p className="truncate text-sm font-medium">{user.name}</p>
                {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
              </div>
            </Link>
          )}
        </div>


        {/* Drag handle (desktop, expanded only) */}
        {!collapsed && (
          <div
            onMouseDown={() => setResizing(true)}
            className="hidden md:block absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
            role="separator"
            aria-orientation="vertical"
          />
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile hamburger (floating, since the top bar was removed) */}
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden fixed top-4 left-4 z-30 flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card/80 backdrop-blur-md text-muted-foreground hover:bg-muted transition-colors shadow-sm"
          title="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="flex-1 overflow-y-auto px-4 pt-16 md:pt-6">
          <div className="max-w-6xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
