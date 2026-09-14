import { useCallback, useEffect, useState } from 'react';
import { paymentApi } from '@/api/financeApi';
import { membershipApi } from '@/api/homeApi';
import { useAppSelector } from '@/app/hooks';
import { currentCycle, taka } from '@/lib/format';
import type { PaymentDto, PaymentStatus } from '@/types/finance';
import type { MemberDto } from '@/types/home';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from '@/components/ui/Table';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { toast } from 'sonner';

const STATUSES: PaymentStatus[] = ['paid', 'rejected', 'reversed'];

function refId(m: PaymentDto['membershipId']): string {
  return typeof m === 'string' ? m : m._id;
}
function refName(m: PaymentDto['membershipId']): string | undefined {
  return typeof m === 'string' ? undefined : m.userId?.name;
}

const STATUS_BADGE: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  reversed: 'bg-muted text-muted-foreground border-border',
};

export default function PaymentsPage() {
  const isAdmin = useAppSelector((s) => s.home.membership?.role === 'admin');
  const defaultCycle = useAppSelector((s) => s.home.home?.currentCycle);
  const [cycle, setCycle] = useState(defaultCycle || currentCycle());
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Filters
  const [filterMemberId, setFilterMemberId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, m] = await Promise.all([
        paymentApi.list({
          cycle,
          membershipId: filterMemberId || undefined,
          status: filterStatus || undefined,
        }),
        membershipApi.list('active'),
      ]);
      setPayments(p.data.data.payments);
      setTotalPaid(p.data.data.totalPaid);
      setMembers(m.data.data.members);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to load');
    }
  }, [cycle, filterMemberId, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const memberName = (p: PaymentDto) =>
    refName(p.membershipId) ??
    members.find((m) => m.id === refId(p.membershipId))?.user?.name ??
    'Member';

  const reverse = async (id: string) => {
    const reason = window.prompt('Reason for reversing this payment? (optional)') ?? undefined;
    if (reason === undefined && !window.confirm('Reverse this payment and refund the wallet?')) return;
    setBusy(id);
    try {
      await paymentApi.reverse(id, reason);
      toast.success('Payment reversed and wallet refunded successfully!');
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      const msg = x.response?.data?.message ?? 'Failed to reverse payment';
      toast.error(msg);
      setError(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <div className="w-48">
          <Input
            id="cycle"
            type="month"
            label="Cycle"
            value={cycle}
            onChange={(e) => setCycle(e.target.value)}
          />
        </div>
        <div className="mt-6 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2 text-primary text-sm font-medium">
          Total paid: {taka(totalPaid)}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Payments — {cycle}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <select
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background"
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
              )}
              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background capitalize"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </select>
              {(filterMemberId || filterStatus) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterMemberId('');
                    setFilterStatus('');
                  }}
                  className="h-8 text-xs px-2"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member & Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {isAdmin && <TableHead className="text-right w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={memberName(p)} size="sm" />
                        <div>
                          <p className="font-medium">{memberName(p)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-1 items-center">
                            <span className="bg-muted px-1.5 py-0.5 rounded">{p.purpose}</span>
                            <span className="bg-muted px-1.5 py-0.5 rounded">
                              {new Date(p.createdAt).toLocaleDateString()}
                            </span>
                            {p.status === 'rejected' && p.reason && (
                              <span className="text-destructive">{p.reason}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize border ${STATUS_BADGE[p.status]}`}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        p.status === 'paid' ? 'text-primary' : 'text-muted-foreground line-through'
                      }`}
                    >
                      {taka(p.amount)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {p.status === 'paid' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={busy === p._id}
                            onClick={() => reverse(p._id)}
                          >
                            {busy === p._id ? '...' : 'Reverse'}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No payments match the current filters.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
