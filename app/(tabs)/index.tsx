import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { Card, SectionTitle, useUi, Chip, RiskBadge, EmptyState } from '@/components/ui';
import { LineChart, BarChart, DonutChart, Gauge, ProgressBar } from '@/components/charts';
import { useStore } from '@/lib/store';
import {
  computeTotals,
  computeRatios,
  monthKey,
  netWorth,
  totalAssets,
  totalInvestments,
  totalDebt,
  actualAllocation,
  bandForAge,
  bandLabelForAge,
  allocationDrift,
  lifestyleInflation,
} from '@/lib/calc';
import { formatMoney, formatPercent, todayISO, monthLabel } from '@/lib/format';
import { TrendingUp, Wallet, Shield, AlertTriangle } from 'lucide-react-native';

export default function DashboardScreen() {
  const { data, palette, currency } = useUi();
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const today = todayISO();

  const ratios = useMemo(() => computeRatios(data, today), [data, today]);
  const totals = useMemo(() => computeTotals(data.transactions, data.categories, period, today), [data, period, today]);

  // last 6 months trend
  const trend = useMemo(() => {
    const months: string[] = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
    }
    return months.map((mk) => {
      const inc = data.transactions.filter((t) => t.type === 'income' && monthKey(t.date) === mk).reduce((s, t) => s + t.amount, 0);
      const exp = data.transactions.filter((t) => t.type === 'expense' && monthKey(t.date) === mk).reduce((s, t) => s + t.amount, 0);
      return { label: monthLabel(mk).split(' ')[0], value: inc, value2: exp };
    });
  }, [data]);

  const nw = ratios.netWorth;
  const assets = totalAssets(data.assets);
  const invest = totalInvestments(data.investments);
  const debt = totalDebt(data.debts);

  const actual = useMemo(() => actualAllocation(data.investments, data.assets), [data]);
  const bandLabel = data.settings.age ? bandLabelForAge(data.settings.age) : null;
  const targetAlloc = data.settings.allocationTargets || (data.settings.age ? bandForAge(data.settings.age) : null);
  const drift = targetAlloc ? allocationDrift(actual, targetAlloc) : [];
  const lifeInfl = useMemo(() => lifestyleInflation(data.transactions, data.categories), [data]);

  const hasData = data.transactions.length > 0 || assets > 0 || invest > 0 || debt > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.hello, { color: palette.textMuted }]}>Your finances at a glance</Text>

        {/* Net worth headline */}
        <Card style={styles.netCard}>
          <View style={styles.netRow}>
            <View>
              <Text style={[styles.netLabel, { color: palette.textMuted }]}>Net Worth</Text>
              <Text style={[styles.netValue, { color: palette.text }]}>{formatMoney(nw, currency)}</Text>
            </View>
            <View style={[styles.netBadge, { backgroundColor: palette.primary + '22' }]}>
              <TrendingUp size={20} color={palette.primary} />
            </View>
          </View>
          <View style={styles.netBreakdown}>
            <BreakdownItem label="Assets" value={formatMoney(assets, currency, { compact: true })} color={palette.success} />
            <BreakdownItem label="Investments" value={formatMoney(invest, currency, { compact: true })} color={palette.accent} />
            <BreakdownItem label="Debt" value={`-${formatMoney(debt, currency, { compact: true })}`} color={palette.danger} />
          </View>
        </Card>

        {/* Period toggle */}
        <View style={styles.toggleRow}>
          <Chip label="Monthly" selected={period === 'monthly'} onPress={() => setPeriod('monthly')} />
          <Chip label="Annual" selected={period === 'annual'} onPress={() => setPeriod('annual')} />
        </View>

        {/* Savings rate gauge + emergency fund */}
        <View style={styles.row2}>
          <Card style={styles.halfCard}>
            <Text style={[styles.cardTitle, { color: palette.textMuted }]}>Savings Rate</Text>
            <Gauge value={ratios.savingsRate} color={palette.primary} />
            <Text style={[styles.cardFoot, { color: palette.text }]}>
              {formatMoney(totals.savings, currency, { compact: true })} saved this {period === 'monthly' ? 'month' : 'year'}
            </Text>
          </Card>
          <Card style={styles.halfCard}>
            <Text style={[styles.cardTitle, { color: palette.textMuted }]}>Emergency Fund</Text>
            <View style={styles.emergency}>
              <Shield size={28} color={palette.accent} />
              <Text style={[styles.emergencyMonths, { color: palette.text }]}>
                {ratios.emergencyFundMonths === null
                  ? 'N/A'
                  : ratios.emergencyFundMonths < 100
                  ? ratios.emergencyFundMonths.toFixed(1)
                  : '100+'}
              </Text>
              <Text style={[styles.emergencyLabel, { color: palette.textMuted }]}>months covered</Text>
            </View>
            <Text style={[styles.cardFoot, { color: palette.textMuted }]}>
              {ratios.emergencyFundMonths === null
                ? 'Add expenses to calculate'
                : ratios.emergencyFundMonths >= 6
                ? 'Well funded'
                : ratios.emergencyFundMonths >= 3
                ? 'Build to 6 months'
                : 'Below target'}
            </Text>
          </Card>
        </View>

        {/* Income vs Expense trend */}
        <Card>
          <SectionTitle title="Income vs Expense" />
          <BarChart data={trend.map((t) => ({ label: t.label, value: t.value }))} data2={trend.map((t) => ({ label: t.label, value: t.value2 }))} />
          <View style={styles.legendRow}>
            <Legend color={palette.primary} label="Income" />
            <Legend color={palette.warning} label="Expense" />
          </View>
        </Card>

        {/* Ratio health scorecard */}
        <Card>
          <SectionTitle title="Ratio Health Scorecard" />
          <View style={styles.scorecard}>
            <ScoreRow label="Savings Rate" value={formatPercent(ratios.savingsRate)} zone={ratios.savingsRate >= 0.2 ? 'green' : ratios.savingsRate >= 0.1 ? 'yellow' : 'red'} />
            <ScoreRow
              label="Debt Service"
              value={!isFinite(ratios.debtServiceRatio) ? 'N/A' : formatPercent(ratios.debtServiceRatio)}
              zone={ratios.debtServiceZone}
              note={!isFinite(ratios.debtServiceRatio) ? 'debt with no income' : undefined}
            />
            <ScoreRow
              label="Debt-to-Asset"
              value={!isFinite(ratios.debtToAsset) ? 'N/A' : formatPercent(ratios.debtToAsset)}
              zone={ratios.debtToAssetZone}
              note={!isFinite(ratios.debtToAsset) ? 'debt with no assets' : undefined}
            />
            <ScoreRow label="Liquidity" value={formatPercent(ratios.liquidityRatio)} zone={ratios.liquidityRatio >= 0.15 ? 'green' : ratios.liquidityRatio >= 0.05 ? 'yellow' : 'red'} />
            <ScoreRow label="Savings Coverage" value={!isFinite(ratios.savingsCoverage) ? '∞x' : `${ratios.savingsCoverage.toFixed(2)}x`} zone={ratios.savingsCoverage >= 0.2 ? 'green' : ratios.savingsCoverage >= 0.1 ? 'yellow' : 'red'} />
            {lifeInfl && (
              <ScoreRow
                label="Lifestyle Inflation"
                value={formatPercent(lifeInfl.value)}
                zone={lifeInfl.value < 0.5 ? 'green' : lifeInfl.value < 1 ? 'yellow' : 'red'}
                note={lifeInfl.noIncomeGrowth ? 'vs income baseline (no growth)' : 'lower better'}
              />
            )}
          </View>
        </Card>

        {/* Asset allocation */}
        {invest > 0 && (
          <Card>
            <SectionTitle title="Asset Allocation" action={bandLabel ? <Text style={[styles.bandTag, { color: palette.textMuted }]}>Target: {bandLabel}</Text> : undefined} />
            <DonutChart
              data={[
                { label: 'Stocks', value: actual.stocks },
                { label: 'MF', value: actual.mutualfund },
                { label: 'FD', value: actual.fd },
                { label: 'PPF', value: actual.ppf },
                { label: 'Gold', value: actual.gold },
                { label: 'Crypto', value: actual.crypto },
                { label: 'Other', value: actual.other },
              ].filter((d) => d.value > 0)}
            />
            {drift.length > 0 && (
              <View style={styles.driftList}>
                {drift.filter((d) => Math.abs(d.drift) > 0.05).map((d) => (
                  <View key={d.type} style={styles.driftRow}>
                    <Text style={[styles.driftType, { color: palette.text }]}>{d.type}</Text>
                    <Text style={[styles.driftVal, { color: d.drift > 0 ? palette.warning : palette.success }]}>
                      {d.drift > 0 ? '+' : ''}{formatPercent(d.drift, 0)} vs target
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        {!hasData && (
          <EmptyState title="No data yet" subtitle="Add your first income, expense, asset, or debt to see your dashboard come alive." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BreakdownItem({ label, value, color }: { label: string; value: string; color: string }) {
  const { palette } = useUi();
  return (
    <View style={styles.bdItem}>
      <View style={[styles.bdDot, { backgroundColor: color }]} />
      <Text style={{ fontSize: 11, color: palette.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>{value}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { palette } = useUi();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={{ fontSize: 12, color: palette.text }}>{label}</Text>
    </View>
  );
}

function ScoreRow({ label, value, zone, note }: { label: string; value: string; zone: 'green' | 'yellow' | 'red'; note?: string }) {
  const { palette } = useUi();
  return (
    <View style={styles.scoreRow}>
      <Text style={{ fontSize: 13, flex: 1, color: palette.text }}>{label}{note ? <Text style={{ fontSize: 11, color: palette.textMuted }}> ({note})</Text> : null}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', marginRight: 12, color: palette.text }}>{value}</Text>
      <RiskBadge zone={zone} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  hello: { fontSize: 13, marginBottom: 4 },
  netCard: { padding: 20 },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  netLabel: { fontSize: 13, fontWeight: '600' },
  netValue: { fontSize: 32, fontWeight: '800', marginTop: 4 },
  netBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  netBreakdown: { flexDirection: 'row', gap: 20, marginTop: 16 },
  bdItem: { gap: 2 },
  bdDot: { width: 8, height: 8, borderRadius: 4 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  row2: { flexDirection: 'row', gap: 12 },
  halfCard: { flex: 1, alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 13, fontWeight: '600' },
  cardFoot: { fontSize: 12, textAlign: 'center' },
  emergency: { alignItems: 'center', gap: 2, marginVertical: 8 },
  emergencyMonths: { fontSize: 28, fontWeight: '800' },
  emergencyLabel: { fontSize: 11 },
  legendRow: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  scorecard: { gap: 10 },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  bandTag: { fontSize: 11 },
  driftList: { marginTop: 12, gap: 6 },
  driftRow: { flexDirection: 'row', justifyContent: 'space-between' },
  driftType: { fontSize: 12, textTransform: 'capitalize' },
  driftVal: { fontSize: 12, fontWeight: '600' },
});
