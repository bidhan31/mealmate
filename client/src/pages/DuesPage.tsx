import { useCallback, useEffect, useState } from 'react';
import { dueApi } from '@/api/financeApi';
import { useAppSelector } from '@/app/hooks';
import { currentCycle, taka } from '@/lib/format';
import type { DuesSummary, MemberDueRow } from '@/types/finance';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { SettlementModal } from '@/components/finance/SettlementModal';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export default function DuesPage() {
  const defaultCycle = useAppSelector((s) => s.home.home?.currentCycle);
  const [cycle, setCycle] = useState(defaultCycle || currentCycle());
  const [data, setData] = useState<DuesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [settlementMember, setSettlementMember] = useState<MemberDueRow | null>(null);
  const [settlementMode, setSettlementMode] = useState<'collect' | 'refund'>('collect');
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await dueApi.list(cycle);
      setData(res.data.data);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to load');
    }
  }, [cycle]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenSettlement = (m: MemberDueRow, mode: 'collect' | 'refund') => {
    setSettlementMember(m);
    setSettlementMode(mode);
    setIsSettlementOpen(true);
  };

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <div className="w-48">
          <Input
            id="cycle"
            type="month"
            label="Cycle"
            value={cycle}
            onChange={(e) => setCycle(e.target.value)}
            className='bg-primary/10'
          />
        </div>
        {data && (
          <>
            <div className="mt-6 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2 text-primary text-sm font-medium">
              Meal rate: {taka(data.mealRate)} / meal
            </div>
            <div className="mt-6 rounded-lg bg-muted/50 border border-border px-4 py-2 text-muted-foreground text-sm font-medium">
              {data.homeTotalMeals} meals &middot; {taka(data.totalFoodPurchases)} food
            </div>
          </>
        )}
      </div>

      <Card className="border-0 bg-background/50 backdrop-blur-xl shadow-xl ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/30 to-transparent border-b border-border/50 pb-4">
          <CardTitle>Member Settlement & Wallet Dues — {<span className='text-primary'>[ {cycle}{' '}]</span>}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/20 py-5">
                <TableRow> 
                  <TableHead className="text-center px-5 border border">Member</TableHead>
                  <TableHead className="text-center">Wallet Balance</TableHead>
                  <TableHead className="text-center">Meals (Count)</TableHead>
                  <TableHead className="text-center bg-amber-500/5 border-x border-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">Meal Cost</TableHead>
                  <TableHead className="text-center bg-primary/5 border-r border-primary/10 text-primary font-bold">Food Paid (Credit)</TableHead>
                  <TableHead className="text-center">Paid Expenses</TableHead>
                  <TableHead className="text-center">Unpaid Expenses</TableHead>
                  <TableHead className="text-center">Carryover</TableHead>
                  <TableHead className="text-center font-bold">Net Due Shortfall</TableHead>
                  <TableHead className="text-center font-bold">Settlement Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.members.map((m) => {
                  const wallet = m.walletBalance ?? 0;
                  const paidExp = m.expensePaid ?? 0;
                  const unpaidExp = m.expenseUnpaid ?? 0;
                  const mealFoodDiff = Math.round(m.foodPurchases - m.mealCost);
                  const foodCredit = Math.max(0, m.foodPurchases ?? 0);
                  const unpaidLiabilities = Math.max(0, (m.mealCost + unpaidExp) - foodCredit);
                  const refundableWallet = Math.max(0, wallet - unpaidLiabilities);

                  return (
                    <TableRow key={m.membershipId} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold p-0 w-50">
                        <div className="flex items-center pl-10 gap-2.5 mx-auto">
                          <UserAvatar name={m.userName} size="sm" />
                          <span >{m.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-emerald-500 py-4">
                        {taka(wallet)}
                      </TableCell>
                      <TableCell className="text-center font-medium">{m.mealCount}</TableCell>
                      <TableCell className="text-center  bg-amber-500/5 border-x border-amber-500/10">
                        <span className="block font-semibold text-amber-600 dark:text-amber-400">{taka(m.mealCost)}</span>
                      </TableCell>
                      <TableCell className="text-center bg-primary/5 border-r border-primary/10">
                        <span className="block font-semibold text-primary">{taka(m.foodPurchases)}</span>
                        {/* Diff badge: Food Paid − Meal Cost */}
                        {mealFoodDiff !== 0 && (
                          <span
                            className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              mealFoodDiff > 0
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-destructive/10 text-destructive'
                            }`}
                          >
                            {mealFoodDiff > 0 ? `+${taka(mealFoodDiff)}` : `-${taka(Math.abs(mealFoodDiff))}`}
                          </span>
                        )}
                        {mealFoodDiff === 0 && (
                          <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                            Balanced
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-4 text-emerald-600 font-medium">{taka(paidExp)}</TableCell>
                      <TableCell className="text-right py-4 text-amber-600 font-medium">{taka(unpaidExp)}</TableCell>
                      <TableCell className="text-right py-4 text-muted-foreground">{m.carriedOverBalance !== 0 ? taka(m.carriedOverBalance) : '—'}</TableCell>
                      <TableCell
                        className={`text-right py-4 font-bold text-base ${
                          m.due > 0 ? 'text-destructive' : m.due < 0 ? 'text-emerald-500' : 'text-muted-foreground'
                        }`}
                      >
                        {m.due > 0 ? `Deposit ${taka(m.due)}` : m.due < 0 ? `Surplus ${taka(Math.abs(m.due))}` : 'Covered'}
                      </TableCell>
                      <TableCell className="text-center pr-6 py-4">
                        {m.due > 0 ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 text-xs font-bold shadow-xs"
                            onClick={() => handleOpenSettlement(m, 'collect')}
                          >
                            <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                            Settle Due ({taka(m.due)})
                          </Button>
                        ) : refundableWallet > 0 ? (
                          <Button
                            size="sm"
                            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            onClick={() => handleOpenSettlement(m, 'refund')}
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />
                            Refund Wallet ({taka(refundableWallet)})
                          </Button>
                        ) : m.foodPurchases > m.mealCost ? (
                          <button
                            type="button"
                            onClick={() => handleOpenSettlement(m, 'refund')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                            title="Food purchase excess will auto-deposit to wallet at month-end close"
                          >
                            Food Excess (Auto-deposits next month)
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Settled ✓
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!data || data.members.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                      No members / settlement data for cycle {cycle}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 bg-muted/20 border-t border-border/50 text-xs text-muted-foreground space-y-1">
            <p><strong>Net Due Shortfall:</strong> Unpaid Expenses + Meal Cost − Food Purchases Credit − Available Wallet Balance + Carryover.</p>
            <p>• <span className="text-destructive font-semibold">Settle Due:</span> Record a cash/mobile deposit to clear remaining member liabilities.</p>
            <p>• <span className="text-emerald-600 font-semibold">Refund Wallet:</span> Issue cash refund directly from the member&apos;s wallet advance balance.</p>
            <p>• <span className="text-amber-600 font-semibold">Food Excess Carryover:</span> Excess food purchases cannot be refunded in the same cycle; they automatically deposit into the member&apos;s wallet for next month when the cycle is closed by admin.</p>
          </div>
        </CardContent>
      </Card>

      <SettlementModal
        isOpen={isSettlementOpen}
        onClose={() => setIsSettlementOpen(false)}
        onSuccess={load}
        member={settlementMember}
        cycle={cycle}
        defaultMode={settlementMode}
      />
    </div>
  );
}
