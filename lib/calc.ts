import type {
  Transaction,
  Asset,
  Investment,
  Debt,
  Category,
  AppData,
  Contribution,
  ContributionFreq,
  AllocationTarget,
} from './types';

/** Items that are active or paused count toward current totals; closed items are historical only. */
function countsNow<T extends { status: string }>(item: T): boolean {
  return item.status !== 'closed';
}

/** Recurring contributions that are currently active (not paused) generate future entries. */
function isRecurringActive(c: Contribution): boolean {
  return c.type === 'recurring' && c.status === 'active';
}

export interface PeriodTotals {
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number; // 0..1
  byCategory: Record<string, number>;
  fixedExpenses: number;
  variableExpenses: number;
  needExpenses: number;
  wantExpenses: number;
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

export function yearKey(dateStr: string): string {
  return dateStr.slice(0, 4); // YYYY
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
}

export function inPeriod(dateStr: string, period: 'monthly' | 'annual', ref: string): boolean {
  if (period === 'monthly') return monthKey(dateStr) === monthKey(ref);
  return yearKey(dateStr) === yearKey(ref);
}

export type PeriodMode = 'monthly' | 'annual';

export interface PeriodGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Group items by month or year, sorted most-recent-first. */
export function groupByPeriod<T extends { date?: string; purchaseDate?: string }>(
  items: T[],
  period: PeriodMode,
): PeriodGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const d = item.date || item.purchaseDate || '';
    if (!d) continue;
    const key = period === 'monthly' ? monthKey(d) : yearKey(d);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({
      key,
      label: period === 'monthly' ? monthLabel(key) : key,
      items,
    }));
}

/** Sum totals for a given reference date and period. */
export function computeTotals(
  transactions: Transaction[],
  categories: Category[],
  period: 'monthly' | 'annual',
  refDate: string,
): PeriodTotals {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const byCategory: Record<string, number> = {};
  let income = 0;
  let expenses = 0;
  let fixedExpenses = 0;
  let variableExpenses = 0;
  let needExpenses = 0;
  let wantExpenses = 0;

  for (const t of transactions) {
    if (!inPeriod(t.date, period, refDate)) continue;
    if (t.type === 'income') {
      income += t.amount;
    } else {
      expenses += t.amount;
      byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
      const cat = catMap.get(t.categoryId);
      if (cat?.fixed) fixedExpenses += t.amount;
      else variableExpenses += t.amount;
      if (cat?.need) needExpenses += t.amount;
      else wantExpenses += t.amount;
    }
  }

  const savings = income - expenses;
  const savingsRate = income > 0 ? savings / income : 0;

  return {
    income,
    expenses,
    savings,
    savingsRate,
    byCategory,
    fixedExpenses,
    variableExpenses,
    needExpenses,
    wantExpenses,
  };
}

export function totalAssets(assets: Asset[]): number {
  return assets.filter(countsNow).reduce((s, a) => s + a.value, 0);
}

export function liquidAssets(assets: Asset[]): number {
  return assets.filter((a) => countsNow(a) && a.liquid).reduce((s, a) => s + a.value, 0);
}

export function totalInvestments(investments: Investment[]): number {
  return investments.filter(countsNow).reduce((s, i) => s + i.currentValue, 0);
}

export function totalDebt(debts: Debt[]): number {
  return debts.filter(countsNow).reduce((s, d) => s + d.outstanding, 0);
}

export function monthlyDebtPayments(debts: Debt[]): number {
  return debts.filter(countsNow).reduce((s, d) => s + d.emi, 0);
}

export function netWorth(data: Pick<AppData, 'assets' | 'investments' | 'debts'>): number {
  return totalAssets(data.assets) + totalInvestments(data.investments) - totalDebt(data.debts);
}

export interface Ratios {
  savings: number;
  savingsRate: number;
  cashToInvestment: number;
  debtServiceRatio: number;
  debtServiceZone: 'green' | 'yellow' | 'red';
  /** null = no expense history yet (can't compute); Infinity = debt with no income (worst case) */
  emergencyFundMonths: number | null;
  liquidityRatio: number;
  debtToAsset: number;
  debtToAssetZone: 'green' | 'yellow' | 'red';
  savingsCoverage: number;
  netWorth: number;
}

