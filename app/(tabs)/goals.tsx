import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, SectionTitle, useUi, Chip, Button, Input, Field, EmptyState } from '@/components/ui';
import { LineChart, ProgressBar } from '@/components/charts';
import { Sheet } from '@/components/Sheet';
import { ConfirmDeleteSheet } from '@/components/ConfirmDeleteSheet';
import { useStore } from '@/lib/store';
import {
  goalProgress,
  monthsUntil,
  requiredMonthlyForGoal,
  projectNetWorth,
  netWorth,
  debtStrategies,
  debtPayoffMonths,
  debtStrategyPlan,
  avgMonthlyExpenses,
  recurringTransactionsThrough,
  withLiveData,
  goalCurrentAmount,
  goalMonthlyContribution,
} from '@/lib/calc';
import { formatMoney, formatPercent, formatMonths, isValidIsoDate, todayISO } from '@/lib/format';
import { Trash2, Pencil } from 'lucide-react-native';
import type { Goal } from '@/lib/types';

type Tab = 'goals' | 'simulator' | 'emergency' | 'debt';

export default function GoalsScreen() {
  const { palette } = useUi();
  const [tab, setTab] = useState<Tab>('goals');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Goals & Planning</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.tabRow}>
          {(['goals', 'simulator', 'emergency', 'debt'] as Tab[]).map((t) => (
            <Chip key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} selected={tab === t} onPress={() => setTab(t)} />
          ))}
        </View>
        {tab === 'goals' && <GoalsTab />}
        {tab === 'simulator' && <SimulatorTab />}
        {tab === 'emergency' && <EmergencyTab />}
        {tab === 'debt' && <DebtPlannerTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

function GoalsTab() {
  const { data, palette, currency } = useUi();
  const { addGoal, updateGoal, deleteGoal } = useStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);
  const liveData = useMemo(() => withLiveData(data, todayISO()), [data]);

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <SectionTitle title="Your Goals" action={
          <Pressable onPress={() => setSheetOpen(true)}>
            <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>+ Add</Text>
          </Pressable>
        } />
        {data.goals.length === 0 ? (
          <EmptyState title="No goals yet" subtitle="Set goals like retirement, a house, or an emergency fund to track your progress." />
        ) : (
          data.goals.map((g) => {
            // Linked goals track their holdings' live values and SIPs; unlinked goals use the entered figures.
            const saved = goalCurrentAmount(g, liveData);
            const monthlyPlan = goalMonthlyContribution(g, data.contributions);
            const progress = goalProgress(saved, g.targetAmount);
            const months = monthsUntil(g.targetDate);
            const reached = progress >= 1;
            const isOverdue = !reached && g.targetDate < todayISO();
            // A goal due later this month still needs at least one month of funding.
            const required = (!reached && !isOverdue)
              ? requiredMonthlyForGoal(g.targetAmount, saved, Math.max(1, months), data.settings.expectedReturn || 10)
              : null;
            const monthlyGap = required === null ? 0 : Math.max(0, required - monthlyPlan);
            return (
              <View key={g.id} style={[styles.goalCard, { borderBottomColor: palette.border }]}>
                <View style={styles.goalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{g.name}</Text>
                    <Text style={{ fontSize: 11, color: palette.textMuted }}>{g.kind} · {months} mo left{g.linkedIds?.length ? ` · linked to ${g.linkedIds.length} holding${g.linkedIds.length === 1 ? '' : 's'}` : ''}</Text>
                  </View>
                  <Pressable onPress={() => setEditingGoal(g)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit">
                    <Pencil size={16} color={palette.primary} />
                  </Pressable>
                  <Pressable onPress={() => setPendingDelete(g)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete">
                    <Trash2 size={16} color={palette.danger} />
                  </Pressable>
                </View>
                <ProgressBar value={progress} color={palette.primary} />
                <View style={styles.goalFoot}>
                  <Text style={{ fontSize: 12, color: palette.textMuted }}>
                    {formatMoney(saved, currency, { compact: true })} / {formatMoney(g.targetAmount, currency, { compact: true })}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: palette.primary }}>{formatPercent(progress)}</Text>
                </View>
                <Text style={{ fontSize: 11, color: isOverdue ? palette.danger : palette.textMuted, marginTop: 4 }}>
                  {reached
                    ? 'Goal reached!'
                  : isOverdue
                    ? 'Overdue — target date has passed'
                  : required !== null
                    ? monthlyGap > 0
                      ? `Plan: ${formatMoney(monthlyPlan, currency, { compact: true })}/mo · add ${formatMoney(monthlyGap, currency, { compact: true })}/mo`
                      : `On track with ${formatMoney(monthlyPlan, currency, { compact: true })}/mo`
                    : 'Goal reached!'}
                </Text>
              </View>
            );
          })
        )}
      </Card>

      <GoalSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={addGoal} />
      {editingGoal && (
        <GoalSheet
          key={editingGoal.id}
          visible={!!editingGoal}
          onClose={() => setEditingGoal(null)}
          initial={editingGoal}
          onSave={(fields) => { updateGoal(editingGoal.id, fields); setEditingGoal(null); }}
        />
      )}
      {pendingDelete && (
        <ConfirmDeleteSheet
          name={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { deleteGoal(pendingDelete.id); setPendingDelete(null); }}
        />
      )}
    </View>
  );
}

