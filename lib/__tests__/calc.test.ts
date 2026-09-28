import { describe, expect, it } from 'vitest';
import type { Category, Contribution, Debt, Goal, Investment, Transaction } from '../types';
import {
  ALLOCATION_KEYS,
  actualAllocation,
  allocationDrift,
  assetsAfterPayments,
  avgMonthlyExpenses,
  avgMonthlyIncome,
  bandForAge,
  bandLabelForAge,
  cagr,
  computeRatios,
  computeTotals,
  debtPayoffMonths,
  debtStrategyPlan,
  debtStrategies,
  debtsAsOf,
  goalCurrentAmount,
  goalMonthlyContribution,
  inPeriod,
  investmentXirr,
  monthKey,
  monthlyContribution,
  monthsUntil,
  netWorth,
  projectNetWorth,
  projectedContributionEntries,
  recurringTransactionsThrough,
  requiredMonthlyForGoal,
  totalContributed,
  xirr,
  yearKey,
} from '../calc';

function txn(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'categoryId' | 'date' | 'type'>): Transaction {
  return { recurring: 'none', status: 'active', ...overrides };
}

function debt(overrides: Partial<Debt> & Pick<Debt, 'id'>): Debt {
  return {
    type: 'loan',
    name: 'Loan',
    outstanding: 0,
    interestRate: 0,
    emi: 0,
    tenureMonths: 0,
    date: '2024-01-01',
    status: 'active',
    ...overrides,
  };
}

function contribution(overrides: Partial<Contribution> & Pick<Contribution, 'id' | 'holdingId' | 'amount'>): Contribution {
  return { holdingKind: 'investment', type: 'recurring', startDate: '2024-01-01', status: 'active', ...overrides };
}

function investment(overrides: Partial<Investment> & Pick<Investment, 'id'>): Investment {
  return {
    type: 'stocks',
    name: 'Inv',
    purchaseValue: 0,
    currentValue: 0,
    purchaseDate: '2024-01-01',
    status: 'active',
    ...overrides,
  };
}

describe('period keys', () => {
  it('extracts month and year keys from an ISO date', () => {
    expect(monthKey('2024-03-15')).toBe('2024-03');
    expect(yearKey('2024-03-15')).toBe('2024');
  });

  it('matches dates within the same month/year for inPeriod', () => {
    expect(inPeriod('2024-03-01', 'monthly', '2024-03-28')).toBe(true);
    expect(inPeriod('2024-02-28', 'monthly', '2024-03-01')).toBe(false);
    expect(inPeriod('2024-01-01', 'annual', '2024-12-31')).toBe(true);
    expect(inPeriod('2023-12-31', 'annual', '2024-01-01')).toBe(false);
  });
});

describe('computeTotals', () => {
  const categories: Category[] = [
    { id: 'rent', name: 'Rent', type: 'expense', fixed: true, need: true },
    { id: 'fun', name: 'Fun', type: 'expense', fixed: false, need: false },
    { id: 'salary', name: 'Salary', type: 'income' },
  ];

  it('splits income/expenses and the fixed/need axes for the reference month only', () => {
    const transactions: Transaction[] = [
      txn({ id: '1', type: 'income', amount: 5000, categoryId: 'salary', date: '2024-03-01' }),
      txn({ id: '2', type: 'expense', amount: 1500, categoryId: 'rent', date: '2024-03-05' }),
      txn({ id: '3', type: 'expense', amount: 300, categoryId: 'fun', date: '2024-03-10' }),
      txn({ id: '4', type: 'expense', amount: 9999, categoryId: 'fun', date: '2024-02-10' }), // outside period
    ];
    const totals = computeTotals(transactions, categories, 'monthly', '2024-03-20');
    expect(totals.income).toBe(5000);
    expect(totals.expenses).toBe(1800);
    expect(totals.savings).toBe(3200);
    expect(totals.savingsRate).toBeCloseTo(0.64);
    expect(totals.fixedExpenses).toBe(1500);
    expect(totals.variableExpenses).toBe(300);
    expect(totals.needExpenses).toBe(1500);
    expect(totals.wantExpenses).toBe(300);
    expect(totals.byCategory.rent).toBe(1500);
  });

  it('reports a zero savings rate rather than dividing by zero when there is no income', () => {
    const totals = computeTotals(
      [txn({ id: '1', type: 'expense', amount: 100, categoryId: 'fun', date: '2024-03-01' })],
      categories,
      'monthly',
      '2024-03-01',
    );
    expect(totals.income).toBe(0);
    expect(totals.savingsRate).toBe(0);
  });
});

