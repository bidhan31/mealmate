export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function currentCycle(): string {
  return todayKey().slice(0, 7);
}

export function getCurrencySymbol(): string {
  if (typeof window === 'undefined') return '৳';

  const symbol = localStorage.getItem('mealmate_currency') || '৳';
  return symbol.toString() ;
}

export function taka(n: number | null | undefined): string   {
  const val = Number(n || 0);

  const result = `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return result;
}


export function formatDatePref(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  if (typeof window === 'undefined') return dateStr;
  const fmt = localStorage.getItem('mealmate_date_format') || 'YYYY-MM-DD';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  if (fmt === 'DD/MM/YYYY') return `${d}/${m}/${y}`;
  if (fmt === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
  return `${y}-${m}-${d}`;
}

export function formatNotificationTime(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  const timeStr = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (diffSecs >= 0 && diffSecs < 60) {
    return `Just now (${timeStr})`;
  }
  if (diffMins > 0 && diffMins < 60) {
    return `${diffMins}m ago (${timeStr})`;
  }
  if (
    diffHours < 24 &&
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return `Today at ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return `Yesterday at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });

  return `${dateStr}, ${timeStr}`;
}
