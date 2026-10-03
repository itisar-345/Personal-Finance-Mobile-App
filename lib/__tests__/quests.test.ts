import { describe, expect, it } from 'vitest';
import type { QuestCompletion } from '../types';
import {
  BADGES,
  CUSTOM_QUEST_ID,
  CUSTOM_XP_PER_DAY,
  activeQuests,
  completionFor,
  completionXp,
  levelInfo,
  questById,
  questStreak,
  weekStart,
  xpForLevel,
} from '../quests';

function done(questId: string, date: string, overrides: Partial<QuestCompletion> = {}): QuestCompletion {
  return { id: `${questId}_${date}_${Math.random()}`, questId, date, amount: 100, xp: 10, goalId: null, ...overrides };
}

describe('weekStart', () => {
  it('returns the Monday of the week', () => {
    expect(weekStart('2026-09-28')).toBe('2026-09-28'); // Monday
    expect(weekStart('2026-09-29')).toBe('2026-09-28');
    expect(weekStart('2026-10-04')).toBe('2026-09-28'); // Sunday
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
  });
});

describe('activeQuests', () => {
  it('is deterministic for a day and offers distinct quests of the right cadence', () => {
    const a = activeQuests('2026-09-29');
    expect(activeQuests('2026-09-29')).toEqual(a);
    expect(a.daily).toHaveLength(3);
    expect(a.weekly).toHaveLength(2);
    expect(new Set(a.daily.map((q) => q.id)).size).toBe(3);
    expect(a.daily.every((q) => q.cadence === 'daily')).toBe(true);
    expect(a.weekly.every((q) => q.cadence === 'weekly')).toBe(true);
  });

  it('keeps the same weekly quests all week', () => {
    expect(activeQuests('2026-10-04').weekly).toEqual(activeQuests('2026-09-28').weekly);
  });
});

describe('completionFor', () => {
  it('scopes daily quests to the day and weekly quests to the week', () => {
    const daily = questById('d_coffee')!;
    const weekly = questById('w_sell')!;
    const log = [done('d_coffee', '2026-09-28'), done('w_sell', '2026-09-28')];
    expect(completionFor(daily, log, '2026-09-28')).toBeDefined();
    expect(completionFor(daily, log, '2026-09-29')).toBeUndefined();
    expect(completionFor(weekly, log, '2026-10-04')).toBeDefined();
    expect(completionFor(weekly, log, '2026-10-05')).toBeUndefined();
  });
});

describe('questStreak', () => {
  it('counts consecutive days ending today', () => {
    const log = [done('a', '2026-09-27'), done('b', '2026-09-28'), done('c', '2026-09-29'), done('d', '2026-09-29')];
    expect(questStreak(log, '2026-09-29')).toEqual({ current: 3, best: 3, activeToday: true });
  });

  it('keeps yesterday\'s streak alive until today is over', () => {
    const log = [done('a', '2026-09-27'), done('b', '2026-09-28')];
    expect(questStreak(log, '2026-09-29')).toEqual({ current: 2, best: 2, activeToday: false });
  });

  it('resets after a missed day but remembers the best run', () => {
    const log = [done('a', '2026-09-20'), done('b', '2026-09-21'), done('c', '2026-09-22'), done('d', '2026-09-27')];
    expect(questStreak(log, '2026-09-29')).toEqual({ current: 0, best: 3, activeToday: false });
  });

  it('handles an empty log', () => {
    expect(questStreak([], '2026-09-29')).toEqual({ current: 0, best: 0, activeToday: false });
  });
});

describe('completionXp', () => {
  it('awards difficulty XP with no streak', () => {
    expect(completionXp('d_coffee', 150, [], '2026-09-29')).toBe(10);
    expect(completionXp('w_sell', 500, [], '2026-09-29')).toBe(40);
  });

  it('adds a streak bonus for the days already built', () => {
    const log = [done('a', '2026-09-27'), done('b', '2026-09-28')];
    // Two prior days → +20%.
    expect(completionXp('d_lunch', 200, log, '2026-09-29')).toBe(24);
    // A second completion today uses the same streak length, not one more.
    expect(completionXp('d_lunch', 200, [...log, done('c', '2026-09-29')], '2026-09-29')).toBe(24);
  });

  it('scales custom saves by amount and stops awarding XP past the daily cap', () => {
    expect(completionXp(CUSTOM_QUEST_ID, 20, [], '2026-09-29')).toBe(5);
    expect(completionXp(CUSTOM_QUEST_ID, 10_000, [], '2026-09-29')).toBe(25);
    const capped = Array.from({ length: CUSTOM_XP_PER_DAY }, () => done(CUSTOM_QUEST_ID, '2026-09-29'));
    expect(completionXp(CUSTOM_QUEST_ID, 500, capped, '2026-09-29')).toBe(0);
  });
});

describe('levelInfo', () => {
  it('uses triangular thresholds', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([0, 100, 300, 600]);
    expect(levelInfo(0)).toMatchObject({ level: 1, intoLevel: 0, levelSpan: 100 });
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100)).toMatchObject({ level: 2, intoLevel: 0, levelSpan: 200 });
    expect(levelInfo(450)).toMatchObject({ level: 3, intoLevel: 150, progress: 0.5 });
  });
});

describe('badges', () => {
  const earned = (log: QuestCompletion[], today = '2026-09-29') => BADGES.filter((b) => b.earned(log, today)).map((b) => b.id);

  it('earns nothing on an empty log', () => {
    expect(earned([])).toEqual([]);
  });

  it('earns first-quest and savings badges', () => {
    expect(earned([done('d_coffee', '2026-09-29', { amount: 1_000 })])).toEqual(['first', 'saved1k']);
  });

  it('earns the clean sweep only when every weekly quest of that week is done', () => {
    const [w1, w2] = activeQuests('2026-09-29').weekly;
    expect(earned([done(w1.id, '2026-09-29')])).not.toContain('sweep');
    expect(earned([done(w1.id, '2026-09-28'), done(w2.id, '2026-10-02')])).toContain('sweep');
  });
});
