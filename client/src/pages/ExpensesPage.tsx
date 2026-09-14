import { useCallback, useEffect, useMemo, useState } from 'react';
import { expenseApi } from '@/api/financeApi';
import { membershipApi, roomApi } from '@/api/homeApi';
import { useAppSelector } from '@/app/hooks';
import { currentCycle, taka } from '@/lib/format';
import type { ExpenseCategory, ExpenseDto, ExpenseManageResult } from '@/types/finance';
import type { MemberDto, RoomDto } from '@/types/home';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from '@/components/ui/Table';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Zap, Plus, Trash2, Calendar, FileText, Settings2, Wallet, X, Loader2, Receipt, Building, Pencil, Check, ChevronDown, ChevronRight, Search, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_META: Record<ExpenseCategory, { label: string; color: string }> = {
  independently_counted: { label: 'Rent (Independently Counted)', color: 'text-blue-500' },
  equally_shared: { label: 'Equally Shared', color: 'text-green-500' },
  individual: { label: 'Individual', color: 'text-purple-500' },
};

// ── Confirmation Dialog ─────────────────────────────────────────────────
interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
}

const DEFAULT_CONFIRM: ConfirmDialogState = {
  open: false,
  title: '',
  description: '',
  confirmLabel: 'Confirm',
  onConfirm: () => {},
};

