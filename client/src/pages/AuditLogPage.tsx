import { useCallback, useEffect, useState } from 'react';
import { auditLogApi } from '@/api/financeApi';
import type { AuditLogDto } from '@/types/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/ui/UserAvatar';

const ACTION_COLORS: Record<string, string> = {
  CLOSE_MONTH: 'bg-primary/10 text-primary border-primary/20',
  DELETE_EXPENSE: 'bg-destructive/10 text-destructive border-destructive/20',
  DELETE_DEPOSIT: 'bg-destructive/10 text-destructive border-destructive/20',
  APPROVE_MEMBER: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

function actionBadge(action: string) {
  const cls = ACTION_COLORS[action] ?? 'bg-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${cls}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-BD', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const limit = 25;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: number) => {
    setError(null);
    setLoading(true);
    try {
      const res = await auditLogApi.list({ limit, skip: s });
      setLogs(res.data.data.logs);
      setTotal(res.data.data.total);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(skip); }, [load, skip]);

  return (
    <div className="space-y-6 max-w-6xl">
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}

      <div className="flex items-center justify-between bg-card border border-border p-4 rounded-xl shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          {total} total action{total !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={skip === 0}
            onClick={() => setSkip((s) => Math.max(0, s - limit))}
          >
            &larr; Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={skip + limit >= total}
            onClick={() => setSkip((s) => s + limit)}
          >
            Next &rarr;
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
          ) : logs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id} className="align-top group">
                      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">{formatDate(l.createdAt)}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={l.actorName} size="xs" />
                          <span>{l.actorName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{actionBadge(l.action)}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{l.targetModel}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <div className="max-w-md truncate group-hover:whitespace-normal group-hover:break-all">
                          {l.after
                            ? Object.entries(l.after)
                                .slice(0, 3)
                                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                                .join(' \u00b7 ')
                            : '—'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