describe('netWorth and computeRatios', () => {
  it('adds assets and investments and subtracts debt', () => {
    const nw = netWorth({
      assets: [{ id: 'a', type: 'cash', name: 'Cash', value: 1000, liquid: true, date: '2024-01-01' }],
      investments: [investment({ id: 'i', currentValue: 500 })],
      debts: [debt({ id: 'd', outstanding: 200 })],
    });
    expect(nw).toBe(1300);
  });

  it('flags an impossible debt load (payments but no income) as red, not a NaN/Infinity leak', () => {
    const ratios = computeRatios(
      {
        transactions: [],
        categories: [],
        assets: [],
        investments: [],
        debts: [debt({ id: 'd', outstanding: 1000, emi: 100, interestRate: 12 })],
        goals: [],
        contributions: [],
        settings: {} as never,
      },
      '2024-06-01',
    );
    expect(ratios.debtServiceRatio).toBe(Infinity);
    expect(ratios.debtServiceZone).toBe('red');
    expect(ratios.emergencyFundMonths).toBeNull();
  });

  it('zones debt-to-asset by the documented thresholds', () => {
    const base = {
      transactions: [],
      categories: [],
      investments: [],
      goals: [],
      contributions: [],
      settings: {} as never,
    };
    const assets = [{ id: 'a', type: 'cash' as const, name: 'Cash', value: 1000, liquid: true, date: '2024-01-01' }];
    const green = computeRatios({ ...base, assets, debts: [debt({ id: 'd', outstanding: 300 })] }, '2024-01-01');
    const yellow = computeRatios({ ...base, assets, debts: [debt({ id: 'd', outstanding: 500 })] }, '2024-01-01');
    const red = computeRatios({ ...base, assets, debts: [debt({ id: 'd', outstanding: 700 })] }, '2024-01-01');
    expect(green.debtToAssetZone).toBe('green');
    expect(yellow.debtToAssetZone).toBe('yellow');
    expect(red.debtToAssetZone).toBe('red');
  });
});

describe('cagr', () => {
  it('computes annualised growth over exactly one year', () => {
    expect(cagr(100, 110, '2023-01-01', '2024-01-01')).toBeCloseTo(0.1, 2);
  });

  it('returns 0 for non-positive inputs instead of NaN/Infinity', () => {
    expect(cagr(0, 100, '2023-01-01', '2024-01-01')).toBe(0);
    expect(cagr(100, 100, '2024-01-01', '2024-01-01')).toBe(0); // zero elapsed time
  });
});

describe('allocation bands', () => {
  it('picks the band matching the exact boundary ages', () => {
    expect(bandLabelForAge(35)).toBe('20–35');
    expect(bandLabelForAge(36)).toBe('36–45');
    expect(bandLabelForAge(56)).toBe('56+');
  });

  it('clamps ages outside the defined bands to the nearest one', () => {
    expect(bandLabelForAge(5)).toBe('20–35');
    expect(bandLabelForAge(150)).toBe('56+');
  });

  it('produces weights that sum to 1', () => {
    const band = bandForAge(30);
    const sum = ALLOCATION_KEYS.reduce((s, k) => s + band[k], 0);
    expect(sum).toBeCloseTo(1);
  });
});

