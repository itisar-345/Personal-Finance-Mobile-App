import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Pressable } from 'react-native';
import { Card, SectionTitle, useUi, Chip, Button, Input, Field, EmptyState } from '@/components/ui';
import { LineChart, ProgressBar } from '@/components/charts';
import { Sheet } from '@/components/Sheet';
import { useStore } from '@/lib/store';
import {
  goalProgress,
  monthsUntil,
  requiredMonthlyForGoal,
  projectNetWorth,
  netWorth,
  debtStrategies,
  debtPayoffMonths,
  avgMonthlyExpenses,
} from '@/lib/calc';
import { formatMoney, formatPercent, formatMonths, todayISO } from '@/lib/format';
import { Plus, Trash2, Target, Calculator, Shield, TrendingUp } from 'lucide-react-native';
import type { Goal } from '@/lib/types';

type Tab = 'goals' | 'simulator' | 'emergency' | 'debt';

export default function GoalsScreen() {
  const { palette } = useUi();
  const [tab, setTab] = useState<Tab>('goals');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
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
            const progress = goalProgress(g.currentAmount, g.targetAmount);
            const months = monthsUntil(g.targetDate);
            const required = requiredMonthlyForGoal(g.targetAmount, g.currentAmount, months, data.settings.expectedReturn || 10);
            return (
              <View key={g.id} style={[styles.goalCard, { borderBottomColor: palette.border }]}>
                <View style={styles.goalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{g.name}</Text>
                    <Text style={{ fontSize: 11, color: palette.textMuted }}>{g.kind} · {months} mo left</Text>
                  </View>
                  <Pressable onPress={() => deleteGoal(g.id)}>
                    <Trash2 size={16} color={palette.danger} />
                  </Pressable>
                </View>
                <ProgressBar value={progress} color={palette.primary} />
                <View style={styles.goalFoot}>
                  <Text style={{ fontSize: 12, color: palette.textMuted }}>
                    {formatMoney(g.currentAmount, currency, { compact: true })} / {formatMoney(g.targetAmount, currency, { compact: true })}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: palette.primary }}>{formatPercent(progress)}</Text>
                </View>
                <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>
                  Need {formatMoney(required, currency, { compact: true })}/mo to hit target
                </Text>
              </View>
            );
          })
        )}
      </Card>

      <GoalSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={addGoal} />
    </View>
  );
}