function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmDialogState;
  onClose: () => void;
}) {
  if (!state.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border/80 bg-background shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">{state.title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{state.description}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className={`px-5 py-2 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${
              state.confirmClass ?? 'bg-primary hover:bg-primary/90 shadow-primary/25'
            }`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Resolve the assigned member's display name from the (possibly populated) `for` field. */
function ownerName(f: ExpenseDto['for']): string | null {
  if (!f) return null;
  if (typeof f === 'string') return null;
  const uid = f.userId;
  if (uid && typeof uid !== 'string') return uid.name ?? null;
  return null;
}

interface CategoryFilterState {
  status: 'all' | 'paid' | 'unpaid';
  search: string;
  memberId: string;
  sort: 'default' | 'amount_asc' | 'amount_desc' | 'purpose';
}

export default function ExpensesPage() {
  const isAdmin = useAppSelector((s) => s.home.membership?.role === 'admin');
  const home = useAppSelector((s) => s.home.home);

  const defaultCycle = home?.currentCycle;
  const [cycle, setCycle] = useState(defaultCycle || currentCycle());
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [manage, setManage] = useState<ExpenseManageResult | null>(null);
  const [total, setTotal] = useState(0);
  const [paidTotal, setPaidTotal] = useState(0);
  const [unpaidTotal, setUnpaidTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [memberFilterStatus, setMemberFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
  independently_counted: true,
  equally_shared: true,
  individual: true,
});

  // Per-category filter state
  const [catFilters, setCatFilters] = useState<Record<string, CategoryFilterState>>({});

  const getFilter = (type: string): CategoryFilterState =>
    catFilters[type] || { status: 'all', search: '', memberId: 'all', sort: 'default' };

  const updateFilter = (type: string, updates: Partial<CategoryFilterState>) => {
    setCatFilters((prev) => ({
      ...prev,
      [type]: { ...getFilter(type), ...updates },
    }));
  };

  const resetFilter = (type: string) => {
    setCatFilters((prev) => ({
      ...prev,
      [type]: { status: 'all', search: '', memberId: 'all', sort: 'default' },
    }));
  };

  const toggleCategoryCollapse = (type: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const [members, setMembers] = useState<MemberDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);

  const [initLoading, setInitLoading] = useState<string | null>(null);

  // Edit state (admin, unpaid only)
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editPurpose, setEditPurpose] = useState('');

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(DEFAULT_CONFIRM);

  // Build default shared list from home.expenseTypes (equally_shared only; rent excluded)
  const defaultSharedList = useMemo(() => {
    const types = home?.expenseTypes ?? [];
    // Only include equally_shared types (excludes rent/independently_counted and individual)
    const shared = types.filter((t) => t.category === 'equally_shared');
    if (shared.length > 0) {
      return shared.map((t) => ({ purpose: t.name, amount: t.defaultAmount > 0 ? String(t.defaultAmount) : '' }));
    }
    // Fallback defaults
    return [
      { purpose: 'Water', amount: '' },
      { purpose: 'Electricity', amount: '' },
      { purpose: 'Gas', amount: '' },
      { purpose: 'Internet', amount: '' },
    ];
  }, [home?.expenseTypes]);

  // Shared Expenses State - pre-loaded from settings defaults
  const [sharedList, setSharedList] = useState<{ purpose: string; amount: string }[]>(defaultSharedList);

  // Sync sharedList when home expense types change (e.g. after settings update)
  useEffect(() => {
    setSharedList(defaultSharedList);
  }, [defaultSharedList]);

  // Individual Expense State
  const [customPurpose, setCustomPurpose] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customFor, setCustomFor] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const reqs = [expenseApi.list(cycle), membershipApi.list(), roomApi.list()] as const;
      const [res, memRes, roomRes] = await Promise.all(reqs);
      setExpenses(res.data.data.expenses);
      setTotal(res.data.data.total);
      setPaidTotal(res.data.data.paidTotal);
      setUnpaidTotal(res.data.data.unpaidTotal);
      setMembers(memRes.data.data.members.filter((m) => m.status === 'active'));
      setRooms(roomRes.data.data.rooms);
      if (isAdmin) {
        const mng = await expenseApi.manage(cycle);
        setManage(mng.data.data);
      }
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to load expenses');
    }
  }, [cycle, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    try {
      await expenseApi.remove(id);
      toast.success('Expense deleted successfully');
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      const msg = x.response?.data?.message ?? 'Failed to delete';
      toast.error(msg);
      setError(msg);
    }
  };

  const startEdit = (ex: ExpenseDto) => {
    setEditId(ex._id);
    setEditAmount(String(ex.amount));
    setEditPurpose(ex.purpose);
  };

  const saveEdit = async (id: string) => {
    try {
      await expenseApi.update(id, { amount: Number(editAmount), purpose: editPurpose.trim() });
      toast.success('Expense updated successfully');
      setEditId(null);
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      const msg = x.response?.data?.message ?? 'Failed to update';
      toast.error(msg);
      setError(msg);
    }
  };

  // ── Actual initialize implementations (called after confirmation) ──────
  const doInitRent = async () => {
    setInitLoading('rent');
    try {
      await expenseApi.initializeRent({ cycle });
      toast.success('Rent dues initialized for all members!');
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      const msg = x.response?.data?.message ?? 'Failed to initialize rent';
      toast.error(msg);
      setError(msg);
    } finally {
      setInitLoading(null);
    }
  };

  const doInitShared = async (validExpenses: { purpose: string; amount: number }[]) => {
    setInitLoading('shared');
    try {
      await expenseApi.initializeShared({ cycle, expenses: validExpenses });
      toast.success('Shared dues initialized for all members!');
      setSharedList((prev) => prev.map((p) => ({ ...p, amount: '' })));
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      const msg = x.response?.data?.message ?? 'Failed to initialize shared expenses';
      toast.error(msg);
      setError(msg);
    } finally {
      setInitLoading(null);
    }
  };

  const doInitIndividual = async (purpose: string, amount: number, forId: string) => {
    setInitLoading('individual');
    try {
      await expenseApi.initializeIndividual({ cycle, purpose, amount, for: forId });
      toast.success(`Custom expense "${purpose}" initialized!`);
      setCustomPurpose('');
      setCustomAmount('');
      setCustomFor('');
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      const msg = x.response?.data?.message ?? 'Failed to initialize individual expense';
      toast.error(msg);
      setError(msg);
    } finally {
      setInitLoading(null);
    }
  };

  // ── Confirmation-gated handlers ─────────────────────────────────────────
  const handleInitRent = () => {
    setConfirmDialog({
      open: true,
      title: 'Initialize Rent Dues?',
      description: `This will create rent expense entries for all members in cycle ${cycle} based on their room assignments. This action cannot be undone — existing rent entries for this cycle may be duplicated.`,
      confirmLabel: 'Yes, Initialize Rent',
      confirmClass: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/25',
      onConfirm: doInitRent,
    });
  };

  const handleInitShared = () => {
    const validExpenses = sharedList
      .filter((s) => s.purpose.trim() !== '' && Number(s.amount) > 0)
      .map((s) => ({ purpose: s.purpose.trim(), amount: Number(s.amount) }));

    if (validExpenses.length === 0) {
      toast.error('Please add at least one valid shared expense.');
      setError('Please add at least one valid shared expense.');
      return;
    }

    const summary = validExpenses.map((v) => `${v.purpose} (${taka(v.amount)})`).join(', ');
    setConfirmDialog({
      open: true,
      title: 'Initialize Shared Expenses?',
      description: `This will equally split the following expenses among all active members for cycle ${cycle}: ${summary}. Duplicate entries may be created if already initialized.`,
      confirmLabel: 'Yes, Initialize Shared',
      confirmClass: 'bg-green-500 hover:bg-green-600 shadow-green-500/25',
      onConfirm: () => doInitShared(validExpenses),
    });
  };

  const handleInitIndividual = () => {
    if (!customPurpose.trim() || Number(customAmount) <= 0 || !customFor) {
      toast.error('Please fill in all fields for the individual expense.');
      setError('Please fill in all fields for the individual expense.');
      return;
    }

    const memberName = members.find((m) => m.id === customFor)?.user?.name ?? 'the selected member';
    setConfirmDialog({
      open: true,
      title: 'Initialize Individual Expense?',
      description: `This will create an individual expense of ${taka(Number(customAmount))} for "${customPurpose.trim()}" assigned to ${memberName} for cycle ${cycle}.`,
      confirmLabel: 'Yes, Initialize',
      confirmClass: 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/25',
      onConfirm: () =>
        doInitIndividual(customPurpose.trim(), Number(customAmount), customFor),
    });
  };

  const totalRent = rooms.reduce((acc, r) => acc + r.totalRent, 0);

  // Row renderer shared by admin (grouped) and member (flat) views.
  const renderRow = (ex: ExpenseDto) => {
    const owner = ownerName(ex.for) ?? 'All Members';
    const isEditing = editId === ex._id;
    const isPaid = ex.status === 'paid';
    return (
      <TableRow key={ex._id} className="hover:bg-muted/30 transition-colors">
        <TableCell className="pl-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              {isEditing ? (
                <Input value={editPurpose} onChange={(e) => setEditPurpose(e.target.value)} className="h-8 mb-1 w-40" />
              ) : (
                <span className="font-semibold capitalize text-[15px]">{ex.purpose || 'Expense'}</span>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <UserAvatar name={owner === 'All Members' ? null : owner} size="xs" />
                <p className="text-xs text-muted-foreground font-medium">
                  For: {ex.type === 'equally_shared' && !ownerName(ex.for) ? 'All (Equally Shared)' : owner}
                  {ex.note ? ` • ${ex.note}` : ''}
                </p>
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="py-4">
          <Badge
            variant={isPaid ? 'default' : 'outline'}
            className={isPaid ? 'bg-green-500/15 text-green-600 border-green-500/30' : 'text-amber-600 border-amber-500/40'}
          >
            {isPaid ? 'Paid' : 'Unpaid'}
          </Badge>
        </TableCell>
        <TableCell className="py-4">
          {isEditing ? (
            <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="h-8 w-24" />
          ) : (
            <span className="font-bold text-foreground text-[15px]">{taka(ex.amount)}</span>
          )}
        </TableCell>
        {isAdmin && (
          <TableCell className="text-right pr-6 py-4">
            {isPaid ? (
              <span className="text-xs text-muted-foreground italic">Reverse payment to edit</span>
            ) : isEditing ? (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" className="text-green-600" onClick={() => saveEdit(ex._id)}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" className="opacity-60 hover:opacity-100" onClick={() => startEdit(ex)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-60 hover:opacity-100"
                  onClick={() => remove(ex._id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl relative pb-24">
      <ConfirmDialog
        state={confirmDialog}
        onClose={() => setConfirmDialog(DEFAULT_CONFIRM)}
      />
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 via-primary/5 to-transparent rounded-full blur-[100px] -z-10 pointer-events-none" />

      {error && (
        <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive border border-destructive/20 shadow-sm flex items-center">
          <span className="bg-destructive/20 p-1 rounded-full mr-3">
            <X className="w-4 h-4" />
          </span>
          {error}
        </div>
      )}

      {/* ── Active Cycle Header ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-background/50 backdrop-blur-xl shadow-lg ring-1 ring-border/50 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{isAdmin ? 'Expense Management' : 'My Expenses'}</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Manage house expenses by category' : 'Your assigned expenses and their status'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Total</p>
            <p className="text-xl font-bold text-primary">{taka(total)}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Unpaid</p>
            <p className="text-xl font-bold text-amber-600">{taka(unpaidTotal)}</p>
          </div>
          <Input
            id="cycle"
            type="month"
            value={cycle}
            onChange={(e) => setCycle(e.target.value)}
            className="text-lg font-bold bg-background/80 shadow-inner h-12 w-48"
          />
        </div>
      </div>

      {/* ── Operations Hubs (admin) ──────────────── */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Independently Counted (Rent) */}
          <Card className="border-0 bg-background/60 backdrop-blur-xl shadow-lg ring-1 ring-border/50 flex flex-col">
            <CardHeader className="bg-gradient-to-br from-blue-500/10 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-500" /> Rent (Independently Counted)
              </CardTitle>
              <CardDescription>Automatically calculated based on room configuration.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between p-6">
              <div className="mb-6">
                <div className="text-center py-6 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Total House Rent</p>
                  <h2 className="text-4xl font-extrabold text-blue-500">{taka(totalRent)}</h2>
                </div>
              </div>
              <Button
                onClick={handleInitRent}
                disabled={initLoading === 'rent' || rooms.length === 0}
                className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-blue-500/25 transition-all"
              >
                {initLoading === 'rent' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Zap className="w-5 h-5 mr-2" />}
                Initialize Rent Due
              </Button>
            </CardContent>
          </Card>

          {/* Equally Shared */}
          <Card className="border-0 bg-background/60 backdrop-blur-xl shadow-lg ring-1 ring-border/50 flex flex-col">
            <CardHeader className="bg-gradient-to-br from-green-500/10 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-green-500" /> Equally Shared
              </CardTitle>
              <CardDescription>Divided equally among all active members.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between p-6">
              <div className="space-y-3 mb-6 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                {sharedList.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={item.purpose}
                      onChange={(e) => {
                        const copy = [...sharedList];
                        copy[idx].purpose = e.target.value;
                        setSharedList(copy);
                      }}
                      placeholder="Purpose (e.g. Water)"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={item.amount}
                      onChange={(e) => {
                        const copy = [...sharedList];
                        copy[idx].amount = e.target.value;
                        setSharedList(copy);
                      }}
                      placeholder="Amount"
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSharedList(sharedList.filter((_, i) => i !== idx))}
                      className="text-destructive/50 hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={() => setSharedList([...sharedList, { purpose: '', amount: '' }])}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Expense Field
                </Button>
              </div>

              {/* Live Total Summary */}
              {(() => {
                const validItems = sharedList.filter((s) => s.purpose.trim() !== '' && Number(s.amount) > 0);
                const sharedTotal = validItems.reduce((sum, s) => sum + Number(s.amount), 0);
                const memberCount = members.length;
                if (sharedTotal === 0) return null;
                return (
                  <div className="mb-3 rounded-xl bg-green-500/8 border border-green-500/20 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Shared Cost</p>
                      <p className="text-2xl font-extrabold text-green-500 leading-tight">{taka(sharedTotal)}</p>
                    </div>
                    {memberCount > 0 && (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Per Member</p>
                        <p className="text-2xl font-extrabold text-foreground leading-tight">
                          {taka(Math.ceil(sharedTotal / memberCount))}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{memberCount} active members</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              <Button
                onClick={handleInitShared}
                disabled={initLoading === 'shared'}
                className="w-full h-12 bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-green-500/25 transition-all"
              >
                {initLoading === 'shared' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Zap className="w-5 h-5 mr-2" />}
                Initialize Shared Due
              </Button>
            </CardContent>
          </Card>


          {/* Individual */}
          <Card className="border-0 bg-background/60 backdrop-blur-xl shadow-lg ring-1 ring-border/50 flex flex-col">
            <CardHeader className="bg-gradient-to-br from-purple-500/10 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-500" /> Individual
              </CardTitle>
              <CardDescription>Custom expenses for specific members.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Member</label>
                  <select
                    className="w-full rounded-xl border border-input bg-background/80 px-4 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                    value={customFor}
                    onChange={(e) => setCustomFor(e.target.value)}
                  >
                    <option value="">Select Member...</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.user?.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Purpose (e.g. Garage)</label>
                  <Input value={customPurpose} onChange={(e) => setCustomPurpose(e.target.value)} placeholder="Enter purpose" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount</label>
                  <Input type="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="0" />
                </div>
              </div>
              <Button
                onClick={handleInitIndividual}
                disabled={initLoading === 'individual'}
                className="w-full h-12 bg-purple-500 hover:bg-purple-600 text-white shadow-lg hover:shadow-purple-500/25 transition-all"
              >
                {initLoading === 'individual' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Zap className="w-5 h-5 mr-2" />}
                Initialize Custom Due
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Per-Member Expense Summary Card ────────────────────────── */}
      {isAdmin && manage && manage.byMember && manage.byMember.length > 0 && (
        <Card className="border-0 bg-background/60 backdrop-blur-xl shadow-lg ring-1 ring-border/50 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-muted/30 to-transparent border-b border-border/50 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" /> Member Expense Totals ({cycle})
                </CardTitle>
                <CardDescription className="text-xs">
                  Aggregated active, paid, and unpaid expenses per member across all categories for this cycle.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-semibold">
                {manage.byMember.length} Active Members
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="pl-6 py-3">Member</TableHead>
                  <TableHead className="py-3 text-center">Rent Share</TableHead>
                  <TableHead className="py-3 text-center">Shared Expenses</TableHead>
                  <TableHead className="py-3 text-center">Individual Dues</TableHead>
                  <TableHead className="py-3 text-center font-semibold">Total Expenses</TableHead>
                  <TableHead className="py-3 text-center text-green-600 font-semibold">Paid</TableHead>
                  <TableHead className="pr-6 py-3 text-center text-amber-600 font-semibold">Unpaid Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manage.byMember.map((m) => (
                  <TableRow key={m.membershipId} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="pl-6 py-3 font-semibold">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={m.userName} size="sm" />
                        <span>{m.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-center text-muted-foreground">{taka(m.rent)}</TableCell>
                    <TableCell className="py-3 text-center text-muted-foreground">{taka(m.shared)}</TableCell>
                    <TableCell className="py-3 text-center text-muted-foreground">{taka(m.individual)}</TableCell>
                    <TableCell className="py-3 text-center font-bold text-foreground">{taka(m.total)}</TableCell>
                    <TableCell className="py-3 text-center font-bold text-green-600">{taka(m.paid)}{' '}{'['+taka((m.paid/m.total)*100) +"%]"}</TableCell>
                    <TableCell className="pr-6 py-3 text-center font-bold text-amber-600">{taka(m.unpaid)}<span className='text-red-600'>{' '}{'['+taka((m.unpaid/m.total)*100) +"%]"}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Records ──────────────────────────────── */}
      {isAdmin && manage ? (
        // Admin: grouped by category with management controls (Collapsible + Individual Filters).
        <div className="space-y-6">
          {manage.categories.map((cat) => {
            const isCollapsed = Boolean(collapsedCategories[cat.type]);
            const filter = getFilter(cat.type);

            const filteredItems = cat.items
              .filter((ex) => {
                if (filter.status === 'paid' && ex.status !== 'paid') return false;
                if (filter.status === 'unpaid' && ex.status !== 'unpaid') return false;
                if (filter.search.trim()) {
                  const q = filter.search.toLowerCase();
                  const pMatch = (ex.purpose || '').toLowerCase().includes(q);
                  const owner = (ownerName(ex.for) || '').toLowerCase();
                  const nMatch = (ex.note || '').toLowerCase().includes(q);
                  if (!pMatch && !owner.includes(q) && !nMatch) return false;
                }
                if (filter.memberId !== 'all') {
                  const forId = typeof ex.for === 'string' ? ex.for : ex.for?._id;
                  if (forId !== filter.memberId) return false;
                }
                return true;
              })
              .sort((a, b) => {
                if (filter.sort === 'amount_asc') return a.amount - b.amount;
                if (filter.sort === 'amount_desc') return b.amount - a.amount;
                if (filter.sort === 'purpose') return (a.purpose || '').localeCompare(b.purpose || '');
                return 0;
              });

            const isFilterActive =
              filter.status !== 'all' || filter.search !== '' || filter.memberId !== 'all' || filter.sort !== 'default';

            return (
              <Card key={cat.type} className="border-0 bg-background/50 backdrop-blur-xl shadow-xl ring-1 ring-border/50 overflow-hidden transition-all duration-200">
                <CardHeader
                  onClick={() => toggleCategoryCollapse(cat.type)}
                  className="bg-gradient-to-r from-muted/30 to-transparent border-b border-border/50 pb-4 cursor-pointer hover:bg-muted/40 transition-colors select-none group"
                  title={`Click to ${collapsedCategories[cat.type] ? "Expand" : "Collapse"}`}
                >
                  <div className="flex flex-wrap justify-between items-center gap-3"
                  >
                    <CardTitle 
                    className={`flex items-center gap-2 text-lg ${CATEGORY_META[cat.type].color}`}
                    >
                      <div className="p-1 rounded-md bg-muted/50 group-hover:bg-muted transition-colors">
                        {isCollapsed ? (
                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-transform" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-transform" />
                        )}
                      </div>
                      <FileText className="w-5 h-5" /> {CATEGORY_META[cat.type].label}
                      <Badge variant="outline" className="ml-2 text-xs font-semibold">
                        {cat.count} items
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm font-medium">
                      <span className="text-muted-foreground">Total: <b className="text-foreground">{taka(cat.total)}</b></span>
                      <span className="text-green-600 font-semibold">Paid: {taka(cat.paid)}</span>
                      <span className="text-amber-600 font-semibold">Unpaid: {taka(cat.unpaid)}</span>
                      <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/50 hidden sm:inline-block">
                        {isCollapsed ? 'Expand' : 'Collapse'}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent className="p-0 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* Category Filter Toolbar */}
                    {cat.items.length > 0 && (
                      <div className="p-3 bg-muted/20 border-b border-border/50 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                          {/* Search */}
                          <div className="relative flex-1 min-w-[160px] max-w-xs">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Search purpose or name..."
                              value={filter.search}
                              onChange={(e) => updateFilter(cat.type, { search: e.target.value })}
                              className="pl-8 h-8 text-xs bg-background/80"
                            />
                          </div>

                          {/* Status */}
                          <select
                            value={filter.status}
                            onChange={(e) => updateFilter(cat.type, { status: e.target.value as 'all' | 'paid' | 'unpaid' })}
                            className="h-8 rounded-xl border border-input bg-background/80 px-2.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          >
                            <option value="all">All Statuses</option>
                            <option value="paid">Paid Only</option>
                            <option value="unpaid">Unpaid Only</option>
                          </select>

                          {/* Member */}
                          <select
                            value={filter.memberId}
                            onChange={(e) => updateFilter(cat.type, { memberId: e.target.value })}
                            className="h-8 rounded-xl border border-input bg-background/80 px-2.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          >
                            <option value="all">All Members</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.user?.name ?? 'Member'}
                              </option>
                            ))}
                          </select>

                          {/* Sort */}
                          <select
                            value={filter.sort}
                            onChange={(e) => updateFilter(cat.type, { sort: e.target.value as 'default' | 'amount_asc' | 'amount_desc' | 'purpose' })}
                            className="h-8 rounded-xl border border-input bg-background/80 px-2.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          >
                            <option value="default">Default Sort</option>
                            <option value="amount_desc">Amount: High to Low</option>
                            <option value="amount_asc">Amount: Low to High</option>
                            <option value="purpose">Purpose: A-Z</option>
                          </select>

                          {isFilterActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resetFilter(cat.type)}
                              className="h-8 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" /> Reset
                            </Button>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                          Showing <b className="text-foreground">{filteredItems.length}</b> of {cat.items.length} items
                        </div>
                      </div>
                    )}

                    {filteredItems.length > 0 ? (
                      <Table>
                        <TableHeader className="bg-muted/20">
                          <TableRow>
                            <TableHead className="w-[350px] py-3 pl-6">Details</TableHead>
                            <TableHead className="py-3">Status</TableHead>
                            <TableHead className="py-3">Amount</TableHead>
                            <TableHead className="text-right py-3 pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>{filteredItems.map(renderRow)}</TableBody>
                      </Table>
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {cat.items.length === 0
                          ? 'No expenses in this category yet.'
                          : 'No expenses match the selected filters.'}
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        // Member: only their own assigned expenses (server-scoped) with status.
        <Card className="border-0 bg-background/50 backdrop-blur-xl shadow-2xl ring-1 ring-border/50 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-muted/30 to-transparent border-b border-border/50 pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="w-5 h-5 text-primary" /> My Expenses — {cycle}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <select
                  className="rounded-xl border border-input bg-background/80 px-3 py-1.5 text-xs shadow-sm"
                  value={memberFilterStatus}
                  onChange={(e) => setMemberFilterStatus(e.target.value as 'all' | 'paid' | 'unpaid')}
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid Only</option>
                  <option value="unpaid">Unpaid Only</option>
                </select>
                <div className="flex gap-3 text-sm font-semibold">
                  <span className="text-green-600">Paid: {taka(paidTotal)}</span>
                  <span className="text-amber-600">Unpaid: {taka(unpaidTotal)}</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {expenses.filter((e) => memberFilterStatus === 'all' || e.status === memberFilterStatus).length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="w-[350px] py-4 pl-6">Details</TableHead>
                    <TableHead className="py-4">Status</TableHead>
                    <TableHead className="py-4">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses
                    .filter((e) => memberFilterStatus === 'all' || e.status === memberFilterStatus)
                    .map(renderRow)}
                </TableBody>
              </Table>
            ) : (
              <div className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                  <Receipt className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-medium">
                  {expenses.length === 0
                    ? 'No expenses assigned to you for this cycle.'
                    : `No ${memberFilterStatus} expenses found.`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
