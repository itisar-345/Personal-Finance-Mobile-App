import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Pressable } from 'react-native';
import { Card, SectionTitle, useUi, Chip, Button, Input, Field, EmptyState, RiskBadge, StatusBadge, LifecycleActions } from '@/components/ui';
import { DonutChart, ProgressBar } from '@/components/charts';
import { Sheet } from '@/components/Sheet';
import { useStore } from '@/lib/store';
import {
  totalAssets,
  totalInvestments,
  totalDebt,
  monthlyDebtPayments,
  actualAllocation,
  bandForAge,
  bandLabelForAge,
  allocationDrift,
  cagr,
  debtPayoffMonths,
  debtStrategies,
  totalContributed,
  monthlyContribution,
  projectedContributionEntries,
  groupByPeriod,
  type PeriodMode,
} from '@/lib/calc';
import { formatMoney, formatPercent, todayISO } from '@/lib/format';
import { Trash2, Pencil } from 'lucide-react-native';
import type { Asset, AssetType, Investment, InvestmentType, Debt, DebtType, AllocationTarget, Contribution, ContributionType, ContributionFreq } from '@/lib/types';

type Tab = 'assets' | 'investments' | 'debts' | 'allocation';

export default function AssetsScreen() {
  const { palette } = useUi();
  const [tab, setTab] = useState<Tab>('assets');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Assets & Debt</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.tabRow}>
          {(['assets', 'investments', 'debts', 'allocation'] as Tab[]).map((t) => (
            <Chip key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} selected={tab === t} onPress={() => setTab(t)} />
          ))}
        </View>
        {tab === 'assets' && <AssetsTab />}
        {tab === 'investments' && <InvestmentsTab />}
        {tab === 'debts' && <DebtsTab />}
        {tab === 'allocation' && <AllocationTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

function AssetsTab() {
  const { data, palette, currency } = useUi();
  const { addAsset, updateAsset, deleteAsset, setAssetStatus } = useStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [period, setPeriod] = useState<PeriodMode>('monthly');
  const total = totalAssets(data.assets);
  const liquid = data.assets.filter((a) => a.status !== 'closed' && a.liquid).reduce((s, a) => s + a.value, 0);

  const grouped = useMemo(() => groupByPeriod(data.assets, period), [data.assets, period]);

  return (
    <View style={{ gap: 14 }}>
      <Card style={styles.totalCard}>
        <Text style={[styles.totalLabel, { color: palette.textMuted }]}>Total Assets</Text>
        <Text style={[styles.totalValue, { color: palette.text }]}>{formatMoney(total, currency)}</Text>
        <View style={styles.totalSub}>
          <Text style={{ fontSize: 12, color: palette.textMuted }}>Liquid: {formatMoney(liquid, currency, { compact: true })}</Text>
          <Text style={{ fontSize: 12, color: palette.textMuted }}>Illiquid: {formatMoney(total - liquid, currency, { compact: true })}</Text>
        </View>
      </Card>

      <View style={styles.tabRow}>
        <Chip label="Monthly" selected={period === 'monthly'} onPress={() => setPeriod('monthly')} />
        <Chip label="Yearly" selected={period === 'annual'} onPress={() => setPeriod('annual')} />
      </View>

      <Card>
        <SectionTitle title="Asset List" action={
          <Pressable onPress={() => setSheetOpen(true)}>
            <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>+ Add</Text>
          </Pressable>
        } />
        {data.assets.length === 0 ? (
          <EmptyState title="No assets yet" subtitle="Add cash, bank balances, real estate, gold, and more." />
        ) : (
          grouped.map((group) => (
            <View key={group.key}>
              <Text style={[styles.groupHeader, { color: palette.textMuted }]}>{group.label}</Text>
              {group.items.map((a) => (
                <View key={a.id} style={styles.itemRow}>
                  <View style={[styles.typeDot, { backgroundColor: palette.chart[assetTypeIndex(a.type)] }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>{a.name}</Text>
                      <StatusBadge status={a.status} />
                    </View>
                    <Text style={{ fontSize: 11, color: palette.textMuted }}>{a.type} · {a.liquid ? 'Liquid' : 'Illiquid'}{a.closedDate ? ` · closed ${a.closedDate}` : ''}</Text>
                    <LifecycleActions
                      status={a.status}
                      onPause={() => setAssetStatus(a.id, 'paused')}
                      onResume={() => setAssetStatus(a.id, 'active')}
                      onClose={() => setAssetStatus(a.id, 'closed')}
                      onReopen={() => setAssetStatus(a.id, 'active')}
                    />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{formatMoney(a.value, currency, { compact: true })}</Text>
                  <Pressable onPress={() => setEditingAsset(a)} hitSlop={8}>
                    <Pencil size={16} color={palette.primary} />
                  </Pressable>
                  <Pressable onPress={() => deleteAsset(a.id)} hitSlop={8}>
                    <Trash2 size={16} color={palette.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}
      </Card>

      <AssetSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={addAsset} />
      {editingAsset && (
        <AssetSheet
          visible={!!editingAsset}
          onClose={() => setEditingAsset(null)}
          initial={editingAsset}
          onSave={(fields) => { updateAsset(editingAsset.id, fields); setEditingAsset(null); }}
        />
      )}
    </View>
  );
}

function AssetSheet({
  visible, onClose, onAdd, onSave, initial,
}: {
  visible: boolean; onClose: () => void;
  onAdd?: (a: Omit<Asset, 'id'>) => void;
  onSave?: (a: Partial<Asset>) => void;
  initial?: Asset;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<AssetType>(initial?.type ?? 'cash');
  const [value, setValue] = useState(initial ? String(initial.value) : '');
  const [liquid, setLiquid] = useState(initial?.liquid ?? true);
  const [date, setDate] = useState(initial?.date ?? todayISO());

  const submit = () => {
    const v = Number(value);
    if (!name.trim() || !v) return;
    const fields = { name: name.trim(), type, value: v, liquid: type === 'cash' || type === 'bank' ? true : liquid, date };
    if (initial && onSave) { onSave(fields); }
    else { onAdd?.({ ...fields, status: 'active' }); setName(''); setValue(''); setLiquid(true); setDate(todayISO()); onClose(); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={initial ? 'Edit Asset' : 'Add Asset'}>
      <Field label="Name">
        <Input value={name} onChangeText={setName} placeholder="e.g. Savings Account" />
      </Field>
      <Field label="Type">
        <View style={styles.chipRow}>
          {(['cash', 'bank', 'realestate', 'gold', 'other'] as AssetType[]).map((t) => (
            <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
          ))}
        </View>
      </Field>
      <Field label="Value">
        <Input value={value} onChangeText={(t) => setValue(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <Field label="Date">
        <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      </Field>
      {type !== 'cash' && type !== 'bank' && (
        <Field label="Liquid?">
          <View style={styles.chipRow}>
            <Chip label="Liquid" selected={liquid} onPress={() => setLiquid(true)} />
            <Chip label="Illiquid" selected={!liquid} onPress={() => setLiquid(false)} />
          </View>
        </Field>
      )}
      <Button label={initial ? 'Save' : 'Add Asset'} onPress={submit} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

function InvestmentsTab() {
  const { data, palette, currency } = useUi();
  const { addInvestment, addInvestmentWithContribution, updateInvestment, deleteInvestment, setInvestmentStatus, addContribution, updateContribution, deleteContribution, setContributionStatus } = useStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [contribSheetFor, setContribSheetFor] = useState<Investment | null>(null);
  const [detailFor, setDetailFor] = useState<Investment | null>(null);
  const [period, setPeriod] = useState<PeriodMode>('monthly');
  const today = todayISO();
  const total = totalInvestments(data.investments);
  const contributedTotal = data.investments
    .filter((i) => i.status !== 'closed')
    .reduce((sum, inv) => sum + totalContributed(data.contributions, inv.id, today), 0);
  const gain = total - contributedTotal;

  const grouped = useMemo(() => groupByPeriod(data.investments, period), [data.investments, period]);

  return (
    <View style={{ gap: 14 }}>
      <Card style={styles.totalCard}>
        <Text style={[styles.totalLabel, { color: palette.textMuted }]}>Total Investments</Text>
        <Text style={[styles.totalValue, { color: palette.text }]}>{formatMoney(total, currency)}</Text>
        <Text style={{ fontSize: 12, color: gain >= 0 ? palette.success : palette.danger, marginTop: 4 }}>
          {gain >= 0 ? '+' : ''}{formatMoney(gain, currency, { compact: true })} ({formatPercent(contributedTotal > 0 ? gain / contributedTotal : 0)})
        </Text>
      </Card>

      <View style={styles.tabRow}>
        <Chip label="Monthly" selected={period === 'monthly'} onPress={() => setPeriod('monthly')} />
        <Chip label="Yearly" selected={period === 'annual'} onPress={() => setPeriod('annual')} />
      </View>

      <Card>
        <SectionTitle title="Holdings" action={
          <Pressable onPress={() => setSheetOpen(true)}>
            <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>+ Add</Text>
          </Pressable>
        } />
        {data.investments.length === 0 ? (
          <EmptyState title="No investments yet" subtitle="Track stocks, mutual funds, FDs, PPF, crypto, and more." />
        ) : (
          grouped.map((group) => (
            <View key={group.key}>
              <Text style={[styles.groupHeader, { color: palette.textMuted }]}>{group.label}</Text>
              {group.items.map((inv) => {
                const contributed = totalContributed(data.contributions, inv.id, today);
                const costBasis = contributed > 0 ? contributed : inv.purchaseValue;
                const gain = inv.currentValue - costBasis;
                // Issue 5: CAGR is only meaningful for a single lump-sum purchase.
                // With ongoing SIPs the purchaseDate anchors the full period for all contributions,
                // understating CAGR. Show it only when there are no contributions recorded.
                const contribs = data.contributions.filter((c) => c.holdingId === inv.id);
                const cagrValue = contribs.length === 0 ? cagr(inv.purchaseValue, inv.currentValue, inv.purchaseDate) : null;
                const isStale = inv.currentValue === inv.purchaseValue && contributed > inv.purchaseValue;
                const monthly = monthlyContribution(data.contributions, inv.id);
                return (
                  <View key={inv.id} style={styles.itemRow}>
                    <View style={[styles.typeDot, { backgroundColor: palette.chart[invTypeIndex(inv.type)] }]} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>{inv.name}</Text>
                        <StatusBadge status={inv.status} />
                      </View>
                      <Text style={{ fontSize: 11, color: palette.textMuted }}>
                        {inv.type}{cagrValue !== null ? ` · CAGR ${formatPercent(cagrValue)}` : ' · CAGR N/A (SIP)'}{monthly > 0 ? ` · ${formatMoney(monthly, currency, { compact: true })}/mo SIP` : ''}
                      </Text>
                      {isStale && (
                        <Text style={{ fontSize: 11, color: palette.warning, marginTop: 2 }}>Current value not updated — tap to record market price</Text>
                      )}
                      {contribs.length > 0 && (
                        <Pressable onPress={() => setDetailFor(inv)}>
                          <Text style={{ fontSize: 11, color: palette.primary, fontWeight: '600', marginTop: 2 }}>{contribs.length} contribution(s) · {formatMoney(contributed, currency, { compact: true })} contributed</Text>
                        </Pressable>
                      )}
                      <View style={styles.actionRow}>
                        <LifecycleActions
                          status={inv.status}
                          onPause={() => setInvestmentStatus(inv.id, 'paused')}
                          onResume={() => setInvestmentStatus(inv.id, 'active')}
                          onClose={() => setInvestmentStatus(inv.id, 'closed')}
                          onReopen={() => setInvestmentStatus(inv.id, 'active')}
                        />
                        <Pressable onPress={() => setContribSheetFor(inv)} style={[styles.contribBtn, { borderColor: palette.primary }]}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: palette.primary }}>+ Contribution</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{formatMoney(inv.currentValue, currency, { compact: true })}</Text>
                      <Text style={{ fontSize: 11, color: gain >= 0 ? palette.success : palette.danger }}>
                        {gain >= 0 ? '+' : ''}{formatMoney(gain, currency, { compact: true })}
                      </Text>
                    </View>
                    <Pressable onPress={() => setEditingInvestment(inv)} hitSlop={8}>
                      <Pencil size={16} color={palette.primary} />
                    </Pressable>
                    <Pressable onPress={() => deleteInvestment(inv.id)} hitSlop={8}>
                      <Trash2 size={16} color={palette.danger} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </Card>

      {editingInvestment && (
        <InvestmentEditSheet
          visible={!!editingInvestment}
          onClose={() => setEditingInvestment(null)}
          investment={editingInvestment}
          contributions={data.contributions.filter((c) => c.holdingId === editingInvestment.id)}
          onSave={(fields) => { updateInvestment(editingInvestment.id, fields); setEditingInvestment(null); }}
          onUpdateContribution={updateContribution}
          onDeleteContribution={deleteContribution}
        />
      )}

      <InvestmentSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={(inv, contrib) => {
          if (contrib) addInvestmentWithContribution(inv, contrib);
          else addInvestment(inv);
        }}
      />

      {contribSheetFor && (
        <ContributionSheet
          visible={!!contribSheetFor}
          onClose={() => setContribSheetFor(null)}
          holdingId={contribSheetFor.id}
          holdingKind="investment"
          holdingName={contribSheetFor.name}
          contributions={data.contributions.filter((c) => c.holdingId === contribSheetFor.id)}
          onAdd={addContribution}
          onDelete={deleteContribution}
          onSetStatus={setContributionStatus}
        />
      )}

      {detailFor && (
        <Sheet visible={!!detailFor} onClose={() => setDetailFor(null)} title={`Contributions — ${detailFor.name}`}>
          <ContributionDetail holdingId={detailFor.id} />
        </Sheet>
      )}
    </View>
  );
}

function ContributionDetail({ holdingId }: { holdingId: string }) {
  const { data, palette, currency } = useUi();
  const contribs = data.contributions.filter((c) => c.holdingId === holdingId);
  const today = todayISO();
  if (contribs.length === 0) {
    return <EmptyState title="No contributions yet" subtitle="Add a one-time lumpsum or a recurring SIP." />;
  }
  return (
    <View style={{ gap: 12 }}>
      {contribs.map((c) => {
        const projected = c.type === 'recurring'
          ? projectedContributionEntries(c, today).reduce((s, e) => s + e.amount, 0)
          : c.amount;
        return (
          <View key={c.id} style={[styles.contribCard, { borderColor: palette.border, backgroundColor: palette.surfaceAlt }]}>
            <View style={styles.nameRow}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>{c.type === 'onetime' ? 'Lumpsum' : `SIP · ${c.freq || 'monthly'}`}</Text>
              <StatusBadge status={c.status} />
            </View>
            <Text style={{ fontSize: 12, color: palette.textMuted }}>
              {formatMoney(c.amount, currency)} · started {c.startDate}{c.pausedDate ? ` · paused ${c.pausedDate}` : ''}{c.closedDate ? ` · closed ${c.closedDate}` : ''}
            </Text>
            <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600', marginTop: 4 }}>
              Total contributed: {formatMoney(projected, currency, { compact: true })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function InvestmentSheet({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (inv: Omit<Investment, 'id'>, firstContrib?: Omit<Contribution, 'id' | 'holdingId'>) => void;
}) {
  const { palette } = useUi();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [type, setType] = useState<InvestmentType>('stocks');
  const [contribType, setContribType] = useState<ContributionType>('onetime');
  const [amount, setAmount] = useState('');
  const [freq, setFreq] = useState<ContributionFreq>('monthly');
  const [startDate, setStartDate] = useState(todayISO());
  const [currentValue, setCurrentValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep(0); setName(''); setType('stocks'); setContribType('onetime');
    setAmount(''); setFreq('monthly'); setStartDate(todayISO()); setCurrentValue(''); setError(null);
  };

  const close = () => { reset(); onClose(); };

  const next = () => {
    if (step === 0 && !name.trim()) { setError('Please enter a name.'); return; }
    if (step === 1 && !Number(amount)) { setError('Please enter an amount.'); return; }
    setError(null);
    setStep((s) => s + 1);
  };

  const submit = () => {
    const amt = Number(amount);
    const cv = currentValue ? Number(currentValue) : amt;
    if (!cv) { setError('Please enter a current value.'); return; }
    const inv: Omit<Investment, 'id'> = {
      name: name.trim(),
      type,
      purchaseValue: amt,
      currentValue: cv,
      purchaseDate: startDate,
      status: 'active',
    };
    const firstContrib: Omit<Contribution, 'id' | 'holdingId'> = {
      holdingKind: 'investment',
      type: contribType,
      amount: amt,
      freq: contribType === 'recurring' ? freq : undefined,
      startDate,
      status: 'active',
    };
    onAdd(inv, firstContrib);
    reset();
    onClose();
  };

  const stepLabels = ['Basic Info', 'Funding', 'Current Value'];

  return (
    <Sheet visible={visible} onClose={close} title="Add Investment">
      <View style={[styles.stepIndicator, { borderBottomColor: palette.border }]}>
        {stepLabels.map((label, i) => (
          <View key={i} style={styles.stepDotWrap}>
            <View style={[styles.stepDot, { backgroundColor: i <= step ? palette.primary : palette.surfaceAlt }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: i <= step ? palette.primaryText : palette.textMuted }}>{i + 1}</Text>
            </View>
            <Text style={{ fontSize: 10, color: i <= step ? palette.text : palette.textMuted, marginLeft: 4 }}>{label}</Text>
          </View>
        ))}
      </View>

      {step === 0 && (
        <View style={{ gap: 12 }}>
          <Field label="Name">
            <Input value={name} onChangeText={(t) => { setName(t); setError(null); }} placeholder="e.g. Nifty 50 Index Fund" />
          </Field>
          <Field label="Type">
            <View style={styles.chipRow}>
              {(['stocks', 'mutualfund', 'fd', 'ppf', 'crypto', 'other'] as InvestmentType[]).map((t) => (
                <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
              ))}
            </View>
          </Field>
          {error && <Text style={{ fontSize: 13, color: palette.danger }}>{error}</Text>}
          <Button label="Next" onPress={next} />
        </View>
      )}

      {step === 1 && (
        <View style={{ gap: 12 }}>
          <Field label="How are you funding this?">
            <View style={styles.chipRow}>
              <Chip label="One-time / Lumpsum" selected={contribType === 'onetime'} onPress={() => setContribType('onetime')} />
              <Chip label="Recurring (SIP)" selected={contribType === 'recurring'} onPress={() => setContribType('recurring')} />
            </View>
          </Field>
          <Field label={contribType === 'onetime' ? 'Amount' : 'SIP Amount'}>
            <Input value={amount} onChangeText={(t) => { setAmount(t.replace(/[^0-9.]/g, '')); setError(null); }} keyboardType="numeric" placeholder="0" />
          </Field>
          {contribType === 'recurring' && (
            <Field label="Frequency">
              <View style={styles.chipRow}>
                {(['weekly', 'monthly', 'quarterly'] as ContributionFreq[]).map((f) => (
                  <Chip key={f} label={f} selected={freq === f} onPress={() => setFreq(f)} />
                ))}
              </View>
            </Field>
          )}
          <Field label={contribType === 'onetime' ? 'Date' : 'Start Date'}>
            <Input value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
          </Field>
          {error && <Text style={{ fontSize: 13, color: palette.danger }}>{error}</Text>}
          <View style={styles.stepNavRow}>
            <Button label="Back" variant="outline" onPress={() => setStep(0)} />
            <View style={{ width: 12 }} />
            <Button label="Next" onPress={next} />
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 13, color: palette.textMuted }}>
            Enter the current market value of this holding. Leave blank to use the contribution amount ({amount || '0'}) — you can update it later as the market value changes.
          </Text>
          <Field label="Current Value">
            <Input value={currentValue} onChangeText={(t) => { setCurrentValue(t.replace(/[^0-9.]/g, '')); setError(null); }} keyboardType="numeric" placeholder={amount || '0'} />
          </Field>
          {error && <Text style={{ fontSize: 13, color: palette.danger }}>{error}</Text>}
          <View style={styles.stepNavRow}>
            <Button label="Back" variant="outline" onPress={() => setStep(1)} />
            <View style={{ width: 12 }} />
            <Button label="Add Investment" onPress={submit} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

function DebtsTab() {
  const { data, palette, currency } = useUi();
  const { addDebt, updateDebt, deleteDebt, setDebtStatus } = useStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [period, setPeriod] = useState<PeriodMode>('monthly');
  const total = totalDebt(data.debts);
  const monthly = monthlyDebtPayments(data.debts);

  const grouped = useMemo(() => groupByPeriod(data.debts, period), [data.debts, period]);

  return (
    <View style={{ gap: 14 }}>
      <Card style={styles.totalCard}>
        <Text style={[styles.totalLabel, { color: palette.textMuted }]}>Total Debt</Text>
        <Text style={[styles.totalValue, { color: palette.text }]}>{formatMoney(total, currency)}</Text>
        <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 4 }}>Monthly payments: {formatMoney(monthly, currency, { compact: true })}</Text>
      </Card>

      <View style={styles.tabRow}>
        <Chip label="Monthly" selected={period === 'monthly'} onPress={() => setPeriod('monthly')} />
        <Chip label="Yearly" selected={period === 'annual'} onPress={() => setPeriod('annual')} />
      </View>

      <Card>
        <SectionTitle title="Debts" action={
          <Pressable onPress={() => setSheetOpen(true)}>
            <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>+ Add</Text>
          </Pressable>
        } />
        {data.debts.length === 0 ? (
          <EmptyState title="No debts tracked" subtitle="Add loans, credit cards, and EMIs to see payoff timelines." />
        ) : (
          grouped.map((group) => (
            <View key={group.key}>
              <Text style={[styles.groupHeader, { color: palette.textMuted }]}>{group.label}</Text>
              {group.items.map((d) => {
                const months = d.status === 'closed' ? 0 : debtPayoffMonths(d);
                return (
                  <View key={d.id} style={styles.itemRow}>
                    <View style={[styles.typeDot, { backgroundColor: palette.danger }]} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>{d.name}</Text>
                        <StatusBadge status={d.status} />
                      </View>
                      <Text style={{ fontSize: 11, color: palette.textMuted }}>{d.type} · {d.interestRate}% · {d.status === 'closed' ? 'paid off' : months === Infinity ? 'EMI below interest' : `${months} mo left`}{d.closedDate ? ` · ${d.closedDate}` : ''}</Text>
                      <LifecycleActions
                        status={d.status}
                        onPause={() => setDebtStatus(d.id, 'paused')}
                        onResume={() => setDebtStatus(d.id, 'active')}
                        onClose={() => setDebtStatus(d.id, 'closed')}
                        onReopen={() => setDebtStatus(d.id, 'active')}
                      />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{formatMoney(d.outstanding, currency, { compact: true })}</Text>
                      <Text style={{ fontSize: 11, color: palette.textMuted }}>EMI {formatMoney(d.emi, currency, { compact: true })}</Text>
                    </View>
                    <Pressable onPress={() => setEditingDebt(d)} hitSlop={8}>
                      <Pencil size={16} color={palette.primary} />
                    </Pressable>
                    <Pressable onPress={() => deleteDebt(d.id)} hitSlop={8}>
                      <Trash2 size={16} color={palette.danger} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </Card>

      {data.debts.length > 0 && <DebtStrategyCard />}

      <DebtSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={addDebt} />
      {editingDebt && (
        <DebtSheet
          visible={!!editingDebt}
          onClose={() => setEditingDebt(null)}
          initial={editingDebt}
          onSave={(fields) => { updateDebt(editingDebt.id, fields); setEditingDebt(null); }}
        />
      )}
    </View>
  );
}

function DebtStrategyCard() {
  const { data, palette, currency } = useUi();
  const { snowball, avalanche } = debtStrategies(data.debts);
  return (
    <Card>
      <SectionTitle title="Payoff Strategy" />
      <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 8 }}>
        Snowball pays smallest balances first for momentum. Avalanche pays highest interest first to save money.
      </Text>
      <View style={styles.strategyRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>Snowball</Text>
          {snowball.map((d, i) => (
            <Text key={d.id} style={{ fontSize: 11, color: palette.textMuted }}>{i + 1}. {d.name} ({formatMoney(d.outstanding, currency, { compact: true })})</Text>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>Avalanche</Text>
          {avalanche.map((d, i) => (
            <Text key={d.id} style={{ fontSize: 11, color: palette.textMuted }}>{i + 1}. {d.name} ({d.interestRate}%)</Text>
          ))}
        </View>
      </View>
    </Card>
  );
}

function DebtSheet({
  visible, onClose, onAdd, onSave, initial,
}: {
  visible: boolean; onClose: () => void;
  onAdd?: (d: Omit<Debt, 'id'>) => void;
  onSave?: (d: Partial<Debt>) => void;
  initial?: Debt;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<DebtType>(initial?.type ?? 'loan');
  const [outstanding, setOutstanding] = useState(initial ? String(initial.outstanding) : '');
  const [interestRate, setInterestRate] = useState(initial ? String(initial.interestRate) : '');
  const [emi, setEmi] = useState(initial ? String(initial.emi) : '');
  const [tenureMonths, setTenureMonths] = useState(initial ? String(initial.tenureMonths) : '');
  const [date, setDate] = useState(initial?.date ?? todayISO());

  const submit = () => {
    const o = Number(outstanding);
    const r = Number(interestRate);
    const e = Number(emi);
    const t = Number(tenureMonths);
    if (!name.trim() || !o) return;
    const fields = { name: name.trim(), type, outstanding: o, interestRate: r, emi: e, tenureMonths: t, date };
    if (initial && onSave) { onSave(fields); }
    else { onAdd?.({ ...fields, status: 'active' }); setName(''); setOutstanding(''); setInterestRate(''); setEmi(''); setTenureMonths(''); setDate(todayISO()); onClose(); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={initial ? 'Edit Debt' : 'Add Debt'}>
      <Field label="Name">
        <Input value={name} onChangeText={setName} placeholder="e.g. Home Loan" />
      </Field>
      <Field label="Type">
        <View style={styles.chipRow}>
          {(['loan', 'creditcard', 'emi'] as DebtType[]).map((t) => (
            <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
          ))}
        </View>
      </Field>
      <Field label="Outstanding Balance">
        <Input value={outstanding} onChangeText={(t) => setOutstanding(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <View style={styles.twoCol}>
        <Field label="Interest %">
          <Input value={interestRate} onChangeText={(t) => setInterestRate(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
        </Field>
        <Field label="Tenure (mo)">
          <Input value={tenureMonths} onChangeText={(t) => setTenureMonths(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
        </Field>
      </View>
      <Field label="Monthly EMI">
        <Input value={emi} onChangeText={(t) => setEmi(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <Field label="Date">
        <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      </Field>
      <Button label={initial ? 'Save' : 'Add Debt'} onPress={submit} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

function InvestmentEditSheet({
  visible, onClose, investment, contributions, onSave, onUpdateContribution, onDeleteContribution,
}: {
  visible: boolean;
  onClose: () => void;
  investment: Investment;
  contributions: Contribution[];
  onSave: (i: Partial<Investment>) => void;
  onUpdateContribution: (id: string, c: Partial<Contribution>) => void;
  onDeleteContribution: (id: string) => void;
}) {
  const { palette, currency } = useUi();
  const [name, setName] = useState(investment.name);
  const [type, setType] = useState<InvestmentType>(investment.type);
  const [currentValue, setCurrentValue] = useState(String(investment.currentValue));
  const [purchaseValue, setPurchaseValue] = useState(String(investment.purchaseValue));
  const [purchaseDate, setPurchaseDate] = useState(investment.purchaseDate);

  const submit = () => {
    const cv = Number(currentValue);
    const pv = Number(purchaseValue);
    if (!name.trim() || !cv) return;
    onSave({ name: name.trim(), type, currentValue: cv, purchaseValue: pv, purchaseDate });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit Investment">
      <Field label="Name">
        <Input value={name} onChangeText={setName} placeholder="e.g. Nifty 50 Index Fund" />
      </Field>
      <Field label="Type">
        <View style={styles.chipRow}>
          {(['stocks', 'mutualfund', 'fd', 'ppf', 'crypto', 'other'] as InvestmentType[]).map((t) => (
            <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
          ))}
        </View>
      </Field>
      <Field label="Purchase Value">
        <Input value={purchaseValue} onChangeText={(t) => setPurchaseValue(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <Field label="Current Value">
        <Input value={currentValue} onChangeText={(t) => setCurrentValue(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <Field label="Purchase Date">
        <Input value={purchaseDate} onChangeText={setPurchaseDate} placeholder="YYYY-MM-DD" />
      </Field>
      <Button label="Save" onPress={submit} style={{ marginTop: 8 }} />

      {contributions.length > 0 && (
        <>
          <Text style={[styles.contribListTitle, { color: palette.textMuted }]}>Contributions</Text>
          {contributions.map((c) => (
            <ContribEditRow
              key={c.id}
              contribution={c}
              currency={currency}
              onUpdate={(patch) => onUpdateContribution(c.id, patch)}
              onDelete={() => onDeleteContribution(c.id)}
            />
          ))}
        </>
      )}
    </Sheet>
  );
}

function ContribEditRow({
  contribution, currency, onUpdate, onDelete,
}: {
  contribution: Contribution;
  currency: any;
  onUpdate: (patch: Partial<Contribution>) => void;
  onDelete: () => void;
}) {
  const { palette } = useUi();
  const [type, setType] = useState<ContributionType>(contribution.type);
  const [amount, setAmount] = useState(String(contribution.amount));
  const [freq, setFreq] = useState<ContributionFreq>(contribution.freq ?? 'monthly');
  const [startDate, setStartDate] = useState(contribution.startDate);
  const [expanded, setExpanded] = useState(false);

  const save = () => {
    const amt = Number(amount);
    if (!amt) return;
    onUpdate({ type, amount: amt, freq: type === 'recurring' ? freq : undefined, startDate });
    setExpanded(false);
  };

  return (
    <View style={[styles.contribCard, { borderColor: palette.border, backgroundColor: palette.surfaceAlt, marginBottom: 8 }]}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.nameRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>
            {contribution.type === 'onetime' ? 'Lumpsum' : `SIP · ${contribution.freq || 'monthly'}`}
          </Text>
          <Text style={{ fontSize: 11, color: palette.textMuted }}>
            {formatMoney(contribution.amount, currency)} · from {contribution.startDate}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>{expanded ? 'Cancel' : 'Edit'}</Text>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Trash2 size={15} color={palette.danger} />
        </Pressable>
      </Pressable>
      {expanded && (
        <View style={{ gap: 10, marginTop: 10 }}>
          <Field label="Type">
            <View style={styles.chipRow}>
              <Chip label="One-time / Lumpsum" selected={type === 'onetime'} onPress={() => setType('onetime')} />
              <Chip label="Recurring (SIP)" selected={type === 'recurring'} onPress={() => setType('recurring')} />
            </View>
          </Field>
          <Field label="Amount">
            <Input value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
          </Field>
          {type === 'recurring' && (
            <Field label="Frequency">
              <View style={styles.chipRow}>
                {(['weekly', 'monthly', 'quarterly'] as ContributionFreq[]).map((f) => (
                  <Chip key={f} label={f} selected={freq === f} onPress={() => setFreq(f)} />
                ))}
              </View>
            </Field>
          )}
          <Field label="Start Date">
            <Input value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
          </Field>
          <Button label="Update" onPress={save} />
        </View>
      )}
    </View>
  );
}

function AllocationTab() {
  const { data, palette, currency } = useUi();
  const { setAllocationTargets } = useStore();
  const [editing, setEditing] = useState(false);

  const actual = useMemo(() => actualAllocation(data.investments, data.assets), [data]);
  const age = data.settings.age;
  const band = age ? bandForAge(age) : null;
  const bandLabel = age ? bandLabelForAge(age) : null;
  const target: AllocationTarget | null = data.settings.allocationTargets || band;
  const drift = target ? allocationDrift(actual, target) : [];

  const keys: (keyof AllocationTarget)[] = ['stocks', 'mutualfund', 'fd', 'ppf', 'gold', 'crypto', 'other'];

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <SectionTitle title="Actual vs. Target" action={
          <Pressable onPress={() => setEditing((e) => !e)}>
            <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>{editing ? 'Done' : 'Edit Target'}</Text>
          </Pressable>
        } />
        <View style={styles.donutRow}>
          <View style={{ alignItems: 'center' }}>
            <DonutChart size={130} thickness={22} data={keys.map((k, i) => ({ label: k, value: actual[k as keyof typeof actual] || 0, color: palette.chart[i] })).filter((d) => d.value > 0)} />
            <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 6 }}>Actual</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <DonutChart size={130} thickness={22} data={keys.map((k, i) => ({ label: k, value: (target?.[k] as number) || 0, color: palette.chart[i] })).filter((d) => d.value > 0)} />
            <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 6 }}>Target {bandLabel ? `(${bandLabel})` : ''}</Text>
          </View>
        </View>
      </Card>

      {editing && target && (
        <Card>
          <SectionTitle title="Edit Target Allocation" />
          {keys.map((k) => (
            <Field key={k} label={k}>
              <Input
                defaultValue={String(Math.round((target![k] as number) * 100))}
                onChangeText={(t) => {
                  const v = Number(t.replace(/[^0-9]/g, '')) / 100;
                  setAllocationTargets({ ...target!, [k]: v, custom: true });
                }}
                keyboardType="numeric"
              />
            </Field>
          ))}
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>Values are percentages (0–100).</Text>
        </Card>
      )}

      {drift.length > 0 && (
        <Card>
          <SectionTitle title="Drift & Rebalancing" />
          {drift.map((d) => {
            const investTotal = totalInvestments(data.investments) + data.assets.filter((a) => a.status !== 'closed' && a.type === 'gold').reduce((s, a) => s + a.value, 0);
            const shiftAmt = d.drift * investTotal;
            return (
              <View key={d.type} style={styles.driftRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text, textTransform: 'capitalize' }}>{d.type}</Text>
                  <Text style={{ fontSize: 11, color: palette.textMuted }}>
                    {formatPercent(d.actual, 0)} actual vs {formatPercent(d.target, 0)} target
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: d.drift > 0 ? palette.warning : palette.success }}>
                    {d.drift > 0 ? '+' : ''}{formatPercent(d.drift, 0)}
                  </Text>
                  {Math.abs(shiftAmt) > 0 && (
                    <Text style={{ fontSize: 11, color: palette.textMuted }}>
                      {d.drift > 0 ? 'Sell' : 'Buy'} {formatMoney(Math.abs(shiftAmt), currency, { compact: true })}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {!age && (
        <EmptyState title="Set your age first" subtitle="Go to Settings to set your age, which determines your target allocation band." />
      )}
    </View>
  );
}

/** Shared contribution sheet for investments (and assets/debts). */
function ContributionSheet({
  visible,
  onClose,
  holdingId,
  holdingKind,
  holdingName,
  contributions,
  onAdd,
  onDelete,
  onSetStatus,
}: {
  visible: boolean;
  onClose: () => void;
  holdingId: string;
  holdingKind: 'investment' | 'asset' | 'debt';
  holdingName: string;
  contributions: Contribution[];
  onAdd: (c: Omit<Contribution, 'id'>) => void;
  onDelete: (id: string) => void;
  onSetStatus: (id: string, status: 'active' | 'paused' | 'closed', date?: string) => void;
}) {
  const { palette, currency } = useUi();
  const [type, setType] = useState<ContributionType>('onetime');
  const [amount, setAmount] = useState('');
  const [freq, setFreq] = useState<ContributionFreq>('monthly');
  const [startDate, setStartDate] = useState(todayISO());

  const submit = () => {
    const amt = Number(amount);
    if (!amt) return;
    onAdd({ holdingKind, holdingId, type, amount: amt, freq: type === 'recurring' ? freq : undefined, startDate, status: 'active' });
    setAmount(''); setType('onetime'); setFreq('monthly'); setStartDate(todayISO());
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Contributions — ${holdingName}`}>
      <Field label="Type">
        <View style={styles.chipRow}>
          <Chip label="One-time / Lumpsum" selected={type === 'onetime'} onPress={() => setType('onetime')} />
          <Chip label="Recurring (SIP)" selected={type === 'recurring'} onPress={() => setType('recurring')} />
        </View>
      </Field>
      <Field label="Amount">
        <Input value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      {type === 'recurring' && (
        <Field label="Frequency">
          <View style={styles.chipRow}>
            {(['weekly', 'monthly', 'quarterly'] as ContributionFreq[]).map((f) => (
              <Chip key={f} label={f} selected={freq === f} onPress={() => setFreq(f)} />
            ))}
          </View>
        </Field>
      )}
      <Field label="Start Date">
        <Input value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
      </Field>
      <Button label="Add Contribution" onPress={submit} style={{ marginTop: 8 }} />

      <Text style={[styles.contribListTitle, { color: palette.textMuted }]}>Existing Contributions</Text>
      {contributions.length === 0 ? (
        <Text style={{ fontSize: 12, color: palette.textMuted }}>None yet.</Text>
      ) : (
        contributions.map((c) => (
          <View key={c.id} style={[styles.contribRow, { borderBottomColor: palette.border }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>
                  {c.type === 'onetime' ? 'Lumpsum' : `SIP · ${c.freq || 'monthly'}`}
                </Text>
                <StatusBadge status={c.status} />
              </View>
              <Text style={{ fontSize: 11, color: palette.textMuted }}>
                {formatMoney(c.amount, currency)} · from {c.startDate}
              </Text>
              <LifecycleActions
                status={c.status}
                onPause={() => onSetStatus(c.id, 'paused')}
                onResume={() => onSetStatus(c.id, 'active')}
                onClose={() => onSetStatus(c.id, 'closed')}
                onReopen={() => onSetStatus(c.id, 'active')}
              />
            </View>
            <Pressable onPress={() => onDelete(c.id)} hitSlop={8}>
              <Trash2 size={16} color={palette.danger} />
            </Pressable>
          </View>
        ))
      )}
    </Sheet>
  );
}

function assetTypeIndex(t: AssetType): number {
  return { cash: 0, bank: 1, realestate: 2, gold: 3, other: 4 }[t] ?? 0;
}
function invTypeIndex(t: InvestmentType): number {
  return { stocks: 0, mutualfund: 1, fd: 2, ppf: 3, crypto: 4, other: 5 }[t] ?? 0;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  screenTitle: { fontSize: 24, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupHeader: { fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  totalCard: { padding: 20 },
  totalLabel: { fontSize: 13, fontWeight: '600' },
  totalValue: { fontSize: 30, fontWeight: '800', marginTop: 4 },
  totalSub: { flexDirection: 'row', gap: 16, marginTop: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 10 },
  typeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  contribBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  twoCol: { flexDirection: 'row', gap: 12 },
  donutRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 12 },
  driftRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  strategyRow: { flexDirection: 'row', gap: 12 },
  contribListTitle: { fontSize: 13, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  contribRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  contribCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  stepIndicator: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  stepDotWrap: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNavRow: { flexDirection: 'row', marginTop: 8 },
});