export function computeRatios(data: AppData, refDate: string): Ratios {
  const totals = computeTotals(data.transactions, data.categories, 'monthly', refDate);
  const assets = totalAssets(data.assets);
  const liquid = liquidAssets(data.assets);
  const invest = totalInvestments(data.investments);
  const debt = totalDebt(data.debts);
  const debtPmt = monthlyDebtPayments(data.debts);
  const nw = assets + invest - debt;

  const avgMonthlySpend = avgMonthlyExpenses(data.transactions, refDate);
  const avgMonthlyInc = avgMonthlyIncome(data.transactions, refDate);

  // Issue 1: debt with no income is the worst case, not safe — use Infinity so UI shows red/N/A
  const debtServiceRatio = avgMonthlyInc > 0 ? debtPmt / avgMonthlyInc : (debtPmt > 0 ? Infinity : 0);
  const totalAssetsPlusInvest = assets + invest;
  const debtToAsset = totalAssetsPlusInvest > 0 ? debt / totalAssetsPlusInvest : (debt > 0 ? Infinity : 0);

  // Issue 2: no expense history → can't compute emergency fund months; return null instead of dividing by 1
  const emergencyFundMonths: number | null = avgMonthlySpend > 0 ? liquid / avgMonthlySpend : null;

  return {
    savings: totals.savings,
    savingsRate: totals.savingsRate,
    cashToInvestment: invest > 0 ? totals.savings / invest : 0,
    debtServiceRatio,
    debtServiceZone:
      !isFinite(debtServiceRatio) ? 'red' : debtServiceRatio < 0.2 ? 'green' : debtServiceRatio < 0.4 ? 'yellow' : 'red',
    emergencyFundMonths,
    liquidityRatio: nw > 0 ? liquid / nw : 0,
    debtToAsset,
    debtToAssetZone:
      !isFinite(debtToAsset) ? 'red' : debtToAsset < 0.3 ? 'green' : debtToAsset < 0.5 ? 'yellow' : 'red',
    savingsCoverage: totals.expenses > 0 ? totals.savings / totals.expenses : (totals.savings > 0 ? Infinity : 0),
    netWorth: nw,
  };
}

export function lifestyleInflation(
  transactions: Transaction[],
  categories: Category[],
): { value: number; tag: 'lower-better'; noIncomeGrowth?: boolean } | null {
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;
  const currentMonth = now.getMonth();
  const ytdSpend = (year: number) =>
    transactions
      .filter((t) => t.type === 'expense' && yearKey(t.date) === String(year) && new Date(t.date).getMonth() <= currentMonth)
      .reduce((s, t) => s + t.amount, 0);
  const ytdInc = (year: number) =>
    transactions
      .filter((t) => t.type === 'income' && yearKey(t.date) === String(year) && new Date(t.date).getMonth() <= currentMonth)
      .reduce((s, t) => s + t.amount, 0);
  const thisYearInc = ytdInc(thisYear);
  const lastYearInc = ytdInc(lastYear);
  // Issue 4: no data at all → skip
  if (thisYearInc === 0 && lastYearInc === 0) return null;
  const dSpend = ytdSpend(thisYear) - ytdSpend(lastYear);
  const dInc = thisYearInc - lastYearInc;
  // Issue 4: flat/falling income — still show spending delta as a ratio of last year's income baseline
  if (dInc <= 0) {
    const baseline = lastYearInc || thisYearInc;
    if (baseline <= 0) return null;
    return { value: dSpend / baseline, tag: 'lower-better', noIncomeGrowth: true };
  }
  return { value: dSpend / dInc, tag: 'lower-better' };
}

/** CAGR for a single investment. */
export function cagr(purchaseValue: number, currentValue: number, purchaseDate: string): number {
  const years =
    (Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years <= 0 || purchaseValue <= 0) return 0;
  return Math.pow(currentValue / purchaseValue, 1 / years) - 1;
}

export interface AllocationBand {
  label: string;
  minAge: number;
  maxAge: number;
  stocks: number;
  mutualfund: number;
  fd: number;
  ppf: number;
  gold: number;
  crypto: number;
  other: number;
}

export const ALLOCATION_BANDS: AllocationBand[] = [
  {
    label: '20–35',
    minAge: 20,
    maxAge: 35,
    stocks: 0.35,
    mutualfund: 0.3,
    fd: 0.05,
    ppf: 0.1,
    gold: 0.1,
    crypto: 0.05,
    other: 0.05,
  },
  {
    label: '36–45',
    minAge: 36,
    maxAge: 45,
    stocks: 0.25,
    mutualfund: 0.3,
    fd: 0.1,
    ppf: 0.15,
    gold: 0.1,
    crypto: 0.03,
    other: 0.07,
  },
  {
    label: '46–55',
    minAge: 46,
    maxAge: 55,
    stocks: 0.15,
    mutualfund: 0.25,
    fd: 0.15,
    ppf: 0.2,
    gold: 0.15,
    crypto: 0.0,
    other: 0.1,
  },
  {
    label: '56+',
    minAge: 56,
    maxAge: 200,
    stocks: 0.1,
    mutualfund: 0.15,
    fd: 0.25,
    ppf: 0.25,
    gold: 0.15,
    crypto: 0.0,
    other: 0.1,
  },
];

