import { useCallback, useEffect, useState } from 'react';
import { depositApi, walletApi } from '@/api/financeApi';
import { membershipApi } from '@/api/homeApi';
import { useAppSelector } from '@/app/hooks';
import { currentCycle, taka, todayKey } from '@/lib/format';
import type { DepositDto, DepositType, WalletDto } from '@/types/finance';
import type { MemberDto } from '@/types/home';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from '@/components/ui/Table';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Wallet, Plus, Trash2, Layers, List, Calendar, ArrowUpRight, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

const DEPOSIT_TYPES: DepositType[] = ['cash', 'bank', 'mobile', 'other'];

function refId(m: DepositDto['membershipId'] | WalletDto['membershipId']): string {
  return typeof m === 'string' ? m : m._id;
}

export default function DepositsPage() {
  const isAdmin = useAppSelector((s) => s.home.membership?.role === 'admin');
  const defaultCycle = useAppSelector((s) => s.home.home?.currentCycle);
  const [cycle, setCycle] = useState(defaultCycle || currentCycle());
  const [deposits, setDeposits] = useState<DepositDto[]>([]);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [wallets, setWallets] = useState<WalletDto[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Form State (Admin only)
  const [membershipId, setMembershipId] = useState('');
  const [amount, setAmount] = useState('');
  const [depositType, setDepositType] = useState<DepositType>('cash');
  const [date, setDate] = useState(todayKey());

  // View & Filter States
  const [viewMode, setViewMode] = useState<'user_structured' | 'flat_table'>('user_structured');
  const [filterMemberId, setFilterMemberId] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, m, w] = await Promise.all([
        depositApi.list(cycle),
        membershipApi.list('active'),
        walletApi.list(),
      ]);
      setDeposits(d.data.data.deposits);
      setTotal(d.data.data.total);
      setMembers(m.data.data.members);
      setWallets(w.data.data.wallets);
      if (!membershipId && m.data.data.members[0]) setMembershipId(m.data.data.members[0].id);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to load deposits');
    }
  }, [cycle, membershipId]);

  useEffect(() => {
    load();
  }, [load]);

  const memberName = (id: string) => members.find((m) => m.id === id)?.user?.name ?? 'Member';
  const walletBalance = (id: string) =>
    wallets.find((w) => refId(w.membershipId) === id)?.balance ?? 0;

  const submit = async () => {
    const amt = Number(amount);
    if (!membershipId) {
      toast.error('Please select a member.');
      return;
    }
    if (amt <= 0) {
      toast.error('Enter a valid positive amount.');
      return;
    }
    try {
      await depositApi.create({ membershipId, amount: amt, depositType, date });
      toast.success(`Deposit of ${taka(amt)} added to member wallet!`);
      setAmount('');
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      const msg = x.response?.data?.message ?? 'Failed to save deposit';
      toast.error(msg);
      setError(msg);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this deposit? It will reverse the credited amount from the member wallet.')) return;
    try {
      await depositApi.remove(id);
      toast.success('Deposit deleted and wallet credit reversed!');
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      const msg = x.response?.data?.message ?? 'Failed to delete deposit';
      toast.error(msg);
      setError(msg);
    }
  };

  const filteredDeposits = deposits.filter((d) => {
    if (filterMemberId && refId(d.membershipId) !== filterMemberId) return false;
    if (filterMethod && d.depositType !== filterMethod) return false;
    if (filterDate && d.date !== filterDate) return false;
    return true;
  });

  return (
    <div className="space-y-8 max-w-6xl relative pb-20">
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 via-primary/5 to-transparent rounded-full blur-[100px] -z-10 pointer-events-none" />

      {error && (
        <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive border border-destructive/20 shadow-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-background/50 backdrop-blur-xl shadow-lg ring-1 ring-border/50 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Deposits & Wallets</h1>
            <p className="text-sm text-muted-foreground">
              User-structured home deposits and real-time wallet balances
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right mr-2 hidden sm:block">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Total Cycle Deposits</p>
            <p className="text-xl font-bold text-primary">{taka(total)}</p>
          </div>
          <Input
            id="cycle"
            type="month"
            value={cycle}
            onChange={(e) => {
              const newCycle = e.target.value;
              setCycle(newCycle);
              setDate(newCycle === currentCycle() ? todayKey() : `${newCycle}-01`);
            }}
            className="text-lg font-bold bg-background/80 shadow-inner h-12 w-44"
          />
        </div>
      </div>

      {/* Admin Deposit Management Form */}
      {isAdmin ? (
        <Card className="border-0 bg-background/60 backdrop-blur-xl shadow-lg ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="w-5 h-5 text-primary" /> Record Member Deposit
            </CardTitle>
            <CardDescription>
              Deposits directly credit the selected user's wallet balance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end bg-muted/20 p-4 rounded-xl border border-border/50">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Member</label>
                <select
                  className="w-full rounded-xl border border-input bg-background/80 px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                  value={membershipId}
                  onChange={(e) => setMembershipId(e.target.value)}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.user?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Input
                  id="amount"
                  label="Amount (BDT)"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Payment Method</label>
                <select
                  className="w-full rounded-xl border border-input bg-background/80 px-3 py-2.5 text-sm ring-offset-background capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                  value={depositType}
                  onChange={(e) => setDepositType(e.target.value as DepositType)}
                >
                  {DEPOSIT_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Input
                  id="date"
                  type="date"
                  label="Date"
                  value={date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setDate(newDate);
                    const newCycle = newDate.substring(0, 7);
                    if (newCycle && newCycle !== cycle) setCycle(newCycle);
                  }}
                />
              </div>

              <div>
                <Button onClick={submit} className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg hover:shadow-primary/25 transition-all">
                  <ArrowUpRight className="w-4 h-4 mr-2" /> Add to Wallet
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-muted/30 border border-border/50 text-sm text-muted-foreground">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
          <span>Only house admins can record or delete deposits. Regular members can view structured deposits and wallet balances below.</span>
        </div>
      )}

      {/* Controls & View Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-xl border border-border/50">
          <Button
            variant={viewMode === 'user_structured' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('user_structured')}
            className="rounded-lg text-xs font-semibold"
          >
            <Layers className="w-4 h-4 mr-1.5" /> User-Wise Structured
          </Button>
          <Button
            variant={viewMode === 'flat_table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('flat_table')}
            className="rounded-lg text-xs font-semibold"
          >
            <List className="w-4 h-4 mr-1.5" /> All Deposits List
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="rounded-xl border border-input bg-background/80 px-3 py-1.5 text-xs shadow-sm"
            value={filterMemberId}
            onChange={(e) => setFilterMemberId(e.target.value)}
          >
            <option value="">All Members</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user?.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-input bg-background/80 px-3 py-1.5 text-xs capitalize shadow-sm"
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
          >
            <option value="">All Methods</option>
            {DEPOSIT_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-8 text-xs max-w-[130px] rounded-xl"
          />
          {(filterMemberId || filterMethod || filterDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterMemberId('');
                setFilterMethod('');
                setFilterDate('');
              }}
              className="h-8 text-xs px-2"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* User-Wise Structured View */}
      {viewMode === 'user_structured' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {members
            .filter((m) => !filterMemberId || m.id === filterMemberId)
            .map((m) => {
              const userDeposits = filteredDeposits.filter((d) => refId(d.membershipId) === m.id);
              const userTotal = userDeposits.reduce((s, d) => s + d.amount, 0);
              const balance = walletBalance(m.id);

              return (
                <Card key={m.id} className="border-0 bg-background/50 backdrop-blur-xl shadow-lg ring-1 ring-border/50 overflow-hidden flex flex-col justify-between">
                  <CardHeader className="bg-gradient-to-r from-muted/40 via-muted/20 to-transparent border-b border-border/50 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={m.user?.name} avatar={m.user?.avatar} size="md" />
                        <div>
                          <CardTitle className="text-base font-bold">{m.user?.name}</CardTitle>
                          <CardDescription className="text-xs">Active Member</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground font-medium uppercase">Wallet Balance</p>
                        <p className={`text-lg font-extrabold ${balance >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                          {taka(balance)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 flex-1">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-border/30">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">Cycle Deposits</span>
                      <Badge variant="outline" className="font-bold text-primary border-primary/30">
                        {taka(userTotal)}
                      </Badge>
                    </div>

                    {userDeposits.length > 0 ? (
                      <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                        {userDeposits.map((d) => (
                          <div
                            key={d._id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-background border border-border/50">
                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                              <div>
                                <span className="font-medium text-xs block">{d.date}</span>
                                <Badge variant="secondary" className="text-[10px] uppercase py-0 px-1.5">
                                  {d.depositType}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-emerald-500 text-sm">{taka(d.amount)}</span>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                  onClick={() => remove(d._id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-center text-muted-foreground py-6">
                        No deposits recorded for this member in cycle {cycle}.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* Flat Table View */}
      {viewMode === 'flat_table' && (
        <Card className="border-0 bg-background/50 backdrop-blur-xl shadow-xl ring-1 ring-border/50 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-muted/30 to-transparent border-b border-border/50 pb-4">
            <CardTitle className="text-lg">All Deposits Table — {cycle}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredDeposits.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="pl-6 py-4">Member</TableHead>
                    <TableHead className="py-4">Method</TableHead>
                    <TableHead className="py-4">Date</TableHead>
                    <TableHead className="text-right py-4">Amount</TableHead>
                    {isAdmin && <TableHead className="text-right pr-6 py-4 w-24">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeposits.map((d) => (
                    <TableRow key={d._id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6 py-4 font-semibold">{memberName(refId(d.membershipId))}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="capitalize text-xs">
                          {d.depositType}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-xs text-muted-foreground font-medium">{d.date}</TableCell>
                      <TableCell className="text-right py-4 font-bold text-emerald-500">{taka(d.amount)}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right pr-6 py-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            onClick={() => remove(d._id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No deposits match the current filters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