describe('actualAllocation', () => {
  it('folds gold assets into the gold bucket alongside gold investments', () => {
    const result = actualAllocation(
      [investment({ id: 'i1', type: 'stocks', currentValue: 300 }), investment({ id: 'i2', type: 'gold' as never, currentValue: 100 })],
      [{ id: 'a1', type: 'gold', name: 'Coins', value: 100, liquid: false, date: '2024-01-01' }],
    );
    // total = 300 (stocks) + 100 (gold inv) + 100 (gold asset) = 500
    expect(result.stocks).toBeCloseTo(0.6);
    expect(result.gold).toBeCloseTo(0.4);
  });

  it('does not divide by zero when there are no holdings', () => {
    const result = actualAllocation([], []);
    expect(result.stocks).toBe(0);
  });
});

describe('allocationDrift', () => {
  it('rescales built-in targets to 100% when custom targets are present', () => {
    const target = { stocks: 0.4, mutualfund: 0.2, fd: 0, ppf: 0, gold: 0, crypto: 0, other: 0, custom: true, customTargets: [{ id: 'c1', name: 'Startup', value: 0.4 }] };
    const actual = { stocks: 0.6, mutualfund: 0.4, fd: 0, ppf: 0, gold: 0, crypto: 0, other: 0 };
    const drift = allocationDrift(actual, target);
    // built-in total is 0.6, so stocks target rescales from 0.4 to 0.4/0.6 = 0.667
    const stocksDrift = drift.find((d) => d.type === 'stocks')!;
    expect(stocksDrift.target).toBeCloseTo(0.667, 2);
  });

  it('leaves targets alone when there are no custom targets to steal share', () => {
    const target = { stocks: 0.4, mutualfund: 0.6, fd: 0, ppf: 0, gold: 0, crypto: 0, other: 0, custom: false };
    const actual = { stocks: 0.5, mutualfund: 0.5, fd: 0, ppf: 0, gold: 0, crypto: 0, other: 0 };
    const drift = allocationDrift(actual, target);
    expect(drift.find((d) => d.type === 'stocks')!.target).toBe(0.4);
  });
});

describe('debtPayoffMonths', () => {
  it('is 0 for an already-cleared debt', () => {
    expect(debtPayoffMonths(debt({ id: 'd', outstanding: 0 }))).toBe(0);
  });

  it('falls back to remaining tenure when there is no EMI', () => {
    expect(debtPayoffMonths(debt({ id: 'd', outstanding: 1000, emi: 0, tenureMonths: 24 }))).toBe(24);
    expect(debtPayoffMonths(debt({ id: 'd', outstanding: 1000, emi: 0, tenureMonths: 0 }))).toBe(Infinity);
  });

  it('does simple division when there is no interest', () => {
    expect(debtPayoffMonths(debt({ id: 'd', outstanding: 1000, emi: 250, interestRate: 0 }))).toBe(4);
  });

  it('never finishes when the EMI does not even cover monthly interest', () => {
    // 1000 outstanding at 24%/yr = 2%/mo = 20 interest/mo; a 15 EMI can never touch principal
    expect(debtPayoffMonths(debt({ id: 'd', outstanding: 1000, emi: 15, interestRate: 24 }))).toBe(Infinity);
  });

  it('matches standard amortization for a real EMI/rate pair', () => {
    // n = ceil(-ln(1 - r*P/E) / ln(1+r)) with r=1%/mo, P=100000, E=2000 -> 70 months
    const months = debtPayoffMonths(debt({ id: 'd', outstanding: 100000, emi: 2000, interestRate: 12 }));
    expect(months).toBe(70);
  });
});

