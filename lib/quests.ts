import type { QuestCompletion } from './types';

export type QuestCadence = 'daily' | 'weekly';
export type QuestDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestDef {
  id: string;
  title: string;
  blurb: string;
  cadence: QuestCadence;
  difficulty: QuestDifficulty;
  /** Suggested amount to set aside, in base currency; the user can change it when completing. */
  amount: number;
}

export const CUSTOM_QUEST_ID = 'custom';

export const DIFFICULTY_XP: Record<QuestDifficulty, number> = { easy: 10, medium: 20, hard: 40 };

export const QUESTS: QuestDef[] = [
  // daily
  { id: 'd_coffee', title: 'Brew at home', blurb: 'Skip the café coffee today and stash what it would have cost.', cadence: 'daily', difficulty: 'easy', amount: 150 },
  { id: 'd_lunch', title: 'Packed lunch', blurb: 'Carry lunch from home instead of buying it.', cadence: 'daily', difficulty: 'medium', amount: 200 },
  { id: 'd_delivery', title: 'No delivery apps', blurb: 'Cook or eat at home — no food-delivery orders today.', cadence: 'daily', difficulty: 'medium', amount: 250 },
  { id: 'd_walk', title: 'Walk it', blurb: 'Walk, cycle or take transit for one short trip you would have cabbed.', cadence: 'daily', difficulty: 'easy', amount: 80 },
  { id: 'd_roundup', title: 'Round-up', blurb: 'Round today\'s spends up to the next hundred and save the difference.', cadence: 'daily', difficulty: 'easy', amount: 50 },
  { id: 'd_nospend', title: 'No-spend day', blurb: 'Spend nothing beyond bills and essentials today.', cadence: 'daily', difficulty: 'hard', amount: 300 },
  { id: 'd_water', title: 'Water wins', blurb: 'Swap a soft drink or juice for water.', cadence: 'daily', difficulty: 'easy', amount: 40 },
  { id: 'd_twenty', title: 'Tiny stash', blurb: 'Put a small amount aside, no reason needed. Small counts.', cadence: 'daily', difficulty: 'easy', amount: 20 },
  { id: 'd_cart', title: 'Cart cooldown', blurb: 'Leave an impulse buy in the cart for 24 hours instead of checking out.', cadence: 'daily', difficulty: 'medium', amount: 200 },
  // weekly
  { id: 'w_subscription', title: 'Subscription sweep', blurb: 'Cancel or pause one subscription you barely use.', cadence: 'weekly', difficulty: 'hard', amount: 199 },
  { id: 'w_sell', title: 'Declutter & sell', blurb: 'List or sell one thing you no longer need.', cadence: 'weekly', difficulty: 'hard', amount: 500 },
  { id: 'w_movie', title: 'Home screening', blurb: 'Swap a theatre outing for a movie night at home.', cadence: 'weekly', difficulty: 'medium', amount: 400 },
  { id: 'w_compare', title: 'Price detective', blurb: 'Compare three prices before one planned purchase.', cadence: 'weekly', difficulty: 'medium', amount: 300 },
  { id: 'w_snacks', title: 'Snack prep', blurb: 'Pack snacks for the week instead of buying them on the go.', cadence: 'weekly', difficulty: 'medium', amount: 250 },
  { id: 'w_mealplan', title: 'Meal plan', blurb: 'Plan the week\'s meals and shop from a list.', cadence: 'weekly', difficulty: 'medium', amount: 350 },
];

const DAILY_SLOTS = 3;
const WEEKLY_SLOTS = 2;
/** Quick saves beyond this many per day still count toward savings but earn no XP, so XP can't be farmed. */
export const CUSTOM_XP_PER_DAY = 3;

export function questById(id: string): QuestDef | undefined {
  return QUESTS.find((q) => q.id === id);
}

