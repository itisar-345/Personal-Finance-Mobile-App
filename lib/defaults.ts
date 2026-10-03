import type {
  AppData,
  Category,
  Settings,
  Currency,
} from './types';

export const DEFAULT_CURRENCIES: Currency[] = [
  { code: 'INR', symbol: '₹', rate: 1 },
  { code: 'USD', symbol: '$', rate: 0.0104 }, // ≈ ₹96.1 per $ (Sep 2026)
  { code: 'EUR', symbol: '€', rate: 0.00905 }, // ≈ ₹110.4 per €
  { code: 'GBP', symbol: '£', rate: 0.00776 }, // ≈ ₹128.8 per £
];

export const DEFAULT_CATEGORIES: Category[] = [
  // income
  { id: 'inc_salary', name: 'Salary', type: 'income', source: 'salary' },
  { id: 'inc_freelance', name: 'Freelance', type: 'income', source: 'freelance' },
  { id: 'inc_rental', name: 'Rental', type: 'income', source: 'rental' },
  { id: 'inc_dividends', name: 'Dividends', type: 'income', source: 'dividends' },
  { id: 'inc_other', name: 'Other Income', type: 'income', source: 'other' },
  // expense - fixed needs
  { id: 'exp_rent', name: 'Rent', type: 'expense', fixed: true, need: true },
  { id: 'exp_utilities', name: 'Utilities', type: 'expense', fixed: true, need: true },
  { id: 'exp_insurance', name: 'Insurance', type: 'expense', fixed: true, need: true },
  { id: 'exp_emi', name: 'Loan EMI', type: 'expense', fixed: true, need: true },
  // expense - variable needs
  { id: 'exp_groceries', name: 'Groceries', type: 'expense', fixed: false, need: true },
  { id: 'exp_transport', name: 'Transport', type: 'expense', fixed: false, need: true },
  { id: 'exp_health', name: 'Healthcare', type: 'expense', fixed: false, need: true },
  // expense - wants
  { id: 'exp_dining', name: 'Dining Out', type: 'expense', fixed: false, need: false },
  { id: 'exp_entertainment', name: 'Entertainment', type: 'expense', fixed: false, need: false },
  { id: 'exp_shopping', name: 'Shopping', type: 'expense', fixed: false, need: false },
  { id: 'exp_subscriptions', name: 'Subscriptions', type: 'expense', fixed: true, need: false },
  { id: 'exp_other', name: 'Other Expense', type: 'expense', fixed: false, need: false },
];

export const DEFAULT_SETTINGS: Settings = {
  currencyCode: 'INR',
  currencies: DEFAULT_CURRENCIES,
  theme: 'system',
  pinEnabled: false,
  pinFailedAttempts: 0,
  pinLockedUntil: null,
  age: null,
  allocationTargets: null,
  expectedReturn: 10,
  onboarded: false,
  reminderEnabled: false,
  backupFreq: 'none',
  lastBackupDate: null,
  linkPaymentsToCash: false,
  cashLinkStart: null,
  legalAcceptedVersion: null,
  legalAcceptedAt: null,
  questGoalId: null,
};

export const DEFAULT_DATA: AppData = {
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  assets: [],
  investments: [],
  debts: [],
  goals: [],
  contributions: [],
  questLog: [],
  settings: DEFAULT_SETTINGS,
};

export function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}