describe('debtsAsOf', () => {
  it('leaves a debt alone when it has no linked EMI schedule', () => {
    const [result] = debtsAsOf([debt({ id: 'd', outstanding: 1000, emi: 100 })], [], '2024-06-01');
    expect(result.outstanding).toBe(1000);
  });

  it('accrues interest and applies each due EMI in order', () => {
    const d = debt({ id: 'd', outstanding: 1000, emi: 200, interestRate: 12, date: '2024-01-01', tenureMonths: 10 });
    const schedule = contribution({
      id: 'c1',
      holdingKind: 'debt',
      holdingId: 'd',
      amount: 200,
      freq: 'monthly',
      startDate: '2024-01-01',
    });
    const [result] = debtsAsOf([d], [schedule], '2024-04-01');
    // Payments strictly after debt.date (2024-01-01) and on/before asOf: Feb, Mar, Apr.
    // 1000*1.01-200=810; 810*1.01-200=618.1; 618.1*1.01-200=424.281
    expect(result.outstanding).toBeCloseTo(424.281, 2);
    expect(result.tenureMonths).toBe(7);
  });

  it('treats a debt paid down to near-zero as fully closed', () => {
    const d = debt({ id: 'd', outstanding: 150, emi: 1000, interestRate: 0, date: '2024-01-01' });
    const schedule = contribution({ id: 'c1', holdingKind: 'debt', holdingId: 'd', amount: 1000, freq: 'monthly', startDate: '2024-01-01' });
    const [result] = debtsAsOf([d], [schedule], '2024-06-01');
    expect(result.outstanding).toBe(0);
  });
});

describe('projectedContributionEntries', () => {
  it('generates monthly entries anchored to the start date, clamping month-end overflow', () => {
    const entries = projectedContributionEntries(
      contribution({ id: 'c', holdingId: 'h', amount: 100, freq: 'monthly', startDate: '2024-01-31' }),
      '2024-04-30',
    );
    // Feb has no 31st -> clamps to 29 (2024 is a leap year); Mar/Apr back to 31/30
    expect(entries.map((e) => e.date)).toEqual(['2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30']);
  });

  it('stops generating entries at the pause date even if asOf is later', () => {
    const entries = projectedContributionEntries(
      contribution({ id: 'c', holdingId: 'h', amount: 100, freq: 'monthly', startDate: '2024-01-01', status: 'paused', pausedDate: '2024-02-15' }),
      '2024-06-01',
    );
    expect(entries.map((e) => e.date)).toEqual(['2024-01-01', '2024-02-01']);
  });

  it('skips occurrences that fall inside a past skipped range', () => {
    const entries = projectedContributionEntries(
      contribution({
        id: 'c',
        holdingId: 'h',
        amount: 100,
        freq: 'monthly',
        startDate: '2024-01-01',
        skipped: [{ from: '2024-01-15', to: '2024-03-15' }],
      }),
      '2024-04-01',
    );
    expect(entries.map((e) => e.date)).toEqual(['2024-01-01', '2024-04-01']);
  });

  it('returns nothing for a one-time contribution', () => {
    expect(projectedContributionEntries(contribution({ id: 'c', holdingId: 'h', amount: 100, type: 'onetime' }), '2024-12-31')).toEqual([]);
  });
});

describe('totalContributed / monthlyContribution', () => {
  it('sums one-time and projected recurring contributions for a holding', () => {
    const contributions = [
      contribution({ id: 'c1', holdingId: 'h', amount: 5000, type: 'onetime', startDate: '2024-01-01' }),
      contribution({ id: 'c2', holdingId: 'h', amount: 100, freq: 'monthly', startDate: '2024-01-01' }),
    ];
    // onetime 5000 + 3 monthly entries (Jan/Feb/Mar) = 5300
    expect(totalContributed(contributions, 'h', '2024-03-15')).toBe(5300);
  });

  it('normalizes weekly and quarterly contributions to a monthly figure, ignoring paused ones', () => {
    const contributions = [
      contribution({ id: 'c1', holdingId: 'h', amount: 700, freq: 'weekly' }),
      contribution({ id: 'c2', holdingId: 'h', amount: 300, freq: 'quarterly' }),
      contribution({ id: 'c3', holdingId: 'h', amount: 999, status: 'paused' }),
    ];
    expect(monthlyContribution(contributions, 'h')).toBeCloseTo((700 * 52) / 12 + 100);
  });
});

