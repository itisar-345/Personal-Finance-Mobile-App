import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  ItemStatus,
} from './types';
import { DEFAULT_DATA, genId } from './defaults';
import { bandForAge } from './calc';
import { hashPin } from './crypto';

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
  deleteCategory: (id: string) => void;
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeData(input?: Partial<AppData> | null): AppData {
  const settings: Partial<Settings> = input?.settings ?? {};
  const date = todayISO();

  return {
    transactions: Array.isArray(input?.transactions)
      ? input.transactions.map((transaction) => ({
        ...transaction,
        recurring: transaction.recurring || 'none',
        status: transaction.status || 'active',
      }))
      : [],
    categories: Array.isArray(input?.categories) ? input.categories : DEFAULT_DATA.categories,
    assets: Array.isArray(input?.assets)
      ? input.assets.map((asset) => ({
        ...asset,
        date: asset.date || date,
        liquid: asset.liquid ?? (asset.type === 'cash' || asset.type === 'bank'),
      }))
      : [],
    investments: Array.isArray(input?.investments)
      ? input.investments.map((investment) => ({ ...investment, status: investment.status || 'active' }))
      : [],
    debts: Array.isArray(input?.debts)
      ? input.debts.map((debt) => ({ ...debt, status: debt.status || 'active', date: debt.date || date }))
      : [],
    goals: Array.isArray(input?.goals)
      ? input.goals.map((goal) => ({ ...goal, monthlyContribution: goal.monthlyContribution ?? 0 }))
      : [],
    contributions: Array.isArray(input?.contributions)
      ? input.contributions.map((contribution) => ({
        ...contribution,
        status: contribution.status || 'active',
        startDate: contribution.startDate || date,
      }))
      : [],
    settings: {
      ...DEFAULT_DATA.settings,
      ...settings,
      currencies: Array.isArray(settings.currencies) ? settings.currencies : DEFAULT_DATA.settings.currencies,
    },
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [ready, setReady] = useState(false);

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

  const deleteCategory = useCallback((id: string) => {
    setData((prev) => {
      const category = prev.categories.find((x) => x.id === id);
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
  }, []);

  const addAsset = useCallback((a: Omit<Asset, 'id'>): string => {
    const id = genId('ast');
    setData((prev) => {
      const next = { ...prev, assets: [...prev.assets, { ...a, id, date: a.date || new Date().toISOString().slice(0, 10) }] };
      save(next);
      return next;
    });
    return id;
  }, []);

  const updateAsset = useCallback((id: string, a: Partial<Asset>) => {
    setData((prev) => {
      const next = { ...prev, assets: prev.assets.map((x) => (x.id === id ? { ...x, ...a } : x)) };
      save(next);
      return next;
    });
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        assets: prev.assets.filter((x) => x.id !== id),
        contributions: prev.contributions.filter((x) => x.holdingId !== id),
      };
      save(next);
      return next;
    });
  }, []);

  const addInvestment = useCallback((i: Omit<Investment, 'id'>) => {
    setData((prev) => {
      const next = { ...prev, investments: [...prev.investments, { ...i, id: genId('inv'), status: i.status || 'active' }] };
      save(next);
      return next;
    });
  }, []);

  const addInvestmentWithContribution = useCallback((i: Omit<Investment, 'id'>, c: Omit<Contribution, 'id' | 'holdingId'>) => {
    setData((prev) => {
      const invId = genId('inv');
      const next = {
        ...prev,
        investments: [...prev.investments, { ...i, id: invId, status: i.status || 'active' }],
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
          return { ...x, ...i, purchaseValue, currentValue };
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
      };
      save(next);
      return next;
    });
  }, []);

  const addDebt = useCallback((d: Omit<Debt, 'id'>): string => {
    const id = genId('dbt');
    setData((prev) => {
      const debt = { ...d, id, status: d.status || 'active', date: d.date || new Date().toISOString().slice(0, 10) };
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
    (kind: 'transactions' | 'assets' | 'investments' | 'debts', id: string, status: ItemStatus, date?: string) => {
      setData((prev) => {
        const iso = date || new Date().toISOString().slice(0, 10);
        const patch: Record<string, unknown> = { status };
        if (status === 'paused') { patch.pausedDate = iso; patch.closedDate = undefined; }
        if (status === 'closed') { patch.closedDate = iso; patch.pausedDate = undefined; }
        if (status === 'active') { patch.pausedDate = undefined; patch.closedDate = undefined; }
        const next = {
          ...prev,
          [kind]: (prev[kind] as any[]).map((x) => (x.id === id ? { ...x, ...patch } : x)),
          contributions: kind === 'investments' || kind === 'debts'
            ? prev.contributions.map((x) => (
              x.holdingKind === (kind === 'investments' ? 'investment' : 'debt') && x.holdingId === id
                ? { ...x, ...patch }
                : x
            ))
            : prev.contributions,
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
      const iso = date || new Date().toISOString().slice(0, 10);
      const patch: Record<string, unknown> = { status };
      if (status === 'paused') { patch.pausedDate = iso; patch.closedDate = undefined; }
      if (status === 'closed') { patch.closedDate = iso; patch.pausedDate = undefined; }
      if (status === 'active') { patch.pausedDate = undefined; patch.closedDate = undefined; }
      const next = { ...prev, contributions: prev.contributions.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
      save(next);
      return next;
    });
  }, []);

  const updateSettings = useCallback(async (s: Partial<Settings>) => {
    const patch = { ...s };
    if (s.pin !== undefined && s.pin !== null && s.pin !== '') {
      patch.pin = await hashPin(s.pin);
    }
    setData((prev) => {
      if (s.age !== undefined && s.age !== null && !prev.settings.allocationTargets?.custom) {
        patch.allocationTargets = bandForAge(s.age);
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
    persist({ ...imported, settings: { ...imported.settings, pin: null } });
  }, [persist]);

  const resetData = useCallback(() => {
    persist(normalizeData(DEFAULT_DATA));
  }, [persist]);

  const exportData = useCallback(() => {
    const { pin: _pin, ...safeSettings } = data.settings;
    return { ...data, settings: { ...safeSettings, pin: null } };
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
