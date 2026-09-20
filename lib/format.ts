import type { Currency } from './types';

export function getCurrency(currencies: Currency[], code: string): Currency {
  return currencies.find((c) => c.code === code) || currencies[0] || { code, symbol: code, rate: 1 };
}

/** Convert an amount stored in base currency (INR) to the display currency. */
export function formatMoney(amountInBase: number, currency: Currency, opts?: { compact?: boolean }): string {
  const converted = amountInBase * currency.rate;
  const abs = Math.abs(converted);
  const isINR = currency.code === 'INR';
  let str: string;
  if (opts?.compact) {
    if (isINR) {
      if (abs >= 10_000_000) str = `${(converted / 10_000_000).toFixed(2)}Cr`;
      else if (abs >= 100_000) str = `${(converted / 100_000).toFixed(1)}L`;
      else if (abs >= 1_000) str = `${(converted / 1_000).toFixed(1)}K`;
      else str = converted.toLocaleString(undefined, { maximumFractionDigits: 0 });
    } else {
      if (abs >= 1_000_000_000) str = `${(converted / 1_000_000_000).toFixed(2)}B`;
      else if (abs >= 1_000_000) str = `${(converted / 1_000_000).toFixed(2)}M`;
      else if (abs >= 1_000) str = `${(converted / 1_000).toFixed(1)}K`;
      else str = converted.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
  } else {
    str = converted.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return `${currency.symbol}${str}`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatRatio(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function formatMonths(months: number): string {
  if (months < 12) return `${months.toFixed(0)} mo`;
  return `${(months / 12).toFixed(1)} yr`;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Local calendar date as YYYY-MM-DD (toISOString would give the UTC date, which is wrong near midnight). */
export function todayISO(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Whether a backup reminder is due: never backed up, or older than the chosen weekly/monthly interval. */
export function isBackupDue(freq: 'none' | 'weekly' | 'monthly', lastBackupDate: string | null, today: string): boolean {
  if (freq === 'none') return false;
  if (!lastBackupDate) return true;
  const toDay = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day) / 86_400_000;
  };
  return toDay(today) - toDay(lastBackupDate) >= (freq === 'weekly' ? 7 : 30);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}