describe('assetsAfterPayments', () => {
  it('draws from the largest liquid balance first and never goes negative', () => {
    const assets = [
      { id: 'a1', type: 'bank' as const, name: 'Savings', value: 500, liquid: true, date: '2024-01-01' },
      { id: 'a2', type: 'cash' as const, name: 'Wallet', value: 2000, liquid: true, date: '2024-01-01' },
      { id: 'a3', type: 'realestate' as const, name: 'House', value: 1000000, liquid: false, date: '2024-01-01' },
    ];
    const debts = [debt({ id: 'd', outstanding: 1000, emi: 200, date: '2023-01-01' })];
    const schedule = [contribution({ id: 'c', holdingKind: 'debt', holdingId: 'd', amount: 200, freq: 'monthly', startDate: '2023-01-01' })];
    const result = assetsAfterPayments(assets, debts, [], schedule, '2024-01-01', '2024-03-01');
    const wallet = result.find((a) => a.id === 'a2')!;
    const house = result.find((a) => a.id === 'a3')!;
    // Two EMIs due (Feb, Mar) = 400 outflow, taken from the larger liquid balance (wallet) first
    expect(wallet.value).toBe(1600);
    expect(result.find((a) => a.id === 'a1')!.value).toBe(500); // untouched
    expect(house.value).toBe(1000000); // illiquid, never touched
  });

  it('is a no-op when nothing has fallen due', () => {
    const assets = [{ id: 'a1', type: 'cash' as const, name: 'Wallet', value: 100, liquid: true, date: '2024-01-01' }];
    expect(assetsAfterPayments(assets, [], [], [], '2024-06-01', '2024-06-01')).toBe(assets);
  });
});

describe('goal helpers', () => {
  it('uses the manual amount and contribution when nothing is linked', () => {
    const goal: Goal = { id: 'g', name: 'Trip', targetAmount: 1000, currentAmount: 200, targetDate: '2025-01-01', monthlyContribution: 50, kind: 'other' };
    expect(goalCurrentAmount(goal, { assets: [], investments: [] })).toBe(200);
    expect(goalMonthlyContribution(goal, [])).toBe(50);
  });

  it('sums linked holdings instead of the manual amount, excluding closed investments', () => {
    const goal: Goal = { id: 'g', name: 'House', targetAmount: 1000, currentAmount: 200, targetDate: '2025-01-01', monthlyContribution: 50, kind: 'house', linkedIds: ['a1', 'i1', 'i2'] };
    const data = {
      assets: [{ id: 'a1', type: 'bank' as const, name: 'Fund', value: 300, liquid: true, date: '2024-01-01' }],
      investments: [investment({ id: 'i1', currentValue: 400 }), investment({ id: 'i2', currentValue: 999, status: 'closed' })],
    };
    expect(goalCurrentAmount(goal, data)).toBe(700);
  });
});

describe('debtStrategies and debtStrategyPlan', () => {
  const debts = [
    debt({ id: 'small', outstanding: 500, interestRate: 5, emi: 100 }),
    debt({ id: 'big', outstanding: 5000, interestRate: 20, emi: 300 }),
  ];

  it('orders snowball by smallest balance and avalanche by highest rate', () => {
    const { snowball, avalanche } = debtStrategies(debts);
    expect(snowball.map((d) => d.id)).toEqual(['small', 'big']);
    expect(avalanche.map((d) => d.id)).toEqual(['big', 'small']);
  });

  it('pays off the smallest debt first and rolls its minimum into the next one', () => {
    const plan = debtStrategyPlan(debts);
    const small = plan.items.find((i) => i.debt.id === 'small')!;
    const big = plan.items.find((i) => i.debt.id === 'big')!;
    expect(small.months).toBeLessThan(big.months);
    expect(plan.totalMonths).toBe(big.months);
  });

  it('reports an infinite payoff when the combined EMI never clears every balance', () => {
    const stuck = [debt({ id: 'd', outstanding: 100000, interestRate: 50, emi: 1 })];
    const plan = debtStrategyPlan(stuck);
    expect(plan.items[0].months).toBe(Infinity);
    expect(plan.totalInterest).toBe(Infinity);
  });
});