export function bandForAge(age: number): AllocationTarget {
  const b =
    ALLOCATION_BANDS.find((band) => age >= band.minAge && age <= band.maxAge) ||
    ALLOCATION_BANDS[0];
  return { stocks: b.stocks, mutualfund: b.mutualfund, fd: b.fd, ppf: b.ppf, gold: b.gold, crypto: b.crypto, other: b.other, custom: false };
}

export function bandLabelForAge(age: number): string {
  const b =
    ALLOCATION_BANDS.find((band) => age >= band.minAge && age <= band.maxAge) ||
    ALLOCATION_BANDS[0];
  return b.label;
}

export interface ActualAllocation {
  stocks: number;
  mutualfund: number;
  fd: number;
  ppf: number;
  gold: number;
  crypto: number;
  other: number;
}

export function actualAllocation(
  investments: Investment[],
  assets: Asset[],
): ActualAllocation {
  const byType: Record<string, number> = {};
  for (const i of investments) if (countsNow(i)) byType[i.type] = (byType[i.type] || 0) + i.currentValue;
  // gold assets count toward gold allocation
  const goldAssets = assets.filter((a) => countsNow(a) && a.type === 'gold').reduce((s, a) => s + a.value, 0);
  byType['gold'] = (byType['gold'] || 0) + goldAssets;
  const total = Object.values(byType).reduce((s, v) => s + v, 0) || 1;
  return {
    stocks: (byType['stocks'] || 0) / total,
    mutualfund: (byType['mutualfund'] || 0) / total,
    fd: (byType['fd'] || 0) / total,
    ppf: (byType['ppf'] || 0) / total,
    gold: (byType['gold'] || 0) / total,
    crypto: (byType['crypto'] || 0) / total,
    other: (byType['other'] || 0) / total,
  };
}

export function allocationDrift(actual: ActualAllocation, target: AllocationTarget) {
  const keys: (keyof ActualAllocation)[] = [
    'stocks',
    'mutualfund',
    'fd',
    'ppf',
    'gold',
    'crypto',
    'other',
  ];
  return keys.map((k) => ({
    type: k,
    actual: actual[k],
    target: target[k],
    drift: actual[k] - target[k],
  }));
}

/** Simple amortization schedule projection. */
export function debtPayoffMonths(debt: Debt): number {
  if (debt.emi <= 0) return debt.tenureMonths;
  const r = debt.interestRate / 100 / 12;
  if (r === 0) return Math.ceil(debt.outstanding / debt.emi);
  // EMI must cover at least the monthly interest, otherwise the loan never amortizes
  const monthlyInterest = r * debt.outstanding;
  if (debt.emi <= monthlyInterest) return Infinity;
  const n = -Math.log(1 - monthlyInterest / debt.emi) / Math.log(1 + r);
  return Math.max(0, Math.ceil(n));
}

/** Snowball: pay smallest balance first. Avalanche: highest interest first. Only active/paused debts. */
export function debtStrategies(debts: Debt[]) {
  const open = debts.filter(countsNow);
  const snowball = [...open].sort((a, b) => a.outstanding - b.outstanding);
  const avalanche = [...open].sort((a, b) => b.interestRate - a.interestRate);
  return { snowball, avalanche };
}

/** Average monthly expenses over the trailing 6 months ending at refDate (inclusive).
 *  Only counts months that have at least one expense transaction, so new users
 *  with 1 month of data don't get a falsely low average. */
export function avgMonthlyExpenses(transactions: Transaction[], refDate: string): number {
  const ref = new Date(refDate);
  let total = 0;
  let count = 0;
  for (let i = 0; i < 6; i++) {
    const m = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const mk = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    const monthTxns = transactions.filter((t) => t.type === 'expense' && monthKey(t.date) === mk);
    if (monthTxns.length === 0) continue;
    total += monthTxns.reduce((s, t) => s + t.amount, 0);
    count++;
  }
  return count > 0 ? total / count : 0;
}

/** Average monthly income over the trailing 6 months ending at refDate (inclusive).
 *  Only counts months that have at least one income transaction. */