function GoalSheet({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (g: Omit<Goal, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Goal['kind']>('retirement');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');

  const submit = () => {
    const ta = Number(targetAmount);
    const ca = Number(currentAmount) || 0;
    if (!name.trim() || !ta) return;
    const date = targetDate || new Date(Date.now() + 5 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    onAdd({ name: name.trim(), kind, targetAmount: ta, currentAmount: ca, targetDate: date, monthlyContribution: Number(monthlyContribution) || 0 });
    setName(''); setTargetAmount(''); setCurrentAmount(''); setTargetDate(''); setMonthlyContribution('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Add Goal">
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
        <Field label="Target Amount">
          <Input value={targetAmount} onChangeText={(t) => setTargetAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
        </Field>
        <Field label="Saved So Far">
          <Input value={currentAmount} onChangeText={(t) => setCurrentAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
        </Field>
      </View>
      <Field label="Target Date">
        <Input value={targetDate} onChangeText={setTargetDate} placeholder="YYYY-MM-DD (default +5 yrs)" />
      </Field>
      <Field label="Monthly Contribution">
        <Input value={monthlyContribution} onChangeText={(t) => setMonthlyContribution(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <Button label="Add Goal" onPress={submit} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

function SimulatorTab() {
  const { data, palette, currency } = useUi();
  const currentNw = netWorth(data);
  const [sip, setSip] = useState('5000');
  const [years, setYears] = useState('10');
  const [ret, setRet] = useState('12');

  const sipNum = Number(sip) || 0;
  const yearsNum = Number(years) || 0;
  const retNum = Number(ret) || 0;

  const projection = useMemo(() => {
    const points = [];
    for (let y = 0; y <= yearsNum; y++) {
      const val = projectNetWorth(currentNw, sipNum, y, retNum);
      points.push({ label: `Y${y}`, value: val });
    }
    return points;
  }, [currentNw, sipNum, yearsNum, retNum]);

  const final = projection[projection.length - 1]?.value || currentNw;

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <SectionTitle title="What-If Simulator" />
        <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 8 }}>
          See how changing your monthly investment changes your projected net worth.
        </Text>
        <Field label="Monthly SIP">
          <Input value={sip} onChangeText={(t) => setSip(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" />
        </Field>
        <View style={styles.twoCol}>
          <Field label="Years">
            <Input value={years} onChangeText={(t) => setYears(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" />
          </Field>
          <Field label="Annual Return %">
            <Input value={ret} onChangeText={(t) => setRet(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" />
          </Field>
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 13, color: palette.textMuted }}>Projected Net Worth in {yearsNum} years</Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: palette.text, marginVertical: 4 }}>{formatMoney(final, currency, { compact: true })}</Text>
        <Text style={{ fontSize: 12, color: palette.success }}>
          +{formatMoney(final - currentNw, currency, { compact: true })} from today
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
  const avgSpend = useMemo(() => avgMonthlyExpenses(data.transactions, todayISO()), [data]);

  const liquid = data.assets.filter((a) => a.status !== 'closed' && a.liquid).reduce((s, a) => s + a.value, 0);
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
        {progress < 1 && (
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>
            Save {formatMoney(target - liquid, currency, { compact: true })} more to reach your target.
          </Text>
        )}
        {progress >= 1 && (
          <Text style={{ fontSize: 11, color: palette.success, marginTop: 4 }}>Your emergency fund is fully funded.</Text>
        )}
      </Card>
    </View>
  );
}

function DebtPlannerTab() {
  const { data, palette, currency } = useUi();
  const { snowball, avalanche } = debtStrategies(data.debts);

  if (data.debts.length === 0) {
    return <EmptyState title="No debts to plan" subtitle="Add debts in the Assets tab to see payoff strategies." />;
  }

  const totalMonths = (order: typeof snowball) => {
    let cumulative = 0;
    return order.map((d) => {
      const m = debtPayoffMonths(d);
      cumulative += m;
      return { name: d.name, months: m, cumulative };
    });
  };

  const snowballPlan = totalMonths(snowball);
  const avalanchePlan = totalMonths(avalanche);

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <SectionTitle title="Snowball vs. Avalanche" />
        <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 8 }}>
          Compare two payoff strategies side by side.
        </Text>
        <View style={styles.strategyCompare}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>Snowball</Text>
            <Text style={{ fontSize: 11, color: palette.textMuted, marginBottom: 4 }}>Smallest balance first</Text>
            {snowballPlan.map((p, i) => (
              <Text key={i} style={{ fontSize: 11, color: palette.textMuted }}>
                {i + 1}. {p.name} — {p.months === Infinity ? 'Never (EMI < interest)' : `${p.months} mo`}
              </Text>
            ))}
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.primary, marginTop: 6 }}>
              Total: ~{snowballPlan[snowballPlan.length - 1]?.cumulative === Infinity ? 'N/A' : `${snowballPlan[snowballPlan.length - 1]?.cumulative} mo`}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>Avalanche</Text>
            <Text style={{ fontSize: 11, color: palette.textMuted, marginBottom: 4 }}>Highest interest first</Text>
            {avalanchePlan.map((p, i) => (
              <Text key={i} style={{ fontSize: 11, color: palette.textMuted }}>
                {i + 1}. {p.name} — {p.months === Infinity ? 'Never (EMI < interest)' : `${p.months} mo`}
              </Text>
            ))}
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.primary, marginTop: 6 }}>
              Total: ~{avalanchePlan[avalanchePlan.length - 1]?.cumulative === Infinity ? 'N/A' : `${avalanchePlan[avalanchePlan.length - 1]?.cumulative} mo`}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionTitle title="Payoff Timeline" />
        {data.debts.filter((d) => d.status !== 'closed').map((d) => {
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