describe('average monthly income/expenses', () => {
  it('averages only completed months, skipping the in-progress one', () => {
    const transactions = [
      txn({ id: '1', type: 'expense', amount: 100, categoryId: 'c', date: '2024-04-01' }), // 1 month back
      txn({ id: '2', type: 'expense', amount: 200, categoryId: 'c', date: '2024-03-01' }), // 2 months back
      txn({ id: '3', type: 'expense', amount: 9999, categoryId: 'c', date: '2024-05-01' }), // current month, excluded
    ];
    expect(avgMonthlyExpenses(transactions, '2024-05-15')).toBe(150); // average of the two completed months with data
  });

  it('falls back to the current month when there is no completed history', () => {
    const transactions = [txn({ id: '1', type: 'income', amount: 5000, categoryId: 'c', date: '2024-05-10' })];
    expect(avgMonthlyIncome(transactions, '2024-05-15')).toBe(5000);
  });
});

describe('projections', () => {
  it('projectNetWorth compounds monthly and matches simple addition when return is 0', () => {
    expect(projectNetWorth(1000, 100, 1, 0)).toBe(1000 + 100 * 12);
    expect(projectNetWorth(1000, 0, 10, 12)).toBeGreaterThan(1000);
  });

  it('goalProgress-adjacent monthsUntil is day-aware', () => {
    const future = new Date();
    future.setMonth(future.getMonth() + 3);
    const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-01`;
    expect(monthsUntil(iso)).toBeGreaterThanOrEqual(2);
  });

  it('requiredMonthlyForGoal returns 0 once the target is already funded', () => {
    expect(requiredMonthlyForGoal(1000, 2000, 12, 10)).toBe(0);
  });

  it('requiredMonthlyForGoal divides evenly with no growth assumed', () => {
    expect(requiredMonthlyForGoal(1200, 0, 12, 0)).toBeCloseTo(100);
  });
});

describe('xirr / investmentXirr', () => {
  it('resolves to roughly the simple annualised return for a single-flow investment', () => {
    // Invested 1000 a year ago, worth 1100 now -> ~10% XIRR
    const rate = xirr([
      { date: '2023-01-01', amount: -1000 },
      { date: '2024-01-01', amount: 1100 },
    ]);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.1, 1);
  });

  it('returns null when every flow has the same sign (no real return to solve for)', () => {
    expect(xirr([{ date: '2023-01-01', amount: -100 }, { date: '2024-01-01', amount: -50 }])).toBeNull();
    expect(xirr([{ date: '2023-01-01', amount: 100 }])).toBeNull();
  });

  it('investmentXirr falls back to the purchase entry when there are no logged contributions', () => {
    const rate = investmentXirr([], 'h', 1000, '2023-01-01', 1200, '2024-01-01');
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.2, 1);
  });
});

describe('recurringTransactionsThrough', () => {
  it('materializes monthly occurrences up to asOf without mutating the stored transaction', () => {
    const stored = txn({ id: 't1', type: 'expense', amount: 50, categoryId: 'c', date: '2024-01-15', recurring: 'monthly' });
    const result = recurringTransactionsThrough([stored], '2024-04-01');
    expect(result.map((r) => r.date)).toEqual(['2024-01-15', '2024-02-15', '2024-03-15']);
    expect(stored.date).toBe('2024-01-15'); // original untouched
    expect(result[1].recurringRef).toBe('t1');
    expect(result[1].recurring).toBe('none');
  });

  it('stops generating occurrences once the schedule is paused', () => {
    const stored = txn({
      id: 't1',
      type: 'expense',
      amount: 50,
      categoryId: 'c',
      date: '2024-01-01',
      recurring: 'monthly',
      status: 'paused',
      pausedDate: '2024-02-10',
    });
    const result = recurringTransactionsThrough([stored], '2024-06-01');
    expect(result.map((r) => r.date)).toEqual(['2024-01-01', '2024-02-01']);
  });

  it('passes through non-recurring transactions dated on or before asOf only', () => {
    const past = txn({ id: '1', type: 'expense', amount: 10, categoryId: 'c', date: '2024-01-01' });
    const future = txn({ id: '2', type: 'expense', amount: 10, categoryId: 'c', date: '2099-01-01' });
    expect(recurringTransactionsThrough([past, future], '2024-06-01').map((r) => r.id)).toEqual(['1']);
  });
});
