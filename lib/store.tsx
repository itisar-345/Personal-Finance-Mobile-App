import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { readData, writeData } from './storage';
import type {
  AppData,
  Transaction,
  Asset,
  Investment,
  Debt,
  Goal,
  Category,
  Settings,
  AllocationTarget,
  Contribution,
  Currency,
  ItemStatus,
  SkippedRange,
} from './types';
import { DEFAULT_DATA, genId } from './defaults';
import { ALLOCATION_KEYS, bandForAge, assetsAfterPayments } from './calc';
import { hashPin } from './crypto';
import { isValidIsoDate, todayISO } from './format';

interface StoreContextValue {
  data: AppData;
  ready: boolean;
  // transactions
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, t: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  // categories
  addCategory: (c: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, c: Partial<Category>) => void;
  /** Returns false (and changes nothing) when the category is the last of its type but still in use. */
  deleteCategory: (id: string) => boolean;
  // assets
  addAsset: (a: Omit<Asset, 'id'>) => string;
  updateAsset: (id: string, a: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
  // investments
  addInvestment: (i: Omit<Investment, 'id'>) => void;
  addInvestmentWithContribution: (i: Omit<Investment, 'id'>, c: Omit<Contribution, 'id' | 'holdingId'>) => void;
  updateInvestment: (id: string, i: Partial<Investment>) => void;
  deleteInvestment: (id: string) => void;
  // debts
  addDebt: (d: Omit<Debt, 'id'>) => string;
  updateDebt: (id: string, d: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;
  // goals
  addGoal: (g: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, g: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  // contributions
  addContribution: (c: Omit<Contribution, 'id'>) => void;
  updateContribution: (id: string, c: Partial<Contribution>) => void;
  deleteContribution: (id: string) => void;
  setContributionStatus: (id: string, status: ItemStatus, date?: string) => void;
  // lifecycle
  setTransactionStatus: (id: string, status: ItemStatus, date?: string) => void;
  setInvestmentStatus: (id: string, status: ItemStatus, date?: string) => void;
  setDebtStatus: (id: string, status: ItemStatus, date?: string) => void;
  // settings
  updateSettings: (s: Partial<Settings>) => void;
  setAllocationTargets: (t: AllocationTarget) => void;
  // bulk
  importData: (d: AppData) => void;
  resetData: () => void;
  exportData: () => AppData;
}

const StoreContext = createContext<StoreContextValue | null>(null);

interface Lifecycle {
  status: ItemStatus;
  pausedDate?: string;
  closedDate?: string;
  skipped?: SkippedRange[];
}

/**
 * Apply a status change. Leaving a paused/closed state records the gap so resuming
 * does not back-fill occurrences for the time the item was inactive.
 */
function applyStatus<T extends Lifecycle>(item: T, status: ItemStatus, iso: string): T {
  const inactiveSince = item.status === 'paused' ? item.pausedDate : item.status === 'closed' ? item.closedDate : undefined;
  const leaving = status === 'active' || (status === 'closed' && item.status === 'paused');
  const skipped = leaving && inactiveSince && inactiveSince < iso
    ? [...(item.skipped ?? []), { from: inactiveSince, to: iso }]
    : item.skipped;
  return {
    ...item,
    status,
    // Keep the original date if the item is already in the requested state.
    pausedDate: status === 'paused' ? (item.status === 'paused' && item.pausedDate ? item.pausedDate : iso) : undefined,
    closedDate: status === 'closed' ? (item.status === 'closed' && item.closedDate ? item.closedDate : iso) : undefined,
    skipped,
  };
}

/**
 * With payments linked to cash, stored liquid balances are a baseline as of `cashLinkStart`. Before that baseline
 * is disturbed (an asset edited or removed) fold the payments made so far into the stored balances and restart it today.
 */
function commitLiveCash(data: AppData): AppData {
  const { settings } = data;
  if (!settings.linkPaymentsToCash || !settings.cashLinkStart) return data;
  const today = todayISO();
  return {
    ...data,
    assets: assetsAfterPayments(data.assets, data.debts, data.investments, data.contributions, settings.cashLinkStart, today),
    settings: { ...settings, cashLinkStart: today },
  };
}

/** Drop a deleted holding from every goal's links; a goal left with no links reverts to its manual amounts. */
function unlinkFromGoals(goals: Goal[], holdingId: string): Goal[] {
  return goals.map((g) => g.linkedIds?.includes(holdingId)
    ? { ...g, linkedIds: g.linkedIds.filter((x) => x !== holdingId) }
    : g);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Keep a well-formed ISO date, otherwise fall back (a bad date shouldn't cost the user the whole item). */
function dateOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && isValidIsoDate(value) ? value : fallback;
}

/** Map every valid object in `input`, dropping entries that aren't usable at all. */
function cleanList<T>(input: unknown, clean: (raw: Record<string, any>) => T | null): T[] {
  if (!Array.isArray(input)) return [];
  const out: T[] = [];
  for (const raw of input) {
    const item = isObj(raw) ? clean(raw) : null;
    if (item) out.push(item);
  }
  return out;
}

const STATUSES = ['active', 'paused', 'closed'] as const;

/**
 * Rebuild AppData from untrusted input (a saved file or an imported backup): entries missing an id or
 * a usable number are dropped, enums and dates are coerced to valid values, and defaults fill gaps.
 */
function normalizeData(input?: Partial<AppData> | null): AppData {
  const settings: Partial<Settings> = isObj(input?.settings) ? (input!.settings as Partial<Settings>) : {};
  const date = todayISO();
  const categoryIds = new Set<string>();

  const categories = Array.isArray(input?.categories)
    ? cleanList<Category>(input!.categories, (c) => {
      if (!isStr(c.id) || !isStr(c.name)) return null;
      categoryIds.add(c.id);
      return { ...c, id: c.id, name: c.name, type: oneOf(c.type, ['income', 'expense'] as const, 'expense') } as Category;
    })
    : DEFAULT_DATA.categories;

  const currencies = cleanList<Currency>(settings.currencies, (c) =>
    isStr(c.code) && isStr(c.symbol) && isNum(c.rate) && c.rate > 0 ? { code: c.code, symbol: c.symbol, rate: c.rate } : null);
  const safeCurrencies = currencies.length > 0 ? currencies : DEFAULT_DATA.settings.currencies;
  const currencyCode = safeCurrencies.some((c) => c.code === settings.currencyCode)
    ? (settings.currencyCode as string)
    : safeCurrencies[0].code;

  return {
    transactions: cleanList<Transaction>(input?.transactions, (t) =>
      isStr(t.id) && isStr(t.categoryId) && isNum(t.amount) && t.amount >= 0
        ? {
          ...t,
          id: t.id,
          categoryId: t.categoryId,
          amount: t.amount,
          type: oneOf(t.type, ['income', 'expense'] as const, 'expense'),
          date: dateOr(t.date, date),
          recurring: oneOf(t.recurring, ['none', 'monthly', 'yearly'] as const, 'none'),
          status: oneOf(t.status, STATUSES, 'active'),
        } as Transaction
        : null),
    categories,
    assets: cleanList<Asset>(input?.assets, (a) =>
      isStr(a.id) && isNum(a.value)
        ? {
          ...a,
          id: a.id,
          name: typeof a.name === 'string' ? a.name : 'Asset',
          value: a.value,
          type: oneOf(a.type, ['cash', 'bank', 'realestate', 'gold', 'other'] as const, 'other'),
          date: dateOr(a.date, date),
          liquid: typeof a.liquid === 'boolean' ? a.liquid : a.type === 'cash' || a.type === 'bank',
        } as Asset
        : null),
    investments: cleanList<Investment>(input?.investments, (i) =>
      isStr(i.id) && isNum(i.purchaseValue) && isNum(i.currentValue)
        ? {
          ...i,
          id: i.id,
          name: typeof i.name === 'string' ? i.name : 'Investment',
          type: oneOf(i.type, ['stocks', 'mutualfund', 'fd', 'ppf', 'crypto', 'other'] as const, 'other'),
          purchaseValue: i.purchaseValue,
          currentValue: i.currentValue,
          purchaseDate: dateOr(i.purchaseDate, date),
          status: oneOf(i.status, STATUSES, 'active'),
          // Older data has no stamp; treat the stored value as current as of first load.
          valueUpdatedDate: dateOr(i.valueUpdatedDate, date),
        } as Investment
        : null),
    debts: cleanList<Debt>(input?.debts, (d) =>
      isStr(d.id) && isNum(d.outstanding) && isNum(d.interestRate) && isNum(d.emi)
        ? {
          ...d,
          id: d.id,
          name: typeof d.name === 'string' ? d.name : 'Debt',
          type: oneOf(d.type, ['loan', 'creditcard', 'emi'] as const, 'loan'),
          outstanding: d.outstanding,
          interestRate: d.interestRate,
          emi: d.emi,
          tenureMonths: isNum(d.tenureMonths) ? d.tenureMonths : 0,
          status: oneOf(d.status, STATUSES, 'active'),
          date: dateOr(d.date, date),
        } as Debt
        : null),
    goals: cleanList<Goal>(input?.goals, (g) =>
      isStr(g.id) && isNum(g.targetAmount) && isNum(g.currentAmount)
        ? {
          ...g,
          id: g.id,
          name: typeof g.name === 'string' ? g.name : 'Goal',
          kind: oneOf(g.kind, ['retirement', 'house', 'emergency', 'other'] as const, 'other'),
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          targetDate: dateOr(g.targetDate, date),
          monthlyContribution: isNum(g.monthlyContribution) ? g.monthlyContribution : 0,
          linkedIds: Array.isArray(g.linkedIds) ? g.linkedIds.filter(isStr) : undefined,
        } as Goal
        : null),
    contributions: cleanList<Contribution>(input?.contributions, (c) =>
      isStr(c.id) && isStr(c.holdingId) && isNum(c.amount)
        ? {
          ...c,
          id: c.id,
          holdingId: c.holdingId,
          amount: c.amount,
          holdingKind: oneOf(c.holdingKind, ['investment', 'asset', 'debt'] as const, 'investment'),
          type: oneOf(c.type, ['onetime', 'recurring'] as const, 'onetime'),
          freq: c.freq === undefined ? undefined : oneOf(c.freq, ['weekly', 'monthly', 'quarterly'] as const, 'monthly'),
          status: oneOf(c.status, STATUSES, 'active'),
          startDate: dateOr(c.startDate, date),
        } as Contribution
        : null),
    settings: {
      ...DEFAULT_DATA.settings,
      ...settings,
      theme: oneOf(settings.theme, ['light', 'dark', 'system'] as const, DEFAULT_DATA.settings.theme),
      currencies: safeCurrencies,
      currencyCode,
      expectedReturn: isNum(settings.expectedReturn) ? settings.expectedReturn : DEFAULT_DATA.settings.expectedReturn,
      age: isNum(settings.age) && settings.age > 0 && settings.age < 130 ? settings.age : null,
      allocationTargets: isObj(settings.allocationTargets) && ALLOCATION_KEYS.every((k) => isNum((settings.allocationTargets as any)[k]))
        ? settings.allocationTargets
        : null,
      linkPaymentsToCash: settings.linkPaymentsToCash === true,
      cashLinkStart: typeof settings.cashLinkStart === 'string' && isValidIsoDate(settings.cashLinkStart) ? settings.cashLinkStart : null,
      pinFailedAttempts: isNum(settings.pinFailedAttempts) ? settings.pinFailedAttempts : 0,
      pinLockedUntil: isNum(settings.pinLockedUntil) ? settings.pinLockedUntil : null,
    },
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [ready, setReady] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    (async () => {
      const parsed = await readData<AppData>();
      if (parsed) {
        setData(normalizeData(parsed));
      }
      setReady(true);
    })();
  }, []);

  const persist = useCallback((next: AppData) => {
    setData(next);
    writeData(next);
  }, []);

  const save = (next: AppData) => {
    writeData(next);
  };

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>) => {
    setData((prev) => {
      const next = { ...prev, transactions: [...prev.transactions, { ...t, id: genId('txn'), status: t.status || 'active' }] };
      save(next);
      return next;
    });
  }, []);

  const updateTransaction = useCallback((id: string, t: Partial<Transaction>) => {
    setData((prev) => {
      const next = { ...prev, transactions: prev.transactions.map((x) => (x.id === id ? { ...x, ...t } : x)) };
      save(next);
      return next;
    });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, transactions: prev.transactions.filter((x) => x.id !== id) };
      save(next);
      return next;
    });
  }, []);

  const addCategory = useCallback((c: Omit<Category, 'id'>) => {
    setData((prev) => {
      const next = { ...prev, categories: [...prev.categories, { ...c, id: genId('cat') }] };
      save(next);
      return next;
    });
  }, []);

  const updateCategory = useCallback((id: string, c: Partial<Category>) => {
    setData((prev) => {
      const next = { ...prev, categories: prev.categories.map((x) => (x.id === id ? { ...x, ...c } : x)) };
      save(next);
      return next;
    });
  }, []);

  const deleteCategory = useCallback((id: string): boolean => {
    const current = dataRef.current;
    const category = current.categories.find((x) => x.id === id);
    const hasFallback = current.categories.some((x) => x.id !== id && x.type === category?.type);
    if (!hasFallback && current.transactions.some((t) => t.categoryId === id)) return false;
    setData((prev) => {
      const fallback = prev.categories.find((x) => x.id !== id && x.type === category?.type);
      const next = {
        ...prev,
        categories: prev.categories.filter((x) => x.id !== id),
        transactions: fallback
          ? prev.transactions.map((transaction) => transaction.categoryId === id ? { ...transaction, categoryId: fallback.id } : transaction)
          : prev.transactions,
      };
      save(next);
      return next;
    });
    return true;
  }, []);

  const addAsset = useCallback((a: Omit<Asset, 'id'>): string => {
    const id = genId('ast');
    setData((prev) => {
      const next = { ...prev, assets: [...prev.assets, { ...a, id, date: a.date || todayISO() }] };
      save(next);
      return next;
    });
    return id;
  }, []);

  const updateAsset = useCallback((id: string, a: Partial<Asset>) => {
    setData((prev) => {
      const base = commitLiveCash(prev);
      const next = { ...base, assets: base.assets.map((x) => (x.id === id ? { ...x, ...a } : x)) };
      save(next);
      return next;
    });
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setData((prev) => {
      const base = commitLiveCash(prev);
      const next = {
        ...base,
        assets: base.assets.filter((x) => x.id !== id),
        contributions: base.contributions.filter((x) => x.holdingId !== id),
        goals: unlinkFromGoals(base.goals, id),
      };
      save(next);
      return next;
    });
  }, []);

  const addInvestment = useCallback((i: Omit<Investment, 'id'>) => {
    setData((prev) => {
      const next = { ...prev, investments: [...prev.investments, { ...i, id: genId('inv'), status: i.status || 'active', valueUpdatedDate: todayISO() }] };
      save(next);
      return next;
    });
  }, []);

  const addInvestmentWithContribution = useCallback((i: Omit<Investment, 'id'>, c: Omit<Contribution, 'id' | 'holdingId'>) => {
    setData((prev) => {
      const invId = genId('inv');
      const next = {
        ...prev,
        investments: [...prev.investments, { ...i, id: invId, status: i.status || 'active', valueUpdatedDate: todayISO() }],
        contributions: [...prev.contributions, { ...c, id: genId('cnb'), holdingId: invId, status: c.status || 'active' }],
      };
      save(next);
      return next;
    });
  }, []);

  const updateInvestment = useCallback((id: string, i: Partial<Investment>) => {
    setData((prev) => {
      const next = {
        ...prev,
        investments: prev.investments.map((x) => {
          if (x.id !== id) return x;
          const purchaseValue = i.purchaseValue ?? x.purchaseValue;
          const currentValue = i.currentValue ?? x.currentValue;
          if (purchaseValue <= 0 || currentValue <= 0) return x;
          // Entering a new value resets the baseline; contributions after it are added on top for display.
          const valueUpdatedDate = currentValue !== x.currentValue ? todayISO() : x.valueUpdatedDate;
          return { ...x, ...i, purchaseValue, currentValue, valueUpdatedDate };
        }),
      };
      save(next);
      return next;
    });
  }, []);

  const deleteInvestment = useCallback((id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        investments: prev.investments.filter((x) => x.id !== id),
        contributions: prev.contributions.filter((x) => x.holdingId !== id),
        goals: unlinkFromGoals(prev.goals, id),
      };
      save(next);
      return next;
    });
  }, []);

  const addDebt = useCallback((d: Omit<Debt, 'id'>): string => {
    const id = genId('dbt');
    setData((prev) => {
      const debt = { ...d, id, status: d.status || 'active', date: d.date || todayISO() };
      const next = {
        ...prev,
        debts: [...prev.debts, debt],
        contributions: debt.emi > 0
          ? [...prev.contributions, {
            holdingId: id,
            holdingKind: 'debt' as const,
            type: 'recurring' as const,
            amount: debt.emi,
            freq: 'monthly' as const,
            startDate: debt.date,
            status: debt.status,
            id: genId('cnb'),
          }]
          : prev.contributions,
      };
      save(next);
      return next;
    });
    return id;
  }, []);

  const updateDebt = useCallback((id: string, d: Partial<Debt>) => {
    setData((prev) => {
      const existing = prev.debts.find((debt) => debt.id === id);
      if (!existing) return prev;
      const debt = { ...existing, ...d };
      const linked = prev.contributions.filter((contribution) => contribution.holdingKind === 'debt' && contribution.holdingId === id && contribution.type === 'recurring');
      let contributions = prev.contributions;
      if (debt.emi > 0) {
        const contributionFields = {
          amount: debt.emi,
          startDate: debt.date,
        };
        if (linked.length > 0) {
          const linkedId = linked[0].id;
          const linkedIds = new Set(linked.map((contribution) => contribution.id));
          contributions = prev.contributions
            .filter((contribution) => !linkedIds.has(contribution.id) || contribution.id === linkedId)
            .map((contribution) => contribution.id === linkedId
              ? { ...contribution, ...contributionFields, status: debt.status }
              : contribution);
        } else {
          contributions = [...prev.contributions, {
            ...contributionFields,
            status: debt.status,
            holdingId: id,
            holdingKind: 'debt' as const,
            type: 'recurring' as const,
            freq: 'monthly' as const,
            id: genId('cnb'),
          }];
        }
      } else if (linked.length > 0) {
        const linkedIds = new Set(linked.map((contribution) => contribution.id));
        contributions = prev.contributions.filter((contribution) => !linkedIds.has(contribution.id));
      }
      const next = { ...prev, debts: prev.debts.map((x) => (x.id === id ? debt : x)), contributions };
      save(next);
      return next;
    });
  }, []);

  const deleteDebt = useCallback((id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        debts: prev.debts.filter((x) => x.id !== id),
        contributions: prev.contributions.filter((x) => x.holdingId !== id),
      };
      save(next);
      return next;
    });
  }, []);

  const addGoal = useCallback((g: Omit<Goal, 'id'>) => {
    setData((prev) => {
      const next = { ...prev, goals: [...prev.goals, { ...g, id: genId('goal') }] };
      save(next);
      return next;
    });
  }, []);

  const updateGoal = useCallback((id: string, g: Partial<Goal>) => {
    setData((prev) => {
      const next = { ...prev, goals: prev.goals.map((x) => (x.id === id ? { ...x, ...g } : x)) };
      save(next);
      return next;
    });
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, goals: prev.goals.filter((x) => x.id !== id) };
      save(next);
      return next;
    });
  }, []);

  const addContribution = useCallback((c: Omit<Contribution, 'id'>) => {
    setData((prev) => {
      const next = { ...prev, contributions: [...prev.contributions, { ...c, id: genId('cnb'), status: c.status || 'active' }] };
      save(next);
      return next;
    });
  }, []);

  const updateContribution = useCallback((id: string, c: Partial<Contribution>) => {
    setData((prev) => {
      const next = { ...prev, contributions: prev.contributions.map((x) => (x.id === id ? { ...x, ...c } : x)) };
      save(next);
      return next;
    });
  }, []);

  const deleteContribution = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, contributions: prev.contributions.filter((x) => x.id !== id) };
      save(next);
      return next;
    });
  }, []);

  const setStatus = useCallback(
    (kind: 'transactions' | 'investments' | 'debts', id: string, status: ItemStatus, date?: string) => {
      setData((prev) => {
        const iso = date || todayISO();
        const holdingKind = kind === 'investments' ? 'investment' : 'debt';
        const next = {
          ...prev,
          [kind]: (prev[kind] as Array<Lifecycle & { id: string }>).map((x) => (x.id === id ? applyStatus(x, status, iso) : x)),
          contributions: kind === 'transactions'
            ? prev.contributions
            : prev.contributions.map((x) => (x.holdingKind === holdingKind && x.holdingId === id ? applyStatus(x, status, iso) : x)),
        };
        save(next);
        return next;
      });
    },
    [],
  );

  const setTransactionStatus = useCallback((id: string, status: ItemStatus, date?: string) => setStatus('transactions', id, status, date), [setStatus]);
  const setInvestmentStatus = useCallback((id: string, status: ItemStatus, date?: string) => setStatus('investments', id, status, date), [setStatus]);
  const setDebtStatus = useCallback((id: string, status: ItemStatus, date?: string) => setStatus('debts', id, status, date), [setStatus]);

  const setContributionStatus = useCallback((id: string, status: ItemStatus, date?: string) => {
    setData((prev) => {
      const iso = date || todayISO();
      const next = { ...prev, contributions: prev.contributions.map((x) => (x.id === id ? applyStatus(x, status, iso) : x)) };
      save(next);
      return next;
    });
  }, []);

  const updateSettings = useCallback(async (s: Partial<Settings>) => {
    const patch = { ...s };
    if (s.pin !== undefined && s.pin !== null && s.pin !== '') {
      patch.pin = await hashPin(s.pin);
    }
    if (s.pin !== undefined) {
      patch.pinFailedAttempts = 0;
      patch.pinLockedUntil = null;
    }
    setData((prev) => {
      if (s.age !== undefined && !prev.settings.allocationTargets?.custom) {
        patch.allocationTargets = s.age === null ? null : bandForAge(s.age);
      }
      if (s.linkPaymentsToCash !== undefined && s.linkPaymentsToCash !== prev.settings.linkPaymentsToCash) {
        patch.cashLinkStart = s.linkPaymentsToCash ? todayISO() : null;
      }
      const next = { ...prev, settings: { ...prev.settings, ...patch } };
      save(next);
      return next;
    });
  }, []);

  const setAllocationTargets = useCallback((t: AllocationTarget) => {
    setData((prev) => {
      const next = { ...prev, settings: { ...prev.settings, allocationTargets: t } };
      save(next);
      return next;
    });
  }, []);

  const importData = useCallback((d: AppData) => {
    const imported = normalizeData(d);
    persist({ ...imported, settings: { ...imported.settings, pin: null, pinFailedAttempts: 0, pinLockedUntil: null, onboarded: true } });
  }, [persist]);

  const resetData = useCallback(() => {
    persist(normalizeData(DEFAULT_DATA));
  }, [persist]);

  const exportData = useCallback(() => {
    const { pin: _pin, ...safeSettings } = data.settings;
    return { ...data, settings: { ...safeSettings, pin: null, pinFailedAttempts: 0, pinLockedUntil: null } };
  }, [data]);

  const value: StoreContextValue = {
    data,
    ready,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    addAsset,
    updateAsset,
    deleteAsset,
    addInvestment,
    addInvestmentWithContribution,
    updateInvestment,
    deleteInvestment,
    addDebt,
    updateDebt,
    deleteDebt,
    addGoal,
    updateGoal,
    deleteGoal,
    addContribution,
    updateContribution,
    deleteContribution,
    setContributionStatus,
    setTransactionStatus,
    setInvestmentStatus,
    setDebtStatus,
    updateSettings,
    setAllocationTargets,
    importData,
    resetData,
    exportData,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
