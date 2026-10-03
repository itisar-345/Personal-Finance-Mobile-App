export type TxnType = 'income' | 'expense';

export type RecurringType = 'none' | 'monthly' | 'yearly';

/** Lifecycle status for any trackable item. */
export type ItemStatus = 'active' | 'paused' | 'closed';

/** A window during which a recurring item was paused/closed; no occurrences fall strictly inside it. */
export interface SkippedRange {
  from: string;
  to: string;
}

export interface Category {
  id: string;
  name: string;
  type: TxnType;
  /** expense classification */
  fixed?: boolean; // fixed vs variable
  need?: boolean; // need vs want
  /** income source kind */
  source?: 'salary' | 'freelance' | 'rental' | 'dividends' | 'other';
  custom?: boolean;
}

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number;
  categoryId: string;
  note?: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  recurring: RecurringType;
  recurringRef?: string; // original recurring txn id
  status: ItemStatus;
  /** ISO date when paused, if any */
  pausedDate?: string;
  /** ISO date when closed/cleared */
  closedDate?: string;
  /** Past pause/close windows that ended when the item was resumed or reopened. */
  skipped?: SkippedRange[];
}

export type AssetType = 'cash' | 'bank' | 'realestate' | 'gold' | 'other';

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  value: number;
  /** liquid (cash + bank) */
  liquid: boolean;
  /** ISO date string YYYY-MM-DD when the asset was acquired/recorded */
  date: string;
}

export type InvestmentType =
  | 'stocks'
  | 'mutualfund'
  | 'fd'
  | 'ppf'
  | 'crypto'
  | 'other';

export interface Investment {
  id: string;
  type: InvestmentType;
  name: string;
  purchaseValue: number;
  currentValue: number;
  /** ISO date string of purchase */
  purchaseDate: string;
  status: ItemStatus;
  /** Date `currentValue` was last entered; contributions made after it are added on top when displaying. */
  valueUpdatedDate?: string;
  pausedDate?: string;
  closedDate?: string;
  /** Past pause/close windows that ended when the item was resumed or reopened. */
  skipped?: SkippedRange[];
}

export type DebtType = 'loan' | 'creditcard' | 'emi';

export interface Debt {
  id: string;
  type: DebtType;
  name: string;
  outstanding: number;
  interestRate: number; // annual %
  emi: number; // monthly
  tenureMonths: number; // remaining
  /** ISO date string YYYY-MM-DD when the debt was taken */
  date: string;
  status: ItemStatus;
  pausedDate?: string;
  closedDate?: string;
  /** Past pause/close windows that ended when the item was resumed or reopened. */
  skipped?: SkippedRange[];
}

/** Contribution entry — one-time or recurring — linked to a holding. */
export type ContributionType = 'onetime' | 'recurring';
export type ContributionFreq = 'weekly' | 'monthly' | 'quarterly';

export interface Contribution {
  id: string;
  /** "investment" | "asset" | "debt" */
  holdingKind: 'investment' | 'asset' | 'debt';
  holdingId: string;
  type: ContributionType;
  amount: number;
  /** for recurring */
  freq?: ContributionFreq;
  /** ISO start date */
  startDate: string;
  status: ItemStatus;
  pausedDate?: string;
  closedDate?: string;
  /** Past pause/close windows that ended when the item was resumed or reopened. */
  skipped?: SkippedRange[];
  note?: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  /** ISO date string */
  targetDate: string;
  monthlyContribution: number;
  /** Asset/investment ids this goal tracks; when set, saved amount and monthly contribution are derived from them. */
  linkedIds?: string[];
  kind: 'retirement' | 'house' | 'emergency' | 'other';
}

/** One completed micro-saving quest. The amount was credited to `goalId` (a manual goal) when set. */
export interface QuestCompletion {
  id: string;
  /** Id of a built-in quest (see lib/quests.ts), or 'custom' for a free-form quick save. */
  questId: string;
  /** Local ISO date YYYY-MM-DD the quest was completed. */
  date: string;
  amount: number;
  /** XP earned, fixed at completion time (includes any streak bonus). */
  xp: number;
  goalId: string | null;
  note?: string;
}

export interface Currency {
  code: string;
  symbol: string;
  /** rate relative to base currency (1 base = rate this) */
  rate: number;
}

export interface AllocationTargetEntry {
  id: string;
  name: string;
  value: number;
}

export type AllocationKey =
  | 'stocks'
  | 'mutualfund'
  | 'fd'
  | 'ppf'
  | 'gold'
  | 'crypto'
  | 'other';

export interface AllocationTarget {
  stocks: number;
  mutualfund: number;
  fd: number;
  ppf: number;
  gold: number;
  crypto: number;
  other: number;
  custom: boolean;
  customTargets?: AllocationTargetEntry[];
}

export interface Settings {
  currencyCode: string;
  currencies: Currency[];
  theme: 'light' | 'dark' | 'system';
  /** The PIN hash itself lives in the OS keystore (see lib/pinStorage.ts), not here — this just gates the lock screen. */
  pinEnabled: boolean;
  /** Consecutive wrong PIN entries, and when the lockout after too many of them ends (epoch ms). */
  pinFailedAttempts: number;
  pinLockedUntil: number | null;
  age: number | null;
  allocationTargets: AllocationTarget | null;
  expectedReturn: number; // assumed annual return % for goal projections
  onboarded: boolean;
  reminderEnabled: boolean;
  backupFreq: 'none' | 'weekly' | 'monthly';
  lastBackupDate: string | null;
  /** Deduct EMI and SIP payments falling due from liquid assets (for users who don't log them as transactions). */
  linkPaymentsToCash: boolean;
  /** Payments after this date are deducted; set when linking is switched on. */
  cashLinkStart: string | null;
  /** Version of the Terms/Privacy Policy the user accepted (see LEGAL_VERSION), and the ISO date they did. */
  legalAcceptedVersion: string | null;
  legalAcceptedAt: string | null;
  /** Manual goal that completed micro-quests deposit into; null keeps them as a quest-only tally. */
  questGoalId: string | null;
}

export interface AppData {
  transactions: Transaction[];
  categories: Category[];
  assets: Asset[];
  investments: Investment[];
  debts: Debt[];
  goals: Goal[];
  contributions: Contribution[];
  questLog: QuestCompletion[];
  settings: Settings;
}
