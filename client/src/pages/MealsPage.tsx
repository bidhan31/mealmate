import { useCallback, useEffect, useMemo, useState } from 'react';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { mealApi } from '@/api/financeApi';
import { membershipApi } from '@/api/homeApi';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { loadMyHome } from '@/features/home/homeSlice';
import { todayKey } from '@/lib/format';
import type { MealDayDto, GuestRequestDto, MonthlyMealSummary, MonthlyCalendarData, MealSlot, MealSlots } from '@/types/finance';
import type { MemberDto } from '@/types/home';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/Table';
import { UserAvatar } from '@/components/ui/UserAvatar';

type ChartKey = 'trend' | 'members' | 'split';

const CHART_OPTIONS: { key: ChartKey; label: string }[] = [
  { key: 'trend', label: 'Daily Trend' },
  { key: 'members', label: 'By Member' },
  { key: 'split', label: 'Normal vs Guest' },
];

const SLOTS: { key: MealSlot; label: string; short: string }[] = [
  { key: 'breakfast', label: 'Breakfast', short: 'B' },
  { key: 'lunch', label: 'Lunch', short: 'L' },
  { key: 'dinner', label: 'Dinner', short: 'D' },
];

const DEFAULT_SLOTS: MealSlots = { breakfast: false, lunch: false, dinner: false };

// Nivo theme tuned to read well on both light and dark backgrounds.
const nivoTheme = {
  text: { fill: 'hsl(215 16% 47%)', fontSize: 11 },
  axis: {
    ticks: { text: { fill: 'hsl(215 16% 47%)', fontSize: 11 } },
    legend: { text: { fill: 'hsl(215 16% 47%)', fontSize: 12 } },
  },
  grid: { line: { stroke: 'hsl(215 16% 47% / 0.15)', strokeWidth: 1 } },
  tooltip: {
    container: {
      background: 'hsl(222 47% 11%)',
      color: '#fff',
      fontSize: 12,
      borderRadius: 8,
    },
  },
  legends: { text: { fill: 'hsl(215 16% 47%)' } },
};




const DEFAULT_MEAL_SETTINGS = { breakfast: true, lunch: true, dinner: true };

