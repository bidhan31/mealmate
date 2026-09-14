import { useState, useEffect, useRef, useCallback } from 'react';
import type { MemberDueRow, DepositType, RefundPreviewDto, RefundValidationDto } from '@/types/finance';
import { depositApi, refundApi } from '@/api/financeApi';
import { taka } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  X,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  Loader2,
  TrendingDown,
  Wallet,
  Info,
} from 'lucide-react';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: MemberDueRow | null;
  cycle: string;
  defaultMode?: 'collect' | 'refund';
}

export function SettlementModal({
  isOpen,
  onClose,
  onSuccess,
  member,
  cycle,
  defaultMode = 'collect',
}: SettlementModalProps) {
  const [mode, setMode] = useState<'collect' | 'refund'>(defaultMode);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<DepositType>('cash');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview (loaded once on open)
  const [preview, setPreview] = useState<RefundPreviewDto | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Real-time refund validation (debounced)
  const [validation, setValidation] = useState<RefundValidationDto | null>(null);
  const [validating, setValidating] = useState(false);
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load live snapshot when modal opens
  useEffect(() => {
    if (!isOpen || !member) return;
    setPreview(null);
    setValidation(null);
    setPreviewLoading(true);
    refundApi
      .preview(member.membershipId, cycle)
      .then((res) => setPreview(res.data.data))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [isOpen, member, cycle]);

  // Pre-fill amounts when member/preview/defaultMode changes
  useEffect(() => {
    if (!member) return;
    setMode(defaultMode);
    const foodCredit = Math.max(0, member.foodPurchases ?? 0);
    const unpaidLiabilities = Math.max(0, (member.mealCost + (member.expenseUnpaid ?? 0)) - foodCredit);
    const maxRef = preview?.maxRefundable ?? Math.max(0, (member.walletBalance ?? 0) - unpaidLiabilities);

    if (defaultMode === 'collect') {
      setAmount(member.due > 0 ? member.due : 0);
      setNote(`Settlement deposit for ${cycle} cycle`);
    } else {
      setAmount(maxRef);
      setNote(`Cash refund from wallet advance (${cycle})`);
    }
    setError(null);
    setValidation(null);
  }, [member, cycle, defaultMode, preview]);

  // Debounced real-time validation for refund amounts
  const runValidation = useCallback(
    (amt: number) => {
      if (!member || mode !== 'refund' || amt <= 0) {
        setValidation(null);
        return;
      }
      if (validateTimer.current) clearTimeout(validateTimer.current);
      setValidating(true);
      validateTimer.current = setTimeout(async () => {
        try {
          const res = await refundApi.validate({
            membershipId: member.membershipId,
            amount: amt,
            date,
          });
          setValidation(res.data.data);
        } catch {
          setValidation(null);
        } finally {
          setValidating(false);
        }
      }, 400);
    },
    [member, mode, date],
  );

  // Trigger validation on amount or mode change
  useEffect(() => {
    runValidation(amount);
    return () => {
      if (validateTimer.current) clearTimeout(validateTimer.current);
    };
  }, [amount, mode, date, runValidation]);

  if (!isOpen || !member) return null;

  const walletBalance = preview?.walletBalance ?? (member.walletBalance ?? 0);
  const foodCredit = Math.max(0, member.foodPurchases ?? 0);
  const unpaidLiabilities = preview?.unpaidLiabilities ?? Math.max(0, (member.mealCost + (member.expenseUnpaid ?? 0)) - foodCredit);
  const maxRefundable = preview?.maxRefundable ?? Math.max(0, walletBalance - unpaidLiabilities);
  const foodExcess = preview?.foodExcess ?? Math.max(0, Math.round(member.foodPurchases - member.mealCost));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) { setError('Amount must be greater than 0'); return; }

    if (mode === 'refund' && validation && !validation.valid) {
      setError(validation.error ?? 'Refund amount is out of bounds.');
      return;
    }
    if (mode === 'refund' && amount > maxRefundable) {
      setError(`Cannot refund ৳${amount}. Maximum refundable wallet advance: ৳${maxRefundable}.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'collect') {
        await depositApi.create({ membershipId: member.membershipId, amount, depositType: paymentMethod, date });
      } else {
        await refundApi.create({ membershipId: member.membershipId, amount, paymentMethod, date, note });
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const x = err as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Settlement processing failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden text-card-foreground">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${mode === 'refund' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
              {mode === 'refund' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {mode === 'refund' ? 'Refund Cash to Member' : 'Collect Due Settlement'}
              </h3>
              <p className="text-xs text-muted-foreground">
                Member: <span className="font-semibold text-foreground">{member.userName}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Status Banner */}
        <div className="p-3 bg-muted/20 border-b border-border/50">
          {previewLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading live settlement status…
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              <div className="flex flex-col items-center gap-0.5 bg-background/50 rounded-lg px-1.5 py-1.5 border border-border/50">
                <span className="text-muted-foreground font-medium flex items-center gap-1"><Wallet className="w-3 h-3" />Wallet</span>
                <span className="font-bold text-xs text-emerald-500">{taka(walletBalance)}</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 bg-background/50 rounded-lg px-1.5 py-1.5 border border-border/50">
                <span className="text-muted-foreground font-medium">Meal Due</span>
                <span className={`font-bold text-xs ${(preview?.mealCostDue ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>{taka(preview?.mealCostDue ?? 0)}</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 bg-background/50 rounded-lg px-1.5 py-1.5 border border-border/50">
                <span className="text-muted-foreground font-medium">Max Refund</span>
                <span className={`font-bold text-xs ${maxRefundable > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{taka(maxRefundable)}</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 bg-background/50 rounded-lg px-1.5 py-1.5 border border-border/50">
                <span className="text-muted-foreground font-medium">Food Excess</span>
                <span className={`font-bold text-xs ${foodExcess > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{taka(foodExcess)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Food purchase excess notification badge */}
        {foodExcess > 0 && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Food Purchase Excess: {taka(foodExcess)}</p>
              <p className="text-[11px] opacity-90">
                Cannot be refunded in the current cycle. At month-end close by admin, this amount will automatically deposit into the member&apos;s wallet for next month.
              </p>
            </div>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="p-4 border-b border-border">
          <div className="grid grid-cols-2 gap-2 bg-muted/50 p-1 rounded-xl">
            <button type="button"
              onClick={() => { setMode('collect'); if (member.due > 0) setAmount(member.due); setValidation(null); }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${mode === 'collect' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <ArrowUpRight className="w-4 h-4 text-destructive" /> Collect Payment (Cash IN)
            </button>
            <button type="button"
              onClick={() => { setMode('refund'); setAmount(maxRefundable); }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${mode === 'refund' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> Refund Cash (Cash OUT)
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              {mode === 'refund' ? 'Cash Refund Amount (BDT)' : 'Settlement Amount Collected (BDT)'}
            </label>
            <div className="relative">
              <Input
                type="number"
                min="1"
                step="1"
                max={mode === 'refund' ? maxRefundable : undefined}
                required
                value={amount || ''}
                onChange={(e) => { setAmount(Number(e.target.value)); setError(null); }}
                className="pl-8 font-bold text-base"
              />
              <span className="absolute left-3 top-2.5 text-muted-foreground font-bold text-sm">৳</span>
              {mode === 'refund' && validating && (
                <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Quick-fill buttons */}
            <div className="flex items-center justify-between mt-1.5 gap-2">
              <p className="text-[11px] text-muted-foreground">
                {mode === 'refund'
                  ? maxRefundable > 0
                    ? `Max refundable from wallet: ${taka(maxRefundable)}`
                    : `No advance balance available in wallet for refund.`
                  : `Collecting ৳${amount} deposit will reduce their outstanding due.`}
              </p>
              {mode === 'refund' && maxRefundable > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => setAmount(maxRefundable)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors">
                    Max (৳{maxRefundable})
                  </button>
                  <button type="button" onClick={() => setAmount(Math.round(maxRefundable / 2))}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                    50%
                  </button>
                </div>
              )}
              {mode === 'collect' && member.due > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => setAmount(member.due)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                    Full Pay (৳{member.due})
                  </button>
                  <button type="button" onClick={() => setAmount(Math.round(member.due / 2))}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                    50%
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Real-time validation result (refund mode only) */}
          {mode === 'refund' && amount > 0 && !validating && validation && (
            <div className={`rounded-xl border px-3 py-2.5 text-xs space-y-1.5 ${validation.valid ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
              {validation.valid ? (
                <>
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Refund valid — debits wallet in real time
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-0.5">Refunding</p>
                      <p className="font-bold text-foreground">{taka(validation.refundAmount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><TrendingDown className="w-3 h-3" />Wallet After</p>
                      <p className={`font-bold ${validation.walletAfter === 0 ? 'text-muted-foreground' : 'text-emerald-600'}`}>{taka(validation.walletAfter)}</p>
                    </div>
                  </div>
                  {validation.isFullWalletRefund && (
                    <p className="text-center text-emerald-600 font-semibold pt-0.5">
                      ✓ Full wallet advance refund (Wallet balance will become ৳0)
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-1.5 font-semibold text-destructive">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {validation.error}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as DepositType)}
                className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/50"
              >
                <option value="cash">Cash in Hand</option>
                <option value="mobile">bKash / Nagad / Mobile</option>
                <option value="bank">Bank Transfer</option>
                <option value="other">Other Adjustment</option>
              </select>
            </div>
            <div>
              <Input type="date" label="Transaction Date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <Input
              type="text"
              label="Note / Reference (Optional)"
              placeholder="e.g. Cash refund handed in person"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || (mode === 'refund' && (maxRefundable <= 0 || (!!validation && !validation.valid)))}
              className={mode === 'refund' ? 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50' : ''}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Processing…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-1.5" />{mode === 'refund' ? `Confirm Refund (${taka(amount)})` : `Confirm Payment (${taka(amount)})`}</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
