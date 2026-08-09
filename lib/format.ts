import type { Currency } from './types';

export function getCurrency(currencies: Currency[], code: string): Currency {
  return currencies.find((c) => c.code === code) || currencies[0] || { code, symbol: code, rate: 1 };
}

/** Convert an amount stored in base currency (INR) to the display currency. */
export function formatMoney(amountInBase: number, currency: Currency, opts?: { compact?: boolean }): string {
  const converted = amountInBase * currency.rate;
  const abs = Math.abs(converted);
  let str: string;
  if (opts?.compact && abs >= 1_000_000) {
    str = `${(converted / 1_000_000).toFixed(2)}M`;
  } else if (opts?.compact && abs >= 100_000) {
    str = `${(converted / 100_000).toFixed(1)}L`;
  } else if (opts?.compact && abs >= 1_000) {
    str = `${(converted / 1_000).toFixed(1)}K`;
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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
}

export function monthKey(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}