/** Date helpers producing YYYY-MM-DD and YYYY-MM strings for a given timezone. */

export function dateKeyInTz(date: Date, timeZone: string): string {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function cycleFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7); // YYYY-MM
}

export function todayKey(timeZone: string): string {
  return dateKeyInTz(new Date(), timeZone);
}

export function currentCycle(timeZone: string): string {
  return cycleFromDateKey(todayKey(timeZone));
}

/** Validate a YYYY-MM-DD string. */
export function isValidDateKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