/** Days since the epoch for a YYYY-MM-DD date (timezone-free). */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function isoFromDayNumber(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

/** The Monday that starts the week containing `iso`, as YYYY-MM-DD. */
export function weekStart(iso: string): string {
  const n = dayNumber(iso);
  // 1970-01-01 was a Thursday: (n + 3) % 7 gives 0 for Monday.
  return isoFromDayNumber(n - ((n + 3) % 7));
}

/** Small deterministic PRNG so every device shows the same quests for the same day. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(pool: T[], count: number, seed: number): T[] {
  const rand = seeded(seed);
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

/** Today's rotating daily quests and this week's weekly quests. */
export function activeQuests(today: string): { daily: QuestDef[]; weekly: QuestDef[] } {
  return {
    daily: pick(QUESTS.filter((q) => q.cadence === 'daily'), DAILY_SLOTS, dayNumber(today)),
    weekly: pick(QUESTS.filter((q) => q.cadence === 'weekly'), WEEKLY_SLOTS, dayNumber(weekStart(today)) * 31 + 7),
  };
}

/** The completion of `quest` in the current day/week period, if any. */
export function completionFor(quest: QuestDef, log: QuestCompletion[], today: string): QuestCompletion | undefined {
  const week = weekStart(today);
  return log.find((c) => c.questId === quest.id && (quest.cadence === 'daily' ? c.date === today : weekStart(c.date) === week));
}

export interface StreakInfo {
  /** Consecutive days with a completion, ending today (or yesterday, so it isn't lost before today's quest). */
  current: number;
  best: number;
  activeToday: boolean;
}

export function questStreak(log: QuestCompletion[], today: string): StreakInfo {
  const days = [...new Set(log.map((c) => dayNumber(c.date)))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const set = new Set(days);
  const t = dayNumber(today);
  const activeToday = set.has(t);
  let current = 0;
  for (let d = activeToday ? t : t - 1; set.has(d); d--) current++;
  return { current, best, activeToday };
}

/** Streak bonus: +10% XP per streak day already built, capped at +100%. */
export function streakMultiplier(streakDays: number): number {
  return 1 + Math.min(streakDays, 10) * 0.1;
}

/** XP a new completion earns, given the log as it stands before it. */
export function completionXp(questId: string, amount: number, log: QuestCompletion[], today: string): number {
  let base: number;
  if (questId === CUSTOM_QUEST_ID) {
    const customToday = log.filter((c) => c.questId === CUSTOM_QUEST_ID && c.date === today).length;
    if (customToday >= CUSTOM_XP_PER_DAY) return 0;
    base = Math.max(5, Math.min(25, Math.round(amount / 20)));
  } else {
    const quest = questById(questId);
    base = quest ? DIFFICULTY_XP[quest.difficulty] : 0;
  }
  const { current, activeToday } = questStreak(log, today);
  // Today's first completion extends yesterday's streak, so it's rewarded at that streak's length.
  return Math.round(base * streakMultiplier(activeToday ? current - 1 : current));
}

export function totalXp(log: QuestCompletion[]): number {
  return log.reduce((s, c) => s + c.xp, 0);
}

/** Cumulative XP needed to reach `level`: 0, 100, 300, 600, 1000, … */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelInfo(xp: number): { level: number; intoLevel: number; levelSpan: number; progress: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const intoLevel = xp - xpForLevel(level);
  const levelSpan = xpForLevel(level + 1) - xpForLevel(level);
  return { level, intoLevel, levelSpan, progress: intoLevel / levelSpan };
}

const LEVEL_TITLES = ['Penny Rookie', 'Coin Collector', 'Thrift Scout', 'Budget Ranger', 'Savings Knight', 'Vault Keeper', 'Frugal Sage', 'Money Monk'];

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1];
}

export interface Badge {
  id: string;
  title: string;
  /** `money` formats a base-currency amount for display. */
  describe: (money: (amount: number) => string) => string;
  earned: (log: QuestCompletion[], today: string) => boolean;
}

const saved = (log: QuestCompletion[]) => log.reduce((s, c) => s + c.amount, 0);

/** Whether every weekly quest offered in some past or current week was completed that week. */
function sweptAWeek(log: QuestCompletion[]): boolean {
  const weeks = new Set(log.filter((c) => questById(c.questId)?.cadence === 'weekly').map((c) => weekStart(c.date)));
  for (const week of weeks) {
    if (activeQuests(week).weekly.every((q) => completionFor(q, log, week))) return true;
  }
  return false;
}

export const BADGES: Badge[] = [
  { id: 'first', title: 'First Coin', describe: () => 'Complete your first quest', earned: (log) => log.length > 0 },
  { id: 'streak3', title: 'Warming Up', describe: () => 'Reach a 3-day streak', earned: (log, t) => questStreak(log, t).best >= 3 },
  { id: 'streak7', title: 'On Fire', describe: () => 'Reach a 7-day streak', earned: (log, t) => questStreak(log, t).best >= 7 },
  { id: 'streak30', title: 'Unstoppable', describe: () => 'Reach a 30-day streak', earned: (log, t) => questStreak(log, t).best >= 30 },
  { id: 'saved1k', title: 'Piggy Bank', describe: (m) => `Save ${m(1_000)} through quests`, earned: (log) => saved(log) >= 1_000 },
  { id: 'saved10k', title: 'Treasure Chest', describe: (m) => `Save ${m(10_000)} through quests`, earned: (log) => saved(log) >= 10_000 },
  { id: 'quests25', title: 'Quest Regular', describe: () => 'Complete 25 quests', earned: (log) => log.length >= 25 },
  { id: 'quests100', title: 'Centurion', describe: () => 'Complete 100 quests', earned: (log) => log.length >= 100 },
  { id: 'sweep', title: 'Clean Sweep', describe: () => 'Finish every weekly quest in a week', earned: (log) => sweptAWeek(log) },
  { id: 'level5', title: 'Savings Knight', describe: () => 'Reach level 5', earned: (log) => levelInfo(totalXp(log)).level >= 5 },
];