export function avgMonthlyIncome(transactions: Transaction[], refDate: string): number {
  const ref = new Date(refDate);
  let total = 0;
  let count = 0;
  for (let i = 0; i < 6; i++) {
    const m = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const mk = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    const monthTxns = transactions.filter((t) => t.type === 'income' && monthKey(t.date) === mk);
    if (monthTxns.length === 0) continue;
    total += monthTxns.reduce((s, t) => s + t.amount, 0);
    count++;
  }
  return count > 0 ? total / count : 0;
}

/** What-if: project net worth given monthly SIP addition over years at assumed return. */
export function projectNetWorth(
  current: number,
  monthlySip: number,
  years: number,
  annualReturn: number,
): number {
  const r = annualReturn / 100 / 12;
  const months = years * 12;
  if (r === 0) return current + monthlySip * months;
  return current * Math.pow(1 + r, months) + monthlySip * ((Math.pow(1 + r, months) - 1) / r);
}

export function goalProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, current / target);
}

// Issue 3: day-aware so Jan 31 → Feb 1 correctly returns 0 months, not 1
export function monthsUntil(dateStr: string): number {
  const now = new Date();
  const d = new Date(dateStr);
  const months = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  const dayAdjust = d.getDate() < now.getDate() ? -1 : 0;
  return Math.max(0, months + dayAdjust);
}

export function requiredMonthlyForGoal(
  target: number,
  current: number,
  months: number,
  annualReturn: number,
): number {
  if (months <= 0) return 0;
  const r = annualReturn / 100 / 12;
  const fvCurrent = current * Math.pow(1 + r, months);
  const remaining = Math.max(0, target - fvCurrent);
  if (r === 0) return remaining / months;
  return (remaining * r) / (Math.pow(1 + r, months) - 1);
}

/** Number of periods between two ISO dates for a given frequency. */
function periodsBetween(start: string, end: string, freq: ContributionFreq): number {
  const s = new Date(start);
  const e = new Date(end);
  const days = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24);
  switch (freq) {
    case 'weekly':
      return Math.floor(days / 7);
    case 'monthly':
      return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    case 'quarterly':
      return Math.floor(((e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())) / 3);
  }
}

/**
 * Project a recurring contribution into dated entries up to `asOf`.
 * Respects pause: a paused contribution stops generating entries from its pausedDate.
 */
export function projectedContributionEntries(c: Contribution, asOf: string): { date: string; amount: number }[] {
  if (c.type !== 'recurring') return [];
  const freq = c.freq || 'monthly';
  const start = new Date(c.startDate);
  // For paused: stop at pausedDate. For closed: stop at closedDate. For active: stop at asOf.
  let endStr: string;
  if (c.status === 'paused' && c.pausedDate) endStr = c.pausedDate;
  else if (c.status === 'closed' && c.closedDate) endStr = c.closedDate;
  else endStr = asOf;
  // Don't project past asOf for active/paused (closed is historical, cap at asOf too)
  const endCap = new Date(asOf).getTime() < new Date(endStr).getTime() ? asOf : endStr;
  const count = Math.max(0, periodsBetween(c.startDate, endCap, freq));
  const entries: { date: string; amount: number }[] = [];
  for (let i = 0; i <= count; i++) {
    let d: Date;
    if (freq === 'weekly') d = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    else if (freq === 'quarterly') d = new Date(start.getFullYear(), start.getMonth() + i * 3, start.getDate());
    else d = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
    if (d.getTime() > new Date(endCap).getTime()) break;
    entries.push({ date: d.toISOString().slice(0, 10), amount: c.amount });
  }
  return entries;
}

/** Total contributed amount for a holding (one-time + projected recurring). */
export function totalContributed(contributions: Contribution[], holdingId: string, asOf: string): number {
  return contributions
    .filter((c) => c.holdingId === holdingId)
    .reduce((sum, c) => {
      if (c.type === 'onetime') return sum + c.amount;
      return sum + projectedContributionEntries(c, asOf).reduce((s, e) => s + e.amount, 0);
    }, 0);
}

/** Monthly contribution total for a holding (active recurring only). */
export function monthlyContribution(contributions: Contribution[], holdingId: string): number {
  return contributions
    .filter((c) => c.holdingId === holdingId && isRecurringActive(c))
    .reduce((sum, c) => {
      const freq = c.freq || 'monthly';
      const monthly = freq === 'weekly' ? c.amount * 4.33 : freq === 'quarterly' ? c.amount / 3 : c.amount;
      return sum + monthly;
    }, 0);
}