export default function MealsPage() {
  const myMembershipId = useAppSelector((s) => s.home.membership?.id);
  const isAdmin = useAppSelector((s) => s.home.membership?.role === 'admin');
  const homeWindows = useAppSelector((s) => s.home.home?.disabledSlots ?? []);
  const mealSettings = useAppSelector((s) => s.home.home?.mealSettings) ?? DEFAULT_MEAL_SETTINGS;
  const dispatch = useAppDispatch();

  const activeSlots = useMemo(() => {
    return SLOTS.filter((s) => mealSettings[s.key] !== false);
  }, [mealSettings]);

  const [date, setDate] = useState(todayKey());
  const [day, setDay] = useState<MealDayDto | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyMealSummary | null>(null);
  const [calendar, setCalendar] = useState<MonthlyCalendarData | null>(null);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [guests, setGuests] = useState<GuestRequestDto[]>([]);
  const [guestCount, setGuestCount] = useState(1);
  const [guestSlot, setGuestSlot] = useState<MealSlot>('lunch');
  const [activeChart, setActiveChart] = useState<ChartKey>('trend');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // "Turn off meals" panel state
  const [offSlots, setOffSlots] = useState<Record<MealSlot, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
  });
  const [offFrom, setOffFrom] = useState(todayKey());
  const [offTo, setOffTo] = useState(todayKey());
  const [offScope, setOffScope] = useState<'self' | 'home'>('self');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, m, g, ms, cal] = await Promise.all([
        mealApi.byDate(date),
        membershipApi.list('active'),
        mealApi.guestRequests('pending'),
        mealApi.monthly(),
        mealApi.monthlyCalendar(),
      ]);
      setDay(d.data.data);
      setMembers(m.data.data.members);
      setGuests(g.data.data.requests);
      setMonthlySummary(ms.data.data);
      setCalendar(cal.data.data);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to load');
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const memberName = (id: string) => members.find((m) => m.id === id)?.user?.name ?? 'Member';

  const canEdit = (membershipId: string) => isAdmin || membershipId === myMembershipId;

  const isPast = date < todayKey();
  const homeOff = day?.homeDisabledSlots ?? [];

  // Toggle a single slot for a member on the selected day.
  const toggleSlot = async (membershipId: string, slot: MealSlot, next: boolean) => {
    if (!canEdit(membershipId) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await mealApi.setMeal(date, { [slot]: next }, membershipId);
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to update meal');
    } finally {
      setBusy(false);
    }
  };

  const submitTurnOff = async () => {
    const slots = SLOTS.filter((s) => offSlots[s.key]).map((s) => s.key);
    if (slots.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await mealApi.disableSlots({ slots, from: offFrom, to: offTo, scope: offScope });
      setOffSlots({ breakfast: false, lunch: false, dinner: false });
      if (offScope === 'home') await dispatch(loadMyHome());
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to turn off meals');
    } finally {
      setBusy(false);
    }
  };

  const removeWindow = async (windowId: string, scope: 'home' | 'self') => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (scope === 'home') {
        await mealApi.removeHomeWindow(windowId);
        await dispatch(loadMyHome());
      } else {
        await mealApi.removeMemberWindow(windowId);
      }
      await load();
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to re-enable meal');
    } finally {
      setBusy(false);
    }
  };

  const requestGuest = async () => {
    await mealApi.requestGuest(date, guestSlot, guestCount);
    setGuestCount(1);
    await load();
  };

  const resolveGuest = async (id: string, approve: boolean) => {
    if (approve) await mealApi.approveGuest(id);
    else await mealApi.rejectGuest(id);
    await load();
  };

  // Per-member slot state for the selected day (defaults all-deselected).
  const todayRows = useMemo(() => {
    const slotMap = new Map<string, MealSlots>();
    const countMap = new Map<string, number>();
    const lockedMap = new Map<string, MealSlot[]>();
    for (const m of day?.meals ?? []) {
      if (m.type === 'normal') {
        slotMap.set(m.membershipId, m.slots ?? DEFAULT_SLOTS);
        countMap.set(m.membershipId, m.count);
        lockedMap.set(m.membershipId, m.lockedSlots ?? []);
      }
    }
    return members.map((mb) => ({
      membershipId: mb.id,
      name: mb.user?.name ?? 'Member',
      slots: slotMap.get(mb.id) ?? DEFAULT_SLOTS,
      count: countMap.get(mb.id) ?? 0,
      locked: lockedMap.get(mb.id) ?? [],
    }));
  }, [day, members]);

  // The current member's own turn-off windows (for re-enabling).
  const myWindows = useMemo(
    () => members.find((m) => m.id === myMembershipId)?.disabledSlots ?? [],
    [members, myMembershipId],
  );

  const todayGuestTotal = useMemo(
    () =>
      (day?.meals ?? [])
        .filter((m) => m.type === 'guest' && m.guestStatus === 'approved')
        .reduce((sum, m) => sum + m.count, 0),
    [day],
  );

  // Per-slot totals for the selected day: count members who have each slot
  // selected (ON) and not locked. Guest meals are excluded here.
  const slotTotals = useMemo(() => {
    const totals: Record<MealSlot, number> = { breakfast: 0, lunch: 0, dinner: 0 };
    for (const m of day?.meals ?? []) {
      if (m.type !== 'normal' || !m.slots) continue;
      const locked = m.lockedSlots ?? [];
      for (const s of SLOTS) {
        if (m.slots[s.key] && !locked.includes(s.key)) totals[s.key] += 1;
      }
    }
    console.log('slotTotals', totals);
    return totals;
  }, [day]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const m of calendar?.meals ?? []) {
      byDate.set(m.date, (byDate.get(m.date) ?? 0) + m.count);
    }
    const points = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, y]) => ({ x: d.slice(8), y }));
    return [{ id: 'Meals', data: points }];
  }, [calendar]);

  const memberBarData = useMemo(
    () =>
      (monthlySummary?.byMember ?? [])
        .map((b) => ({ member: memberName(b.membershipId), meals: b.totalMeals }))
        .sort((a, b) => b.meals - a.meals),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthlySummary, members],
  );

  const splitData = useMemo(() => {
    let normal = 0;
    let guest = 0;
    for (const m of calendar?.meals ?? []) {
      if (m.type === 'guest') {
        if (m.guestStatus === 'approved') guest += m.count;
      } else {
        normal += m.count;
      }
    }
    return [
      { id: 'Normal', label: 'Normal', value: normal, color: 'hsl(239 84% 67%)' },
      { id: 'Guest', label: 'Guest', value: guest, color: 'hsl(38 92% 50%)' },
    ];
  }, [calendar]);

  const avgPerDay = useMemo(() => {
    const days = new Set((calendar?.meals ?? []).map((m) => m.date)).size;
    const total = calendar?.meals.reduce((sum, m) => sum + m.count, 0) ?? 0;
    return days ? Math.round((total / days) * 10) / 10 : 0;
  }, [calendar]);

  const myMonthlyMeals = monthlySummary?.byMember.find((m) => m.membershipId === myMembershipId)?.totalMeals ?? 0;

  const tiles = [
    { label: 'Today Total', value: day?.todayTotalMealCount ?? 0, accent: true },
    { label: 'House Total (Month)', value: monthlySummary?.homeTotalMealCount ?? 0 },
    { label: 'My Meals (Month)', value: myMonthlyMeals },
    { label: 'Active Members', value: members.length },
    { label: 'Avg Meals / Day', value: avgPerDay },
  ];

  return (
    <div className="space-y-6 pt-0">
      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>
      )}

      {/* ── Operation Hub ─────────────────────────────────────────────────── */}
      <Card className="border-0 bg-background/50 backdrop-blur-xl shadow-2xl ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-primary/10 via-transparent to-transparent">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>

              <p className=" font-medium text-muted-foreground uppercase tracking-wider">
                Today's Total Meals
              </p>

              <div className="flex flex-wrap items-center gap-2 py-3 rounded-lg">

                <p className="text-8xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 leading-none mt-1">
                  {day?.todayTotalMealCount ?? 0}
                </p>

                {/* Per-slot breakdown for the day */}
                <div className="grid grid-cols-1  gap-1">
                  {SLOTS.map((s) => (
                      <div className={`flex text-center items-center justify-between border border-green-300 px-1 gap-1 font-semibold border border-white/20 py-0.5 rounded-[4px] py-.5 `}  >
                        <p className={` uppercase tracking-[2px] text-[8px] font-semibold`}>{s.label}</p>
                        <p  style={{ fontSize: '10px', fontWeight: 'bold' }}>{slotTotals[s.key]}</p>
                      </div>
                  ))}
                      

                  {todayGuestTotal > 0 && (
                    <div className=' flex text-center items-center justify-between  px-1 gap-1 border border-green-300 rounded-[4px]  py-0.5  ' >
                      <p className=' uppercase tracking-[2px] text-[8px] font-semibold '>Guest</p>
                      <p style={{ fontSize: '10px', fontWeight: 'bold' }}>{todayGuestTotal}</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
            <div>
              <CardTitle className="text-2xl">Meal Operation Hub</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {isAdmin ? 'Manage meals for any member' : 'View all · adjust only your own'}
              </p>
            </div>



            <div className="w-44">
              <Input id="date" type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Big colored today total */}
          <div>

          

          </div>

          {homeOff.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
              Admin turned off <span className="font-semibold">{homeOff.join(', ')}</span> for {date}. These
              slots cannot be counted for anyone.
            </div>
          )}

          {/* Per-member slot control */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {todayRows.map((row) => {
              const editable = canEdit(row.membershipId) && !isPast;
              const mine = row.membershipId === myMembershipId;
              return (
                <div
                  key={row.membershipId}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${mine ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-muted/20'
                    }`}
                >
                  <div className="flex items-center gap-2 font-medium text-sm truncate flex-1 min-w-0">
                    <UserAvatar name={row.name} size="xs" />
                    <span className="truncate">{row.name}</span>
                    {mine && <span className="ml-1 text-[10px] uppercase font-bold text-primary shrink-0">You</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {activeSlots.map((s) => {
                      const homeDisabled = homeOff.includes(s.key);
                      const locked = row.locked.includes(s.key); // home OR self off
                      const selfDisabled = locked && !homeDisabled;
                      const on = row.slots[s.key] && !locked;
                      const clickable = editable && !locked;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          disabled={!clickable}
                          title={
                            homeDisabled
                              ? `${s.label} turned off by admin`
                              : selfDisabled
                                ? `${s.label} turned off by member`
                                : clickable
                                  ? `Toggle ${s.label}`
                                  : s.label
                          }
                          onClick={() => toggleSlot(row.membershipId, s.key, !row.slots[s.key])}
                          className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors ${locked
                              ? 'bg-destructive/10 text-destructive/50 line-through cursor-not-allowed'
                              : on
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            } ${clickable ? 'hover:opacity-80' : 'cursor-not-allowed'}`}
                        >
                          {s.short}
                        </button>
                      );
                    })}
                    <span className="ml-2 font-bold text-primary w-5 text-center">{row.count}</span>
                  </div>
                </div>
              );
            })}
            {todayRows.length === 0 && (
              <p className="text-sm text-muted-foreground">No active members.</p>
            )}
          </div>

          {/* Turn off meals for a date range */}
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Turn off meals for a period</p>
              {isAdmin && (
                <div className="flex rounded-lg border border-border/50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setOffScope('self')}
                    className={`px-3 py-1 rounded-md font-medium ${offScope === 'self' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  >
                    Only me
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffScope('home')}
                    className={`px-3 py-1 rounded-md font-medium ${offScope === 'home' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  >
                    Whole home
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {offScope === 'home'
                ? 'Selected meals will be turned off for every member across the chosen days. No one can count them.'
                : 'Selected meals will not be counted for you across the chosen days.'}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex gap-1.5">
                {activeSlots.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setOffSlots((p) => ({ ...p, [s.key]: !p[s.key] }))}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold border ${offSlots[s.key]
                        ? 'bg-destructive text-destructive-foreground border-destructive'
                        : 'bg-background border-border/50 text-muted-foreground'
                      }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="w-36">
                <Input id="off-from" type="date" label="From" value={offFrom} min={todayKey()} onChange={(e) => setOffFrom(e.target.value)} />
              </div>
              <div className="w-36">
                <Input id="off-to" type="date" label="To" value={offTo} min={offFrom} onChange={(e) => setOffTo(e.target.value)} />
              </div>
              <Button
                variant="destructive"
                className="mb-0.5"
                disabled={busy || !SLOTS.some((s) => offSlots[s.key])}
                onClick={submitTurnOff}
              >
                Turn off
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Active meal shutoff windows (home-wide + my own) ──────────────── */}
      {(homeWindows.length > 0 || myWindows.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Meal shutoffs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin && homeWindows.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Home-wide (everyone)
                </p>
                <div className="flex flex-wrap gap-2">
                  {homeWindows.map((w) => (
                    <div
                      key={w._id}
                      className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5 text-sm"
                    >
                      <span className="font-semibold capitalize">{w.slot}</span>
                      <span className="text-muted-foreground text-xs">
                        {w.from} → {w.to}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeWindow(w._id!, 'home')}
                        className="text-destructive hover:opacity-70 text-xs font-medium"
                        disabled={busy}
                      >
                        Re-enable
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {myWindows.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  My turn-offs
                </p>
                <div className="flex flex-wrap gap-2">
                  {myWindows.map((w) => (
                    <div
                      key={w._id}
                      className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm"
                    >
                      <span className="font-semibold capitalize">{w.slot}</span>
                      <span className="text-muted-foreground text-xs">
                        {w.from} → {w.to}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeWindow(w._id!, 'self')}
                        className="text-primary hover:opacity-70 text-xs font-medium"
                        disabled={busy}
                      >
                        Re-enable
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Stat tiles ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={`rounded-2xl border p-4 text-center ${t.accent ? 'border-primary/20 bg-primary/5' : 'border-border/50 bg-muted/20'
              }`}
          >
            <p className="text-xs text-muted-foreground mb-1">{t.label}</p>
            <p className={`text-3xl font-bold ${t.accent ? 'text-primary' : 'text-foreground'}`}>{t.value}</p>
          </div>
        ))}
      </div>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Meal Analytics</CardTitle>
          <div className="flex flex-wrap gap-2">
            {CHART_OPTIONS.map((opt) => (
              <Button
                key={opt.key}
                variant={activeChart === opt.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveChart(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[360px]">
            {activeChart === 'trend' && (
              <ResponsiveLine
                data={trendData}
                theme={nivoTheme}
                margin={{ top: 20, right: 24, bottom: 50, left: 44 }}
                xScale={{ type: 'point' }}
                yScale={{ type: 'linear', min: 0, max: 'auto' }}
                curve="monotoneX"
                colors={['hsl(239 84% 67%)']}
                lineWidth={3}
                pointSize={6}
                pointColor="hsl(239 84% 67%)"
                pointBorderWidth={2}
                pointBorderColor="#fff"
                enableArea
                areaOpacity={0.12}
                enableGridX={false}
                axisBottom={{ legend: 'Day of month', legendOffset: 40, legendPosition: 'middle', tickSize: 0, tickPadding: 8 }}
                axisLeft={{ legend: 'Meals', legendOffset: -36, legendPosition: 'middle', tickSize: 0, tickPadding: 6 }}
                useMesh
              />
            )}
            {activeChart === 'members' && (
              <ResponsiveBar
                data={memberBarData}
                theme={nivoTheme}
                keys={['meals']}
                indexBy="member"
                margin={{ top: 20, right: 24, bottom: 70, left: 44 }}
                padding={0.3}
                colors={['hsl(239 84% 67%)']}
                borderRadius={6}
                enableGridX={false}
                axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: -30 }}
                axisLeft={{ legend: 'Meals', legendOffset: -36, legendPosition: 'middle', tickSize: 0, tickPadding: 6 }}
                labelSkipHeight={12}
                labelTextColor="#fff"
              />
            )}
            {activeChart === 'split' && (
              <ResponsivePie
                data={splitData}
                theme={nivoTheme}
                margin={{ top: 24, right: 24, bottom: 40, left: 24 }}
                innerRadius={0.6}
                padAngle={1}
                cornerRadius={4}
                colors={{ datum: 'data.color' }}
                borderWidth={0}
                arcLabelsSkipAngle={12}
                arcLabelsTextColor="#fff"
                arcLinkLabelsColor={{ from: 'color' }}
                arcLinkLabelsTextColor="hsl(215 16% 47%)"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Guest meals ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Guest meals</CardTitle>
        </CardHeader>
        <CardContent>
          {isAdmin && (
            <div className="flex flex-wrap items-end gap-3 mb-6 bg-muted/30 p-4 rounded-xl border border-border/50 max-w-lg">
              <div className="w-40">
                <label htmlFor="guest-slot" className="block text-sm font-medium mb-1.5">
                  Meal slot
                </label>
                <select
                  id="guest-slot"
                  value={guestSlot}
                  onChange={(e) => setGuestSlot(e.target.value as MealSlot)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {SLOTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                <Input
                  id="guest-count"
                  type="number"
                  label="Guest count"
                  value={guestCount}
                  min={1}
                  onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <Button onClick={requestGuest} className="mb-0.5">Request guest meal</Button>
            </div>
          )}
          {guests.length > 0 ? (
            <Table>
              <TableBody>
                {guests.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <span className="font-medium">{memberName(g.membershipId)}</span>
                      <span className="text-muted-foreground ml-2">
                        &middot; {g.count}{g.slot ? ` ${g.slot}` : ''} on {g.date}
                      </span>
                    </TableCell>
                    <TableCell className="text-right flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10" onClick={() => resolveGuest(g.id, true)}>
                        Approve
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => resolveGuest(g.id, false)}>
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No pending guest meal requests.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
