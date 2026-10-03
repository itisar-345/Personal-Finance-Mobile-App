import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, SectionTitle, useUi, Chip, Button, Input, Field, EmptyState } from '@/components/ui';
import { ProgressBar } from '@/components/charts';
import { Sheet } from '@/components/Sheet';
import { useStore, isQuestGoal } from '@/lib/store';
import {
  BADGES,
  CUSTOM_QUEST_ID,
  DIFFICULTY_XP,
  activeQuests,
  completionFor,
  completionXp,
  levelInfo,
  levelTitle,
  questById,
  questStreak,
  totalXp,
  type QuestDef,
} from '@/lib/quests';
import { formatMoney, todayISO } from '@/lib/format';
import { Flame, Trophy, Check, Lock, Zap, PiggyBank } from 'lucide-react-native';

export default function QuestsScreen() {
  const { data, palette, currency } = useUi();
  const { undoQuestCompletion } = useStore();
  const [completing, setCompleting] = useState<QuestDef | 'custom' | null>(null);
  const today = todayISO();
  const log = data.questLog;

  const { daily, weekly } = useMemo(() => activeQuests(today), [today]);
  const streak = useMemo(() => questStreak(log, today), [log, today]);
  const xp = useMemo(() => totalXp(log), [log]);
  const level = levelInfo(xp);
  const savedTotal = useMemo(() => log.reduce((s, c) => s + c.amount, 0), [log]);
  const money = (n: number) => formatMoney(n, currency);
  const recent = useMemo(() => [...log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8), [log]);

  const renderQuest = (q: QuestDef) => {
    const completion = completionFor(q, log, today);
    return (
      <View key={q.id} style={[styles.questRow, { borderBottomColor: palette.border }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.questTitle, { color: completion ? palette.textMuted : palette.text }]}>{q.title}</Text>
          <Text style={{ fontSize: 12, color: palette.textMuted }}>{q.blurb}</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: palette.primary }}>
            {completion ? `Saved ${money(completion.amount)} · +${completion.xp} XP` : `Save ${money(q.amount)} · ${DIFFICULTY_XP[q.difficulty]} XP · ${q.difficulty}`}
          </Text>
        </View>
        {completion ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <View style={[styles.doneDot, { backgroundColor: palette.success }]}>
              <Check size={16} color={palette.primaryText} />
            </View>
            {completion.date === today && (
              <Pressable onPress={() => undoQuestCompletion(completion.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Undo ${q.title}`}>
                <Text style={{ fontSize: 11, color: palette.textMuted, fontWeight: '600' }}>Undo</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Button label="Done" onPress={() => setCompleting(q)} style={styles.doneBtn} />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Micro-Quests</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: palette.textMuted, fontWeight: '600' }}>Level {level.level}</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text }}>{levelTitle(level.level)}</Text>
            </View>
            <View style={[styles.streakPill, { backgroundColor: palette.warning + '22', borderColor: palette.warning }]}
              accessible accessibilityLabel={`${streak.current} day streak`}>
              <Flame size={16} color={palette.warning} />
              <Text style={{ fontWeight: '800', color: palette.warning }}>{streak.current}</Text>
            </View>
          </View>
          <View style={{ marginTop: 12, gap: 6 }}>
            <ProgressBar value={level.progress} color={palette.primary} height={10} />
            <Text style={{ fontSize: 11, color: palette.textMuted }}>
              {level.intoLevel} / {level.levelSpan} XP to level {level.level + 1}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <Stat label="Saved via quests" value={formatMoney(savedTotal, currency, { compact: true })} />
            <Stat label="Quests done" value={String(log.length)} />
            <Stat label="Best streak" value={`${streak.best} d`} />
          </View>
          {!streak.activeToday && streak.current > 0 && (
            <Text style={{ fontSize: 12, color: palette.warning, marginTop: 10, fontWeight: '600' }}>
              Complete a quest today to keep your {streak.current}-day streak.
            </Text>
          )}
        </Card>

        <DepositTarget />

        <Card>
          <SectionTitle title="Today's quests" />
          {daily.map(renderQuest)}
        </Card>

        <Card>
          <SectionTitle title="This week" />
          {weekly.map(renderQuest)}
        </Card>

        <Card>
          <SectionTitle title="Quick save" />
          <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 10 }}>
            Saved money some other way? Log it and still earn XP (up to 3 times a day).
          </Text>
          <Button label="Log a quick save" variant="outline" onPress={() => setCompleting('custom')} />
        </Card>

        <Card>
          <SectionTitle title="Badges" />
          <View style={styles.badgeGrid}>
            {BADGES.map((b) => {
              const earned = b.earned(log, today);
              const desc = b.describe((n) => formatMoney(n, currency, { compact: true }));
              return (
                <View key={b.id} style={[styles.badge, { backgroundColor: earned ? palette.primary + '1A' : palette.surfaceAlt, borderColor: earned ? palette.primary : palette.border }]}
                  accessible accessibilityLabel={`${b.title}: ${desc}${earned ? ', earned' : ', locked'}`}>
                  {earned ? <Trophy size={18} color={palette.primary} /> : <Lock size={18} color={palette.textMuted} />}
                  <Text style={{ fontSize: 12, fontWeight: '700', color: earned ? palette.text : palette.textMuted, textAlign: 'center' }}>{b.title}</Text>
                  <Text style={{ fontSize: 10, color: palette.textMuted, textAlign: 'center' }}>{desc}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        <Card>
          <SectionTitle title="Recent activity" />
          {recent.length === 0 ? (
            <EmptyState title="No quests yet" subtitle="Finish a quest above to start your streak." />
          ) : (
            recent.map((c) => {
              const goal = data.goals.find((g) => g.id === c.goalId);
              return (
                <View key={c.id} style={[styles.logRow, { borderBottomColor: palette.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>
                      {c.questId === CUSTOM_QUEST_ID ? (c.note || 'Quick save') : (questById(c.questId)?.title ?? 'Quest')}
                    </Text>
                    <Text style={{ fontSize: 11, color: palette.textMuted }}>{c.date}{goal ? ` · to ${goal.name}` : ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.success }}>+{money(c.amount)}</Text>
                    <Text style={{ fontSize: 11, color: palette.primary }}>+{c.xp} XP</Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>

      {completing && (
        <CompleteSheet
          key={completing === 'custom' ? 'custom' : completing.id}
          quest={completing === 'custom' ? null : completing}
          onClose={() => setCompleting(null)}
        />
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { palette } = useUi();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: palette.text }}>{value}</Text>
      <Text style={{ fontSize: 11, color: palette.textMuted }}>{label}</Text>
    </View>
  );
}

/** Choose which manual goal quest savings go into, or create a savings jar for them. */
function DepositTarget() {
  const { data, palette } = useUi();
  const { addGoal, updateSettings } = useStore();
  const manualGoals = data.goals.filter(isQuestGoal);
  const selected = data.settings.questGoalId;

  const createJar = () => {
    const due = new Date();
    due.setFullYear(due.getFullYear() + 1);
    const id = addGoal({
      name: 'Micro-Savings Jar',
      kind: 'other',
      targetAmount: 10_000,
      currentAmount: 0,
      targetDate: todayISO(due),
      monthlyContribution: 0,
    });
    updateSettings({ questGoalId: id });
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <PiggyBank size={18} color={palette.primary} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Savings go to</Text>
      </View>
      {manualGoals.length === 0 ? (
        <>
          <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 10 }}>
            Create a goal for quest savings so each completed quest moves it forward. Until then, savings are only counted here.
          </Text>
          <Button label="Create a Micro-Savings Jar" onPress={createJar} />
        </>
      ) : (
        <>
          <View style={styles.chipRow}>
            {manualGoals.map((g) => (
              <Chip key={g.id} label={g.name} selected={selected === g.id} onPress={() => updateSettings({ questGoalId: g.id })} />
            ))}
            <Chip label="Just count it" selected={!manualGoals.some((g) => g.id === selected)} onPress={() => updateSettings({ questGoalId: null })} />
          </View>
          {data.goals.length > manualGoals.length && (
            <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 8 }}>
              Goals linked to accounts aren&apos;t listed: their balance comes from those accounts, so update the account instead.
            </Text>
          )}
        </>
      )}
    </Card>
  );
}

function CompleteSheet({ quest, onClose }: { quest: QuestDef | null; onClose: () => void }) {
  const { data, palette, currency } = useUi();
  const { completeQuest } = useStore();
  const [amount, setAmount] = useState(quest ? String(quest.amount) : '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();
  const value = Number(amount);
  const questId = quest?.id ?? CUSTOM_QUEST_ID;
  const xp = Number.isFinite(value) && value > 0 ? completionXp(questId, value, data.questLog, today) : 0;
  const goal = data.goals.find((g) => g.id === data.settings.questGoalId);

  const submit = () => {
    if (!Number.isFinite(value) || value <= 0) { setError('Enter the amount you set aside.'); return; }
    completeQuest(questId, value, quest ? undefined : note);
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={quest ? quest.title : 'Quick save'}>
      {quest && <Text style={{ fontSize: 13, color: palette.textMuted, marginBottom: 12 }}>{quest.blurb}</Text>}
      <Field label="Amount set aside" money>
        <Input value={amount} onChangeText={(t) => { setAmount(t); setError(null); }} keyboardType="decimal-pad" placeholder="0" />
      </Field>
      {!quest && (
        <Field label="What did you do? (optional)">
          <Input value={note} onChangeText={setNote} placeholder="e.g. Skipped a taxi" maxLength={60} />
        </Field>
      )}
      <View style={[styles.rewardRow, { backgroundColor: palette.surfaceAlt }]}>
        <Zap size={16} color={palette.primary} />
        <Text style={{ flex: 1, fontSize: 13, color: palette.text }}>
          {xp > 0 ? `+${xp} XP` : 'No XP (daily quick-save limit reached)'}
          {isQuestGoal(goal) && Number.isFinite(value) && value > 0 ? ` · ${formatMoney(value, currency)} to ${goal.name}` : ''}
        </Text>
      </View>
      {error && <Text style={{ color: palette.danger, fontSize: 12, marginBottom: 8 }}>{error}</Text>}
      <Button label="Complete quest" onPress={submit} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  screenTitle: { fontSize: 24, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  questTitle: { fontSize: 15, fontWeight: '700' },
  doneBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  doneDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 4, padding: 10, borderRadius: 12, borderWidth: 1 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 12 },
});