function GoalSheet({
  visible, onClose, onAdd, onSave, initial,
}: {
  visible: boolean; onClose: () => void;
  onAdd?: (g: Omit<Goal, 'id'>) => void;
  onSave?: (g: Partial<Goal>) => void;
  initial?: Goal;
}) {
  const { palette, data } = useUi();
  const [name, setName] = useState(initial?.name ?? '');
  const [linkedIds, setLinkedIds] = useState<string[]>(initial?.linkedIds ?? []);
  const linked = linkedIds.length > 0;
  const holdings = [
    ...data.assets.map((a) => ({ id: a.id, name: a.name })),
    ...data.investments.filter((i) => i.status !== 'closed').map((i) => ({ id: i.id, name: i.name })),
  ];
  const toggleLink = (id: string) => setLinkedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const [kind, setKind] = useState<Goal['kind']>(initial?.kind ?? 'retirement');
  const [targetAmount, setTargetAmount] = useState(initial ? String(initial.targetAmount) : '');
  const [currentAmount, setCurrentAmount] = useState(initial ? String(initial.currentAmount) : '');
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [monthlyContribution, setMonthlyContribution] = useState(initial ? String(initial.monthlyContribution) : '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const ta = Number(targetAmount);
    const ca = Number(currentAmount) || 0;
    if (!name.trim() || ta <= 0 || ca < 0) { setError('Enter a goal name, a target greater than zero, and a valid saved amount.'); return; }
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() + 5);
    const date = targetDate || todayISO(defaultDate);
    const monthly = Number(monthlyContribution) || 0;
    if (!isValidIsoDate(date)) { setError('Use a valid target date in YYYY-MM-DD format.'); return; }
    if (monthly < 0) { setError('Monthly contribution cannot be negative.'); return; }
    setError(null);
    const fields = { name: name.trim(), kind, targetAmount: ta, currentAmount: ca, targetDate: date, monthlyContribution: monthly, linkedIds: linkedIds.length > 0 ? linkedIds : undefined };
    if (initial && onSave) { onSave(fields); }
    else { onAdd?.(fields); setName(''); setTargetAmount(''); setCurrentAmount(''); setTargetDate(''); setMonthlyContribution(''); setLinkedIds([]); onClose(); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={initial ? 'Edit Goal' : 'Add Goal'}>
      <Field label="Name">
        <Input value={name} onChangeText={setName} placeholder="e.g. Retirement Fund" />
      </Field>
      <Field label="Goal Type">
        <View style={styles.chipRow}>
          {(['retirement', 'house', 'emergency', 'other'] as Goal['kind'][]).map((k) => (
            <Chip key={k} label={k} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
      </Field>
      <View style={styles.twoCol}>
        <Field half money label="Target Amount">
          <Input value={targetAmount} onChangeText={(t) => setTargetAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
        </Field>
        <Field half money label="Saved So Far">
          <Input value={linked ? 'From linked holdings' : currentAmount} editable={!linked} onChangeText={(t) => setCurrentAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
        </Field>
      </View>
      <Field label="Target Date">
        <Input value={targetDate} onChangeText={setTargetDate} placeholder="YYYY-MM-DD (default +5 yrs)" />
      </Field>
      {error && <Text style={{ fontSize: 13, color: palette.danger }}>{error}</Text>}
      <Field money label="Monthly Contribution">
        <Input value={linked ? 'From linked SIPs' : monthlyContribution} editable={!linked} onChangeText={(t) => setMonthlyContribution(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      {holdings.length > 0 && (
        <Field label="Track with holdings (optional)">
          <View style={styles.chipRow}>
            {holdings.map((h) => (
              <Chip key={h.id} label={h.name} selected={linkedIds.includes(h.id)} onPress={() => toggleLink(h.id)} />
            ))}
          </View>
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>
            Linked goals use the live value of these assets and investments and their recurring contributions.
          </Text>
        </Field>
      )}
      <Button label={initial ? 'Save' : 'Add Goal'} onPress={submit} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

function SimulatorTab() {
  const { data, palette, currency } = useUi();
  const currentNw = useMemo(() => netWorth(withLiveData(data, todayISO())), [data]);
  const [sip, setSip] = useState('5000');
  const [years, setYears] = useState('10');
  const [ret, setRet] = useState('12');

  const sipNum = Number(sip) || 0;
  const yearsNum = Math.min(60, Number(years) || 0);
  const retNum = Number(ret) || 0;

  const projection = useMemo(() => {
    const points = [];
    for (let y = 0; y <= yearsNum; y++) {
      const val = projectNetWorth(currentNw, sipNum, y, retNum);
      points.push({ label: `Y${y}`, value: val });
    }
    return points;
  }, [currentNw, sipNum, yearsNum, retNum]);

  const final = projection[projection.length - 1]?.value ?? currentNw;

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <SectionTitle title="What-If Simulator" />
        <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 8 }}>
          See how changing your monthly investment changes your projected net worth.
        </Text>
        <Field money label="Monthly SIP">
          <Input value={sip} onChangeText={(t) => setSip(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" />
        </Field>
        <View style={styles.twoCol}>
          <Field half label="Years">
            <Input value={years} onChangeText={(t) => setYears(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" />
          </Field>
          <Field half label="Annual Return %">
            <Input value={ret} onChangeText={(t) => setRet(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" />
          </Field>
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 13, color: palette.textMuted }}>Projected Net Worth in {yearsNum} years</Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: palette.text, marginVertical: 4 }}>{formatMoney(final, currency, { compact: true })}</Text>
        <Text style={{ fontSize: 12, color: final >= currentNw ? palette.success : palette.danger }}>
          {final >= currentNw ? '+' : ''}{formatMoney(final - currentNw, currency, { compact: true })} from today
        </Text>
        {projection.length > 1 && <LineChart data={projection} height={150} />}
      </Card>
    </View>
  );
}

function EmergencyTab() {
  const { data, palette, currency } = useUi();
  const [months, setMonths] = useState('6');
  const monthsNum = Number(months) || 6;
  const recurringTransactions = useMemo(() => recurringTransactionsThrough(data.transactions, todayISO()), [data.transactions]);
  const avgSpend = useMemo(() => avgMonthlyExpenses(recurringTransactions, todayISO()), [recurringTransactions]);

  const liquid = useMemo(() => withLiveData(data, todayISO()).assets.filter((a) => a.liquid).reduce((s, a) => s + a.value, 0), [data]);
  const target = avgSpend * monthsNum;
  const progress = target > 0 ? Math.min(1, liquid / target) : 0;

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <SectionTitle title="Emergency Fund Target" />
        <Field label="Months of expenses to cover">
          <View style={styles.chipRow}>
            {['3', '6', '9', '12'].map((m) => (
              <Chip key={m} label={`${m} mo`} selected={months === m} onPress={() => setMonths(m)} />
            ))}
          </View>
        </Field>
      </Card>

      <Card>
        <Text style={{ fontSize: 13, color: palette.textMuted }}>Your target (avg {formatMoney(avgSpend, currency, { compact: true })}/mo × {monthsNum})</Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: palette.text, marginVertical: 4 }}>{formatMoney(target, currency, { compact: true })}</Text>
        <ProgressBar value={progress} color={progress >= 1 ? palette.success : palette.warning} />
        <View style={styles.goalFoot}>
          <Text style={{ fontSize: 12, color: palette.textMuted }}>
            You have {formatMoney(liquid, currency, { compact: true })}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: progress >= 1 ? palette.success : palette.warning }}>
            {formatPercent(progress)}
          </Text>
        </View>
        {target <= 0 && (
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>Add some expenses to calculate a target.</Text>
        )}
        {target > 0 && progress < 1 && (
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>
            Save {formatMoney(target - liquid, currency, { compact: true })} more to reach your target.
          </Text>
        )}
        {target > 0 && progress >= 1 && (
          <Text style={{ fontSize: 11, color: palette.success, marginTop: 4 }}>Your emergency fund is fully funded.</Text>
        )}
      </Card>
    </View>
  );
}

function DebtPlannerTab() {
  const { data, palette, currency } = useUi();
  const debts = useMemo(() => withLiveData(data, todayISO()).debts, [data]);
  const { snowball, avalanche } = debtStrategies(debts);

  const openDebts = debts.filter((debt) => debt.status !== 'closed');
  if (openDebts.length === 0) {
    return <EmptyState title="No debts to plan" subtitle="Add debts in the Assets tab to see payoff strategies." />;
  }

  const snowballPlan = debtStrategyPlan(snowball);
  const avalanchePlan = debtStrategyPlan(avalanche);

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <SectionTitle title="Snowball vs. Avalanche" />
        <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 8 }}>
          Compare two payoff strategies side by side. Paused debts are left out.
        </Text>
        <View style={styles.strategyCompare}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>Snowball</Text>
            <Text style={{ fontSize: 11, color: palette.textMuted, marginBottom: 4 }}>Smallest balance first</Text>
            {snowballPlan.items.map((p, i) => (
              <Text key={p.debt.id} style={{ fontSize: 11, color: palette.textMuted }}>
                {i + 1}. {p.debt.name} — {p.months === Infinity ? 'Not reachable' : `${p.months} mo`}
              </Text>
            ))}
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.primary, marginTop: 6 }}>
              Total: {snowballPlan.totalMonths === Infinity ? 'Not reachable' : `${snowballPlan.totalMonths} mo`}
            </Text>
            <Text style={{ fontSize: 11, color: palette.textMuted }}>Interest: {snowballPlan.totalInterest === Infinity ? 'Not reachable' : formatMoney(snowballPlan.totalInterest, currency, { compact: true })}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>Avalanche</Text>
            <Text style={{ fontSize: 11, color: palette.textMuted, marginBottom: 4 }}>Highest interest first</Text>
            {avalanchePlan.items.map((p, i) => (
              <Text key={p.debt.id} style={{ fontSize: 11, color: palette.textMuted }}>
                {i + 1}. {p.debt.name} — {p.months === Infinity ? 'Not reachable' : `${p.months} mo`}
              </Text>
            ))}
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.primary, marginTop: 6 }}>
              Total: {avalanchePlan.totalMonths === Infinity ? 'Not reachable' : `${avalanchePlan.totalMonths} mo`}
            </Text>
            <Text style={{ fontSize: 11, color: palette.textMuted }}>Interest: {avalanchePlan.totalInterest === Infinity ? 'Not reachable' : formatMoney(avalanchePlan.totalInterest, currency, { compact: true })}</Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionTitle title="Payoff Timeline" />
        {openDebts.map((d) => {
          const m = debtPayoffMonths(d);
          return (
            <View key={d.id} style={styles.timelineRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{d.name}</Text>
                <Text style={{ fontSize: 11, color: palette.textMuted }}>{formatMoney(d.outstanding, currency, { compact: true })} at {d.interestRate}%</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>{m === Infinity ? 'Never' : formatMonths(m)}</Text>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  screenTitle: { fontSize: 24, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalCard: { paddingVertical: 12, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A3556' },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  twoCol: { flexDirection: 'row', gap: 12 },
  strategyCompare: { flexDirection: 'row', gap: 12 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
});
