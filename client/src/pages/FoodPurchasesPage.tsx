import { useCallback, useEffect, useState } from 'react';
import { foodPurchaseApi } from '@/api/financeApi';
import { useAppSelector } from '@/app/hooks';
import { currentCycle, taka, todayKey } from '@/lib/format';
import type { FoodPurchaseDto, FoodPurchaseItem } from '@/types/finance';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Check, X, Clock, ShoppingCart, AlertCircle, Trash2, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface DraftItem {
  name: string;
  qty: string;
  price: string;
}

const emptyItem: DraftItem = { name: '', qty: '1', price: '' };

export default function FoodPurchasesPage() {
  const defaultCycle = useAppSelector((s) => s.home.home?.currentCycle);
  const isAdmin = useAppSelector((s) => s.home.membership?.role === 'admin');

  const [cycle, setCycle] = useState(defaultCycle || currentCycle());
  const [purchases, setPurchases] = useState<FoodPurchaseDto[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ ...emptyItem }]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await foodPurchaseApi.list({
        cycle,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setPurchases(res.data.data.purchases);
      setTotal(res.data.data.total);
      setPendingCount(res.data.data.pendingCount ?? 0);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to load food purchases');
    }
  }, [cycle, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const updateItem = (i: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const addRow = () => setItems((prev) => [...prev, { ...emptyItem }]);
  const removeRow = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const draftTotal = items.reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0),
    0,
  );

  const submit = async () => {
    const clean: FoodPurchaseItem[] = items
      .filter((it) => it.name.trim() && Number(it.price) > 0)
      .map((it) => ({ name: it.name.trim(), qty: Number(it.qty) || 1, price: Number(it.price) }));
    if (clean.length === 0) {
      toast.error('Add at least one item with a valid name and price.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await foodPurchaseApi.create(clean, date, note.trim() || undefined);
      toast.success(res.data.message || (isAdmin ? 'Purchase recorded & approved' : 'Purchase request submitted for Admin review'));
      setItems([{ ...emptyItem }]);
      setNote('');
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      toast.error(x.response?.data?.message ?? 'Failed to save purchase');
    } finally {
      setSubmitting(false);
    }
  };

  const review = async (id: string, newStatus: 'approved' | 'rejected') => {
    setReviewingId(id);
    try {
      await foodPurchaseApi.review(id, newStatus);
      toast.success(`Food purchase request ${newStatus === 'approved' ? 'approved' : 'rejected'}`);
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      toast.error(x.response?.data?.message ?? `Failed to ${newStatus} request`);
    } finally {
      setReviewingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this food purchase record?')) return;
    try {
      await foodPurchaseApi.remove(id);
      toast.success('Food purchase deleted');
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      toast.error(x.response?.data?.message ?? 'Failed to delete');
    }
  };

  const buyerName = (p: FoodPurchaseDto): string => {
    if (typeof p.membershipId === 'object' && p.membershipId?.userId?.name) {
      return p.membershipId.userId.name;
    }
    return 'Member';
  };

  const pendingPurchases = purchases.filter((p) => p.status === 'pending');

  return (
    <div className="space-y-6 max-w-5xl">
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}

      {/* Header & Cycle selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-background/50 backdrop-blur-xl p-4 rounded-2xl border border-border/50 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-44">
            <Input
              id="cycle"
              type="month"
              label="Cycle"
              value={cycle}
              onChange={(e) => {
                const newCycle = e.target.value;
                setCycle(newCycle);
                if (newCycle === currentCycle()) {
                  setDate(todayKey());
                } else {
                  setDate(`${newCycle}-01`);
                }
              }}
            />
          </div>
          <div className="mt-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-emerald-500 text-sm font-semibold">
            Approved Total: {taka(total)}
          </div>
        </div>

        {isAdmin && pendingCount > 0 && (
          <div className="mt-6 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 animate-pulse text-amber-500" />
            <span>{pendingCount} Pending Request{pendingCount > 1 ? 's' : ''} for Review</span>
          </div>
        )}
      </div>

      {/* Member submission note banner */}
      {!isAdmin && (
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-sm text-primary flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Food Purchase Review Process</p>
            <p className="text-xs text-primary/80 mt-1">
              Food purchases are made out-of-pocket. Submitting this form creates a request for Admin review. Once approved, the purchase amount will be credited to your meal rate and monthly dues.
            </p>
          </div>
        </div>
      )}

      {/* Admin Quick Review Box */}
      {isAdmin && pendingPurchases.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 backdrop-blur-xl shadow-lg">
          <CardHeader className="pb-3 border-b border-amber-500/20">
            <CardTitle className="text-lg text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Pending Food Purchase Requests ({pendingPurchases.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Review out-of-pocket food purchases submitted by members. Approved purchases increase total food credit and update the meal rate.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-amber-500/10">
                <TableRow>
                  <TableHead className="pl-6 py-3">Buyer</TableHead>
                  <TableHead className="py-3">Date & Items</TableHead>
                  <TableHead className="text-right py-3">Amount</TableHead>
                  <TableHead className="text-right pr-6 py-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPurchases.map((p) => (
                  <TableRow key={p._id} className="hover:bg-amber-500/10 transition-colors">
                    <TableCell className="pl-6 py-3 font-semibold">{buyerName(p)}</TableCell>
                    <TableCell className="py-3">
                      <span className="text-xs text-muted-foreground font-mono mr-2">{p.date}</span>
                      <span className="text-sm font-medium">{p.items.map((it) => `${it.name} \u00d7${it.qty}`).join(', ')}</span>
                      {p.note && <p className="text-xs text-muted-foreground italic mt-0.5">{p.note}</p>}
                    </TableCell>
                    <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400 py-3">
                      {taka(p.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right pr-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={reviewingId === p._id}
                          onClick={() => review(p._id, 'approved')}
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-sm"
                        >
                          <Check className="w-4 h-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewingId === p._id}
                          onClick={() => review(p._id, 'rejected')}
                          className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10 gap-1"
                        >
                          <X className="w-4 h-4" /> Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* New Purchase Form */}
      <Card className="border-0 bg-background/50 backdrop-blur-xl shadow-xl ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="w-5 h-5 text-primary" />
            {isAdmin ? 'Record Food Purchase' : 'Request Out-of-Pocket Food Purchase'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
            <div className="w-48 mb-6">
              <Input 
                id="date" 
                type="date" 
                label="Date" 
                value={date} 
                onChange={(e) => {
                  const newDate = e.target.value;
                  setDate(newDate);
                  const newCycle = newDate.substring(0, 7);
                  if (newCycle && newCycle !== cycle) {
                    setCycle(newCycle);
                  }
                }} 
              />
            </div>

            <div className="space-y-4">
              {items.map((it, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                  <div className="flex-1 min-w-[160px]">
                    <Input
                      id={`name-${i}`}
                      label="Item name"
                      value={it.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      placeholder="e.g. Rice, Fish, Vegetables"
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      id={`qty-${i}`}
                      label="Qty"
                      type="number"
                      value={it.qty}
                      onChange={(e) => updateItem(i, { qty: e.target.value })}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      id={`price-${i}`}
                      label="Price (BDT)"
                      type="number"
                      value={it.price}
                      onChange={(e) => updateItem(i, { price: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" className="mb-0.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeRow(i)}>
                      &times;
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 bg-background p-3 rounded-lg border border-border/50">
              <Button variant="outline" size="sm" onClick={addRow} className="text-primary hover:text-primary">
                + Add item
              </Button>
              <div className="flex-1 min-w-[160px]">
                <Input id="note" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Store name, invoice info..." />
              </div>
              <div className="flex items-center gap-4 ml-auto">
                <span className="text-sm font-semibold">Total: {taka(draftTotal)}</span>
                <Button onClick={submit} disabled={submitting}>
                  {isAdmin ? 'Save & Approve' : 'Submit Request'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchases List */}
      <Card className="border-0 bg-background/50 backdrop-blur-xl shadow-xl ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/30 to-transparent border-b border-border/50 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Food Purchases & Requests — {cycle}</CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                className="rounded-xl border border-input bg-background/80 px-3 py-1.5 text-xs shadow-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved Only</option>
                <option value="pending">Pending Only</option>
                <option value="rejected">Rejected Only</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {purchases.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="pl-6 py-3">Date & Buyer</TableHead>
                  <TableHead className="py-3">Items & Note</TableHead>
                  <TableHead className="py-3 text-center">Status</TableHead>
                  <TableHead className="text-right py-3">Amount</TableHead>
                  {isAdmin && <TableHead className="text-right pr-6 py-3">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => {
                  const status = p.status ?? 'approved';
                  return (
                    <TableRow key={p._id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={buyerName(p)}
                            avatar={typeof p.membershipId === 'object' && p.membershipId?.userId && typeof p.membershipId.userId === 'object' ? (p.membershipId.userId as { avatar?: string }).avatar ?? null : null}
                            size="sm"
                          />
                          <div>
                            <p className="font-semibold">{buyerName(p)}</p>
                            <p className="text-xs text-muted-foreground font-mono">{p.date}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <p className="text-sm font-medium">
                          {p.items.map((it) => `${it.name} \u00d7${it.qty}`).join(', ')}
                        </p>
                        {p.note && <p className="text-xs text-muted-foreground italic mt-0.5">{p.note}</p>}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {status === 'approved' ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-semibold">
                            Approved
                          </Badge>
                        ) : status === 'pending' ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 font-semibold">
                            Pending Review
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 font-semibold">
                            Rejected
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground py-3">
                        {taka(p.totalAmount)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right pr-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {status === 'pending' && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Approve request"
                                  onClick={() => review(p._id, 'approved')}
                                  className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Reject request"
                                  onClick={() => review(p._id, 'rejected')}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete purchase"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => remove(p._id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No food purchases found for cycle {cycle}.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
