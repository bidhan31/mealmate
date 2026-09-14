import { useCallback, useEffect, useMemo, useState } from 'react';
import { mealApi } from '@/api/financeApi';
import { currentCycle } from '@/lib/format';
import type { MonthlyCalendarData } from '@/types/finance';
import { membershipApi } from '@/api/homeApi';
import { useAppSelector } from '@/app/hooks';
import type { MemberDto } from '@/types/home';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/Table';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MealCalendarPage() {
  const defaultCycle = useAppSelector((s) => s.home.home?.currentCycle);
  const [cycle, setCycle] = useState(defaultCycle || currentCycle());
  const [calendarData, setCalendarData] = useState<MonthlyCalendarData | null>(null);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cal, m] = await Promise.all([mealApi.monthlyCalendar(cycle), membershipApi.list('active')]);
      setCalendarData(cal.data.data);
      setMembers(m.data.data.members);
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to load');
    }
  }, [cycle]);

  useEffect(() => {
    load();
  }, [load]);

  const memberName = (id: string) => members.find((m) => m.id === id)?.user?.name ?? 'Member';

  const daysInMonth = useMemo(() => {
    const [year, month] = cycle.split('-').map(Number);
    if (!year || !month) return 0;
    return new Date(year, month, 0).getDate();
  }, [cycle]);

  const startDayOfWeek = useMemo(() => {
    const [year, month] = cycle.split('-').map(Number);
    if (!year || !month) return 0;
    return new Date(year, month - 1, 1).getDay();
  }, [cycle]);

  // Group meals by date
  const mealsByDate = useMemo(() => {
    const map = new Map<string, { total: number; guestCount: number; meals: MonthlyCalendarData['meals'] }>();
    if (!calendarData) return map;
    
    for (const m of calendarData.meals) {
      if (!map.has(m.date)) {
        map.set(m.date, { total: 0, guestCount: 0, meals: [] });
      }
      const dayData = map.get(m.date)!;
      dayData.meals.push(m);
      dayData.total += m.count;
      if (m.type === 'guest' && m.guestStatus === 'approved') {
        dayData.guestCount += m.count;
      }
    }
    return map;
  }, [calendarData]);

  // Construct grid cells (blanks + days)
  const gridCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${cycle}-${String(d).padStart(2, '0')}`;
      cells.push({ date: dateStr, day: d, data: mealsByDate.get(dateStr) });
    }
    return cells;
  }, [daysInMonth, startDayOfWeek, cycle, mealsByDate]);

  return (
    <div className="space-y-6 max-w-5xl">
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="w-48">
          <Input
            id="cycle"
            type="month"
            label="Cycle"
            value={cycle}
            onChange={(e) => setCycle(e.target.value)}
          />
        </div>
        {calendarData && (
          <div className="rounded-lg bg-primary/10 px-4 py-2 text-primary text-sm font-medium border border-primary/20">
            Monthly total: {calendarData.meals.reduce((sum, m) => sum + m.count, 0)} meals
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meal Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-px bg-border/50 rounded-t-lg overflow-hidden border border-border/50">
            {WEEKDAYS.map((w) => (
              <div key={w} className="bg-muted/50 p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {w}
              </div>
            ))}
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-border/50 border border-t-0 border-border/50 rounded-b-lg overflow-hidden">
            {gridCells.map((cell, i) => {
              if (!cell) {
                return <div key={`blank-${i}`} className="bg-card min-h-[100px]" />;
              }
              const hasMeals = cell.data && cell.data.total > 0;
              return (
                <div 
                  key={cell.date} 
                  onClick={() => hasMeals && setSelectedDate(cell.date)}
                  className={`bg-card min-h-[100px] p-2 flex flex-col relative transition-colors ${hasMeals ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                >
                  <span className="text-sm text-muted-foreground font-medium">{cell.day}</span>
                  {hasMeals && (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-2xl font-bold text-foreground">{cell.data!.total}</span>
                    </div>
                  )}
                  {cell.data && cell.data.guestCount > 0 && (
                    <div className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
                      {cell.data.guestCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modal for Day Details */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-lg animate-in fade-in zoom-in-95">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <CardTitle>Meals for {selectedDate}</CardTitle>
              <button 
                onClick={() => setSelectedDate(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </CardHeader>
            <CardContent className="pt-4 max-h-[60vh] overflow-y-auto">
              <Table>
                <TableBody>
                  {mealsByDate.get(selectedDate)?.meals.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {memberName(m.membershipId)}
                          {m.type === 'guest' && <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">Guest</span>}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {m.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
