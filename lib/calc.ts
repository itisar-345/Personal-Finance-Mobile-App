import type {
  Transaction,
  Asset,
  Investment,
  Debt,
  Category,
  AppData,
  Contribution,
  AllocationTarget,
  AllocationKey,
  SkippedRange,
  Goal,
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

/** True when `date` falls strictly inside a past pause/close window (the pause day and resume day still count). */
function inSkippedRange(date: string, skipped?: SkippedRange[]): boolean {
  return !!skipped?.some((range) => date > range.from && date < range.to);
}

/** Materialize recurring transaction occurrences through `asOf` without duplicating stored data. */
export function recurringTransactionsThrough(transactions: Transaction[], asOf: string): Transaction[] {
  const result: Transaction[] = [];
  for (const transaction of transactions) {
    if (transaction.recurring === 'none') {
      if (transaction.date <= asOf) result.push(transaction);
      continue;
    }

    // Paused and closed schedules retain their history, but stop at the lifecycle date.
    const lifecycleEnd = transaction.status === 'active'
      ? asOf
      : (transaction.closedDate || transaction.pausedDate || transaction.date);
    const endDate = lifecycleEnd < asOf ? lifecycleEnd : asOf;
    if (transaction.date > endDate) continue;

    result.push(transaction);
    let occurrence = nextRecurringDate(transaction.date, transaction.recurring);
    while (occurrence <= endDate) {
      if (!inSkippedRange(occurrence, transaction.skipped)) result.push({
        ...transaction,
        id: `${transaction.id}:occurrence:${occurrence}`,
        date: occurrence,
        recurringRef: transaction.id,
        recurring: 'none',
        status: 'active',
        pausedDate: undefined,
        closedDate: undefined,
        skipped: undefined,
      });
      occurrence = nextRecurringDate(occurrence, transaction.recurring, transaction.date);
    }
  }
  return result;
}

function nextRecurringDate(current: string, frequency: Exclude<Transaction['recurring'], 'none'>, anchor = current): string {
  const [currentYear, currentMonth] = current.split('-').map(Number);
  const [, anchorMonth, anchorDay] = anchor.split('-').map(Number);
  const year = frequency === 'monthly'
    ? currentYear + (currentMonth === 12 ? 1 : 0)
    : currentYear + 1;
  const month = frequency === 'monthly' ? (currentMonth % 12) + 1 : anchorMonth;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(anchorDay, lastDay)).padStart(2, '0')}`;
}

function dateAfterMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const totalMonths = year * 12 + month - 1 + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/** Parse YYYY-MM-DD as a local date (new Date(str) would parse as UTC and shift the day/month in some timezones). */
function parseISODate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function dateAfterDays(date: string, days: number): string {
  const value = parseISODate(date);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
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
  return assets.reduce((s, a) => s + a.value, 0);
}

export function liquidAssets(assets: Asset[]): number {
  return assets.filter((a) => a.liquid).reduce((s, a) => s + a.value, 0);
}

export function totalInvestments(investments: Investment[]): number {
  return investments.filter(countsNow).reduce((s, i) => s + i.currentValue, 0);
}

export function totalDebt(debts: Debt[]): number {
  return debts.filter(countsNow).reduce((s, d) => s + d.outstanding, 0);
}

export function monthlyDebtPayments(debts: Debt[]): number {
  // Paused debts remain part of net worth, but their payment schedule is not due.
  return debts.filter((d) => d.status === 'active').reduce((s, d) => s + d.emi, 0);
}

export function netWorth(data: Pick<AppData, 'assets' | 'investments' | 'debts'>): number {
  return totalAssets(data.assets) + totalInvestments(data.investments) - totalDebt(data.debts);
}

export interface Ratios {
  savings: number;
  savingsRate: number;
  debtServiceRatio: number;
  debtServiceZone: 'green' | 'yellow' | 'red';
  /** null = no expense history yet (can't compute); Infinity = debt with no income (worst case) */
  emergencyFundMonths: number | null;
  liquidityRatio: number;
  debtToAsset: number;
  debtToAssetZone: 'green' | 'yellow' | 'red';
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

  const debtServiceRatio = avgMonthlyInc > 0 ? debtPmt / avgMonthlyInc : (debtPmt > 0 ? Infinity : 0);
  const totalAssetsPlusInvest = assets + invest;
  const debtToAsset = totalAssetsPlusInvest > 0 ? debt / totalAssetsPlusInvest : (debt > 0 ? Infinity : 0);
  const emergencyFundMonths: number | null = avgMonthlySpend > 0 ? liquid / avgMonthlySpend : null;

  return {
    savings: totals.savings,
    savingsRate: totals.savingsRate,
    debtServiceRatio,
    debtServiceZone:
      !isFinite(debtServiceRatio) ? 'red' : debtServiceRatio <= 0.36 ? 'green' : debtServiceRatio <= 0.43 ? 'yellow' : 'red',
    emergencyFundMonths,
    // Liquid assets as a share of net worth (benchmark: at least 15%). Months of cover is emergencyFundMonths.
    liquidityRatio: nw > 0 ? liquid / nw : 0,
    debtToAsset,
    debtToAssetZone:
      !isFinite(debtToAsset) ? 'red' : debtToAsset < 0.4 ? 'green' : debtToAsset < 0.6 ? 'yellow' : 'red',
    netWorth: nw,
  };
}

/** CAGR for a single investment relative to a reference date (defaults to today). */
export function cagr(purchaseValue: number, currentValue: number, purchaseDate: string, asOf?: string): number {
  const end = asOf ? parseISODate(asOf).getTime() : Date.now();
  const years = (end - parseISODate(purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years <= 0 || purchaseValue <= 0 || currentValue <= 0) return 0;
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

function findBand(age: number): AllocationBand {
  return (
    ALLOCATION_BANDS.find((b) => age >= b.minAge && age <= b.maxAge) ??
    (age < ALLOCATION_BANDS[0].minAge ? ALLOCATION_BANDS[0] : ALLOCATION_BANDS[ALLOCATION_BANDS.length - 1])
  );
}

export function bandForAge(age: number): AllocationTarget {
  const b = findBand(age);
  return { stocks: b.stocks, mutualfund: b.mutualfund, fd: b.fd, ppf: b.ppf, gold: b.gold, crypto: b.crypto, other: b.other, custom: false };
}

export function bandLabelForAge(age: number): string {
  return findBand(age).label;
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
  const goldAssets = assets.filter((a) => a.type === 'gold').reduce((s, a) => s + a.value, 0);
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

export const ALLOCATION_KEYS: AllocationKey[] = [
  'stocks',
  'mutualfund',
  'fd',
  'ppf',
  'gold',
  'crypto',
  'other',
];

export const ALLOCATION_LABELS: Record<AllocationKey, string> = {
  stocks: 'Stocks',
  mutualfund: 'Mutual funds',
  fd: 'Fixed deposits',
  ppf: 'PPF',
  gold: 'Gold',
  crypto: 'Crypto',
  other: 'Other',
};

export function allocationTargetEntries(target?: AllocationTarget | null) {
  const entries: Array<{ id: string; key?: AllocationKey; name: string; value: number }> = [];
  for (const key of ALLOCATION_KEYS) {
    entries.push({
      id: key,
      key,
      name: ALLOCATION_LABELS[key],
      value: Number(target?.[key] ?? 0),
    });
  }
  for (const custom of target?.customTargets ?? []) {
    entries.push({
      id: custom.id,
      name: custom.name || 'Custom Target',
      value: Number(custom.value ?? 0),
    });
  }
  return entries;
}

export function allocationDrift(actual: ActualAllocation, target: AllocationTarget) {
  // Holdings can only be classified into the built-in types, so custom targets can never be
  // matched. Rescale the built-in targets to 100% so they don't read as a shortfall everywhere.
  const builtInTotal = ALLOCATION_KEYS.reduce((sum, k) => sum + (target[k] || 0), 0);
  const scale = builtInTotal > 0 && (target.customTargets?.length ?? 0) > 0 ? 1 / builtInTotal : 1;
  return ALLOCATION_KEYS.map((k) => {
    const targetValue = (target[k] || 0) * scale;
    return { type: k, actual: actual[k], target: targetValue, drift: actual[k] - targetValue };
  });
}

/** Remaining months to pay off a debt using standard amortization. */
export function debtPayoffMonths(debt: Debt): number {
  if (debt.outstanding <= 0) return 0;
  const r = debt.interestRate / 100 / 12;
  if (debt.emi <= 0) return debt.tenureMonths > 0 ? debt.tenureMonths : Infinity;
  if (r === 0) return Math.ceil(debt.outstanding / debt.emi);
  const monthlyInterest = r * debt.outstanding;
  if (debt.emi <= monthlyInterest) return Infinity;
  return Math.max(0, Math.ceil(-Math.log(1 - monthlyInterest / debt.emi) / Math.log(1 + r)));
}

/**
 * Debts as they stand on `asOf`: the stored outstanding balance is the balance on `debt.date`, and every
 * EMI that has fallen due since (per the linked recurring contribution, so pauses and skipped windows are
 * honoured) accrues one month of interest and then reduces it. Remaining tenure shrinks the same way.
 * Stored data is never rewritten; use this for display and totals, and the stored debt for editing.
 */
export function debtsAsOf(debts: Debt[], contributions: Contribution[], asOf: string): Debt[] {
  return debts.map((debt) => {
    if (debt.status === 'closed' || debt.emi <= 0) return debt;
    const schedule = contributions.find(
      (c) => c.holdingKind === 'debt' && c.holdingId === debt.id && c.type === 'recurring',
    );
    if (!schedule) return debt;
    const payments = projectedContributionEntries(schedule, asOf).filter((e) => e.date > debt.date);
    if (payments.length === 0) return debt;
    const monthlyRate = debt.interestRate / 100 / 12;
    let balance = debt.outstanding;
    let paid = 0;
    for (const payment of payments) {
      if (balance <= 0.005) break;
      balance = Math.max(0, balance * (1 + monthlyRate) - payment.amount);
      paid++;
    }
    return {
      ...debt,
      outstanding: balance <= 0.005 ? 0 : balance,
      tenureMonths: debt.tenureMonths > 0 ? Math.max(0, debt.tenureMonths - paid) : debt.tenureMonths,
    };
  });
}

/** Money a holding has received on or before `asOf`, counting only contributions dated after `since`. */
function contributionsSince(contributions: Contribution[], holdingKind: Contribution['holdingKind'], holdingId: string, since: string, asOf: string): number {
  let total = 0;
  for (const c of contributions) {
    if (c.holdingKind !== holdingKind || c.holdingId !== holdingId) continue;
    if (c.type === 'onetime') {
      if (c.startDate > since && c.startDate <= asOf) total += c.amount;
    } else {
      for (const e of projectedContributionEntries(c, asOf)) if (e.date > since) total += e.amount;
    }
  }
  return total;
}

/**
 * Investments as they stand on `asOf`: the value the user last entered plus everything contributed since
 * (SIP instalments and top-ups). Market movement is unknown until the user updates the value again.
 */
export function investmentsAsOf(investments: Investment[], contributions: Contribution[], asOf: string): Investment[] {
  return investments.map((inv) => {
    if (inv.status === 'closed' || !inv.valueUpdatedDate) return inv;
    const added = contributionsSince(contributions, 'investment', inv.id, inv.valueUpdatedDate, asOf);
    return added > 0 ? { ...inv, currentValue: inv.currentValue + added } : inv;
  });
}

/**
 * Liquid assets after EMI and SIP payments that fell due since `since` (when the user linked payments to
 * cash). The outflow is taken from the largest liquid balances first and never goes below zero.
 */
export function assetsAfterPayments(
  assets: Asset[],
  debts: Debt[],
  investments: Investment[],
  contributions: Contribution[],
  since: string,
  asOf: string,
): Asset[] {
  let outflow = 0;
  for (const debt of debts) outflow += contributionsSince(contributions, 'debt', debt.id, since, asOf);
  for (const inv of investments) outflow += contributionsSince(contributions, 'investment', inv.id, since, asOf);
  if (outflow <= 0) return assets;
  const result = assets.map((a) => ({ ...a }));
  for (const asset of result.filter((a) => a.liquid).sort((a, b) => b.value - a.value)) {
    if (outflow <= 0) break;
    const take = Math.min(asset.value, outflow);
    asset.value -= take;
    outflow -= take;
  }
  return result;
}

/**
 * App data with everything derived from schedules resolved to `asOf`: debt balances after EMIs, investment
 * values including contributions since the last update, and (if enabled) liquid assets after payments.
 * Stored data is never rewritten; edit forms should still work from the stored records.
 */
export function withLiveData<T extends Pick<AppData, 'debts' | 'contributions' | 'investments' | 'assets' | 'settings'>>(data: T, asOf: string): T {
  const { contributions, settings } = data;
  const debts = debtsAsOf(data.debts, contributions, asOf);
  const investments = investmentsAsOf(data.investments, contributions, asOf);
  const assets = settings.linkPaymentsToCash && settings.cashLinkStart
    ? assetsAfterPayments(data.assets, data.debts, data.investments, contributions, settings.cashLinkStart, asOf)
    : data.assets;
  return { ...data, debts, investments, assets };
}

/** A goal's saved amount: the live value of its linked holdings, or the manually entered amount. */
export function goalCurrentAmount(goal: Goal, data: Pick<AppData, 'assets' | 'investments'>): number {
  if (!goal.linkedIds?.length) return goal.currentAmount;
  const ids = new Set(goal.linkedIds);
  const assets = data.assets.filter((a) => ids.has(a.id)).reduce((s, a) => s + a.value, 0);
  const invested = data.investments.filter((i) => ids.has(i.id)).reduce((s, i) => s + (i.status === 'closed' ? 0 : i.currentValue), 0);
  return assets + invested;
}

/** A goal's monthly contribution: active recurring contributions on its linked holdings, or the manual figure. */
export function goalMonthlyContribution(goal: Goal, contributions: Contribution[]): number {
  if (!goal.linkedIds?.length) return goal.monthlyContribution;
  return goal.linkedIds.reduce((sum, id) => sum + monthlyContribution(contributions, id), 0);
}

/** Snowball: pay smallest balance first. Avalanche: highest interest first. Only active/paused debts. */
export function debtStrategies(debts: Debt[]) {
  const open = debts.filter(countsNow);
  const snowball = [...open].sort((a, b) => a.outstanding - b.outstanding);
  const avalanche = [...open].sort((a, b) => b.interestRate - a.interestRate);
  return { snowball, avalanche };
}

export interface DebtStrategyPlanItem {
  debt: Debt;
  months: number;
  cumulativeMonths: number;
}

export interface DebtStrategyPlan {
  items: DebtStrategyPlanItem[];
  totalMonths: number;
  totalInterest: number;
}

/**
 * Project a payoff order. Each month interest accrues, every debt gets its minimum (EMI), and
 * whatever is left of the fixed total budget goes to the first debt in `order` still open, so
 * minimums of cleared debts roll over. Paused debts are not being paid, so they are left out.
 */
export function debtStrategyPlan(order: Debt[]): DebtStrategyPlan {
  const payable = order.filter((debt) => debt.status === 'active');
  const balances = new Map(payable.map((debt) => [debt.id, Math.max(0, debt.outstanding)]));
  const payoffMonths = new Map<string, number>();
  const monthlyBudget = payable.reduce((sum, debt) => sum + Math.max(0, debt.emi), 0);
  let totalInterest = 0;

  for (const debt of payable) {
    if (balances.get(debt.id)! <= 0.005) {
      balances.delete(debt.id);
      payoffMonths.set(debt.id, 0);
    }
  }

  if (balances.size > 0 && monthlyBudget > 0) {
    for (let month = 1; month <= 1200 && balances.size > 0; month++) {
      for (const debt of payable) {
        const balance = balances.get(debt.id);
        if (balance === undefined) continue;
        const interest = balance * (debt.interestRate / 100 / 12);
        totalInterest += interest;
        balances.set(debt.id, balance + interest);
      }

      let available = monthlyBudget;
      for (const debt of payable) {
        const balance = balances.get(debt.id);
        if (balance === undefined) continue;
        const minimum = Math.min(Math.max(0, debt.emi), balance);
        balances.set(debt.id, balance - minimum);
        available -= minimum;
      }

      for (const debt of payable) {
        if (available <= 0) break;
        const balance = balances.get(debt.id);
        if (balance === undefined) continue;
        const extra = Math.min(available, balance);
        balances.set(debt.id, balance - extra);
        available -= extra;
      }

      for (const debt of payable) {
        const balance = balances.get(debt.id);
        if (balance !== undefined && balance <= 0.005) {
          balances.delete(debt.id);
          payoffMonths.set(debt.id, month);
        }
      }
    }
  }

  const items = payable.map((debt) => ({
    debt,
    months: payoffMonths.get(debt.id) ?? Infinity,
    cumulativeMonths: payoffMonths.get(debt.id) ?? Infinity,
  }));
  return {
    items,
    totalMonths: items.length === 0 ? 0 : Math.max(...items.map((item) => item.months)),
    totalInterest: balances.size > 0 ? Infinity : totalInterest,
  };
}

/**
 * Average monthly total of `type` transactions over the (up to) 6 completed months before refDate's
 * month. The in-progress month is excluded because a partial month understates the average; it is
 * only used when there is no completed history yet. Months without any such transaction are skipped
 * so new users with little history don't get a falsely low average.
 */
function avgMonthlyTotal(transactions: Transaction[], refDate: string, type: 'income' | 'expense'): number {
  const ref = parseISODate(refDate);
  const monthlyTotals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    const mk = monthKey(t.date);
    monthlyTotals.set(mk, (monthlyTotals.get(mk) || 0) + t.amount);
  }
  const keyFor = (offset: number) => {
    const m = new Date(ref.getFullYear(), ref.getMonth() - offset, 1);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
  };
  const totals: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const v = monthlyTotals.get(keyFor(i));
    if (v !== undefined) totals.push(v);
  }
  if (totals.length === 0) return monthlyTotals.get(keyFor(0)) ?? 0;
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

export function avgMonthlyExpenses(transactions: Transaction[], refDate: string): number {
  return avgMonthlyTotal(transactions, refDate, 'expense');
}

export function avgMonthlyIncome(transactions: Transaction[], refDate: string): number {
  return avgMonthlyTotal(transactions, refDate, 'income');
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

/** Months remaining until a target date, day-aware (Jan 31 → Feb 1 = 0 months). */
export function monthsUntil(dateStr: string): number {
  const now = new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const months = (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  const dayAdjust = day < now.getDate() ? -1 : 0;
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

/**
 * Project a recurring contribution into dated entries up to `asOf`.
 * Respects pause: a paused contribution stops generating entries from its pausedDate.
 */
export function projectedContributionEntries(c: Contribution, asOf: string): { date: string; amount: number }[] {
  if (c.type !== 'recurring') return [];
  const freq = c.freq || 'monthly';
  let endStr: string;
  if (c.status === 'paused' && c.pausedDate) endStr = c.pausedDate;
  else if (c.status === 'closed' && c.closedDate) endStr = c.closedDate;
  else endStr = asOf;
  const endCap = endStr < asOf ? endStr : asOf; // min(endStr, asOf) — ISO strings are lexicographically ordered
  const entries: { date: string; amount: number }[] = [];
  // Every occurrence is derived from the start date (not the previous one) so month-end days clamp without drifting.
  for (let i = 0; i < 100000; i++) {
    const date = freq === 'weekly'
      ? dateAfterDays(c.startDate, i * 7)
      : dateAfterMonths(c.startDate, i * (freq === 'quarterly' ? 3 : 1));
    if (date > endCap) break;
    if (inSkippedRange(date, c.skipped)) continue;
    entries.push({ date, amount: c.amount });
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
      const monthly = freq === 'weekly' ? (c.amount * 52) / 12 : freq === 'quarterly' ? c.amount / 3 : c.amount;
      return sum + monthly;
    }, 0);
}

/**
 * XIRR (annualised money-weighted return) for dated cash flows: negative = money put in,
 * positive = value received / current value. Solved by bisection on the XNPV with an actual/365
 * day count, as Excel does. Returns null when no solution exists (needs an inflow and an outflow).
 */
export function xirr(flows: { date: string; amount: number }[]): number | null {
  if (flows.length < 2 || !flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const t0 = parseISODate(flows.reduce((min, f) => (f.date < min ? f.date : min), flows[0].date)).getTime();
  const dated = flows.map((f) => ({
    years: (parseISODate(f.date).getTime() - t0) / (1000 * 60 * 60 * 24 * 365),
    amount: f.amount,
  }));
  const npv = (rate: number) => dated.reduce((sum, f) => sum + f.amount / Math.pow(1 + rate, f.years), 0);
  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (!isFinite(fLo) || !isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) hi = mid;
    else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
}

/** Annualised return (XIRR) for an investment from its dated contributions and current value; falls back to the purchase entry. */
export function investmentXirr(
  contributions: Contribution[],
  holdingId: string,
  purchaseValue: number,
  purchaseDate: string,
  currentValue: number,
  asOf: string,
): number | null {
  const flows: { date: string; amount: number }[] = [];
  for (const c of contributions) {
    if (c.holdingId !== holdingId) continue;
    if (c.type === 'onetime') flows.push({ date: c.startDate, amount: -c.amount });
    else for (const e of projectedContributionEntries(c, asOf)) flows.push({ date: e.date, amount: -e.amount });
  }
  if (flows.length === 0) flows.push({ date: purchaseDate, amount: -purchaseValue });
  flows.push({ date: asOf, amount: currentValue });
  return xirr(flows);
}
