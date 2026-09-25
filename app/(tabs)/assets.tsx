import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, SectionTitle, useUi, Chip, Button, Input, Field, EmptyState, StatusBadge, LifecycleActions } from '@/components/ui';
import { DonutChart, ProgressBar } from '@/components/charts';
import { Sheet } from '@/components/Sheet';
import { ConfirmDeleteSheet } from '@/components/ConfirmDeleteSheet';
import { useStore } from '@/lib/store';
import {
  totalAssets,
  totalInvestments,
  totalDebt,
  monthlyDebtPayments,
  netWorth,
  withLiveData,
  actualAllocation,
  bandForAge,
  bandLabelForAge,
  allocationDrift,
  debtPayoffMonths,
  totalContributed,
  investmentXirr,
  monthlyContribution,
  allocationTargetEntries,
  ALLOCATION_LABELS,
} from '@/lib/calc';
import { formatMoney, formatPercent, isValidIsoDate, todayISO } from '@/lib/format';
import { Trash2, Pencil } from 'lucide-react-native';
import type { Asset, AssetType, Investment, InvestmentType, Debt, DebtType, AllocationTarget, Contribution, ContributionType, ContributionFreq, AllocationKey } from '@/lib/types';

type Tab = 'assets' | 'investments' | 'debts' | 'allocation';

export default function AssetsScreen() {
  const { palette } = useUi();
  const [tab, setTab] = useState<Tab>('assets');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: palette.bg }]}>
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
  const { addAsset, updateAsset, deleteAsset } = useStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const liveData = useMemo(() => withLiveData(data, todayISO()), [data]);
  const assetsTotal = totalAssets(liveData.assets);
  const investTotal = totalInvestments(liveData.investments);
  const debtTotal = totalDebt(liveData.debts);
  const nw = netWorth(liveData);
  const liquid = liveData.assets.filter((a) => a.liquid).reduce((s, a) => s + a.value, 0);
  const monthlyDebt = monthlyDebtPayments(liveData.debts);

  const donutData = [
    { label: 'Assets', value: assetsTotal, color: palette.chart[1] },
    { label: 'Investments', value: investTotal, color: palette.chart[0] },
    { label: 'Debts', value: debtTotal, color: palette.danger },
  ].filter((d) => d.value > 0);

  const sortedAssets = useMemo(() => [...liveData.assets].sort((a, b) => b.date.localeCompare(a.date)), [liveData.assets]);

  return (
    <View style={{ gap: 14 }}>
      <Card style={styles.totalCard}>
        <Text style={[styles.totalLabel, { color: palette.textMuted }]}>Net Worth (Assets + Investments − Debts)</Text>
        <Text style={[styles.totalValue, { color: nw >= 0 ? palette.text : palette.danger }]}>{formatMoney(nw, currency)}</Text>
        <View style={styles.totalSub}>
          <Text style={{ fontSize: 12, color: palette.textMuted }}>Assets: {formatMoney(assetsTotal, currency, { compact: true })}</Text>
          <Text style={{ fontSize: 12, color: palette.chart[0] }}>Invested: {formatMoney(investTotal, currency, { compact: true })}</Text>
          <Text style={{ fontSize: 12, color: palette.danger }}>Debt: {formatMoney(debtTotal, currency, { compact: true })}</Text>
        </View>
        <View style={[styles.totalSub, { marginTop: 4 }]}>
          <Text style={{ fontSize: 12, color: palette.textMuted }}>Liquid: {formatMoney(liquid, currency, { compact: true })}</Text>
          <Text style={{ fontSize: 12, color: palette.textMuted }}>Monthly EMI: {formatMoney(monthlyDebt, currency, { compact: true })}</Text>
        </View>
      </Card>

      {donutData.length > 0 && (
        <Card>
          <SectionTitle title="Wealth Breakdown" />
          <View style={styles.donutRow}>
            <DonutChart size={140} thickness={26} data={donutData} />
            <View style={{ justifyContent: 'center', gap: 10 }}>
              {donutData.map((d) => (
                <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color }} />
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: palette.text }}>{d.label}</Text>
                    <Text style={{ fontSize: 11, color: palette.textMuted }}>{formatMoney(d.value, currency, { compact: true })}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={[styles.totalSub, { marginTop: 12, justifyContent: 'space-between' }]}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: palette.textMuted }}>Monthly EMI</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: palette.danger }}>{formatMoney(monthlyDebt, currency, { compact: true })}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: palette.textMuted }}>Annual EMI</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: palette.danger }}>{formatMoney(monthlyDebt * 12, currency, { compact: true })}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: palette.textMuted }}>Net Worth</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: nw >= 0 ? palette.success : palette.danger }}>{formatMoney(nw, currency, { compact: true })}</Text>
            </View>
          </View>
        </Card>
      )}

      <Card>
        <SectionTitle title="Asset List" action={
          <Pressable onPress={() => setSheetOpen(true)}>
            <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>+ Add</Text>
          </Pressable>
        } />
        {data.assets.length === 0 ? (
          <EmptyState title="No assets yet" subtitle="Add cash, bank balances, real estate, gold, and more." />
        ) : (
          sortedAssets.map((a) => (
            <View key={a.id} style={styles.itemRow}>
              <View style={[styles.typeDot, { backgroundColor: palette.chart[assetTypeIndex(a.type)] }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>{a.name}</Text>
                </View>
                <Text style={{ fontSize: 11, color: palette.textMuted }}>{a.type} · {a.liquid ? 'Liquid' : 'Illiquid'}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{formatMoney(a.value, currency, { compact: true })}</Text>
              <Pressable onPress={() => setEditingAsset(a)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit">
                <Pencil size={16} color={palette.primary} />
              </Pressable>
              <Pressable onPress={() => setPendingDelete(a)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete">
                <Trash2 size={16} color={palette.danger} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      {pendingDelete && (
        <ConfirmDeleteSheet
          name={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { deleteAsset(pendingDelete.id); setPendingDelete(null); }}
        />
      )}

      <AssetSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={addAsset}
      />
      {editingAsset && (
        <AssetSheet
          key={editingAsset.id}
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
  const { palette } = useUi();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<AssetType>(initial?.type ?? 'cash');
  const [value, setValue] = useState(initial ? String(initial.value) : '');
  const [liquid, setLiquid] = useState(initial?.liquid ?? true);
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const v = Number(value);
    if (!name.trim() || !v) { setError('Enter an asset name and a value greater than zero.'); return; }
    if (!isValidIsoDate(date)) { setError('Use a valid date in YYYY-MM-DD format.'); return; }
    setError(null);
    const fields = { name: name.trim(), type, value: v, liquid: type === 'cash' || type === 'bank' ? true : liquid, date };
    if (initial && onSave) {
      onSave(fields);
    } else {
      onAdd?.(fields);
      setName(''); setValue(''); setLiquid(true); setDate(todayISO());
      onClose();
    }
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
      <Field money label="Value">
        <Input value={value} onChangeText={(t) => setValue(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <Field label="Date">
        <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      </Field>
      {error && <Text style={{ fontSize: 13, color: palette.danger }}>{error}</Text>}
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
  const { addInvestment, addInvestmentWithContribution, updateInvestment, updateContribution, deleteInvestment, setInvestmentStatus } = useStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [managingContribs, setManagingContribs] = useState<Investment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Investment | null>(null);
  const today = todayISO();
  // Values include contributions made since the value was last entered; editing starts from these live values.
  const liveInvestments = useMemo(() => withLiveData(data, today).investments, [data, today]);
  const total = totalInvestments(liveInvestments);
  const contributedTotal = liveInvestments
    .filter((i) => i.status !== 'closed')
    .reduce((sum, inv) => {
      const c = totalContributed(data.contributions, inv.id, today);
      return sum + (c > 0 ? c : inv.purchaseValue);
    }, 0);
  const gain = contributedTotal > 0 ? total - contributedTotal : 0;

  const sortedInvestments = useMemo(() => [...liveInvestments].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate)), [liveInvestments]);

  return (
    <View style={{ gap: 14 }}>
      <Card style={styles.totalCard}>
        <Text style={[styles.totalLabel, { color: palette.textMuted }]}>Total Investments</Text>
        <Text style={[styles.totalValue, { color: palette.text }]}>{formatMoney(total, currency)}</Text>
        <Text style={{ fontSize: 12, color: gain >= 0 ? palette.success : palette.danger, marginTop: 4 }}>
          {gain >= 0 ? '+' : ''}{formatMoney(gain, currency, { compact: true })} ({formatPercent(contributedTotal > 0 ? gain / contributedTotal : 0)})
        </Text>
      </Card>

      <Card>
        <SectionTitle title="Holdings" action={
          <Pressable onPress={() => setSheetOpen(true)}>
            <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>+ Add</Text>
          </Pressable>
        } />
        {data.investments.length === 0 ? (
          <EmptyState title="No investments yet" subtitle="Track stocks, mutual funds, FDs, PPF, crypto, and more." />
        ) : (
          sortedInvestments.map((inv) => {
            const contributed = totalContributed(data.contributions, inv.id, today);
            const costBasis = contributed > 0 ? contributed : inv.purchaseValue;
            const gain = inv.currentValue - costBasis;
            // Money-weighted annual return (XIRR) handles SIPs and multiple contributions; for a single lump sum it equals CAGR.
            const cagrValue = investmentXirr(data.contributions, inv.id, inv.purchaseValue, inv.purchaseDate, inv.currentValue, today);
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
                    {inv.type}{cagrValue !== null ? ` · XIRR ${formatPercent(cagrValue)}` : ' · XIRR N/A'}{monthly > 0 ? ` · ${formatMoney(monthly, currency, { compact: true })}/mo SIP` : ''}
                  </Text>
                  <LifecycleActions
                    status={inv.status}
                    onPause={() => setInvestmentStatus(inv.id, 'paused')}
                    onResume={() => setInvestmentStatus(inv.id, 'active')}
                    onClose={() => setInvestmentStatus(inv.id, 'closed')}
                    onReopen={() => setInvestmentStatus(inv.id, 'active')}
                  />
                <Pressable onPress={() => setManagingContribs(inv)} hitSlop={6} accessibilityRole="button">
                  <Text style={{ fontSize: 11, color: palette.primary, fontWeight: '600', marginTop: 6 }}>SIPs & top-ups</Text>
                </Pressable>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{formatMoney(inv.currentValue, currency, { compact: true })}</Text>
                  <Text style={{ fontSize: 11, color: gain >= 0 ? palette.success : palette.danger }}>
                    {gain >= 0 ? '+' : '-'}{formatMoney(Math.abs(gain), currency, { compact: true })}
                  </Text>
                </View>
                <Pressable onPress={() => setEditingInvestment(inv)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit">
                  <Pencil size={16} color={palette.primary} />
                </Pressable>
                <Pressable onPress={() => setPendingDelete(inv)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete">
                  <Trash2 size={16} color={palette.danger} />
                </Pressable>
              </View>
            );
          })
        )}
      </Card>

      {managingContribs && (
        <ContributionsSheet investment={managingContribs} onClose={() => setManagingContribs(null)} />
      )}

      {editingInvestment && (
        <InvestmentEditSheet
          key={editingInvestment.id}
          visible={!!editingInvestment}
          onClose={() => setEditingInvestment(null)}
          investment={editingInvestment}
          onSave={(fields) => {
            const nextFields = {
              ...fields,
              purchaseValue: fields.purchaseValue ?? editingInvestment.purchaseValue,
              currentValue: fields.currentValue ?? editingInvestment.currentValue,
              purchaseDate: fields.purchaseDate ?? editingInvestment.purchaseDate,
            };
            updateInvestment(editingInvestment.id, nextFields);

            // Purchase value/date describe the first funding entry only. Sync just the fields that
            // changed, so unrelated edits (rename, current value) never touch SIP amounts or dates.
            const valueChanged = nextFields.purchaseValue !== editingInvestment.purchaseValue;
            const dateChanged = nextFields.purchaseDate !== editingInvestment.purchaseDate;
            if (valueChanged || dateChanged) {
              const first = data.contributions
                .filter((c) => c.holdingId === editingInvestment.id && c.holdingKind === 'investment')
                .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
              if (first) {
                updateContribution(first.id, {
                  ...(valueChanged ? { amount: nextFields.purchaseValue } : {}),
                  ...(dateChanged ? { startDate: nextFields.purchaseDate } : {}),
                });
              }
            }
            setEditingInvestment(null);
          }}
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

      {pendingDelete && (
        <ConfirmDeleteSheet
          name={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { deleteInvestment(pendingDelete.id); setPendingDelete(null); }}
        />
      )}
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
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep(0); setName(''); setType('stocks'); setContribType('onetime');
    setAmount(''); setFreq('monthly'); setStartDate(todayISO()); setError(null);
  };

  const close = () => { reset(); onClose(); };

  const next = () => {
    if (step === 0 && !name.trim()) { setError('Please enter a name.'); return; }
    if (step === 1 && !Number(amount)) { setError('Please enter an amount.'); return; }
    if (step === 1 && !isValidIsoDate(startDate)) { setError('Use a valid date in YYYY-MM-DD format.'); return; }
    setError(null);
    if (step === 1) submit();
    else setStep((s) => s + 1);
  };

  const submit = () => {
    const amt = Number(amount);
    const inv: Omit<Investment, 'id'> = {
      name: name.trim(),
      type,
      purchaseValue: amt,
      currentValue: amt,
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

  const stepLabels = ['Basic Info', 'Funding'];

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
          <Field money label={contribType === 'onetime' ? 'Amount' : 'SIP Amount'}>
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
            <Button label="Add Investment" onPress={next} />
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
  const [pendingDelete, setPendingDelete] = useState<Debt | null>(null);
  // Balances reflect EMIs paid since each debt's date; editing still uses the stored debt.
  const liveDebts = useMemo(() => withLiveData(data, todayISO()).debts, [data]);
  const total = totalDebt(liveDebts);
  const monthly = monthlyDebtPayments(liveDebts);

  const sortedDebts = useMemo(() => [...liveDebts].sort((a, b) => b.date.localeCompare(a.date)), [liveDebts]);

  const setDebtLifecycle = (debt: Debt, status: Debt['status']) => {
    setDebtStatus(debt.id, status);
  };

  return (
    <View style={{ gap: 14 }}>
      <Card style={styles.totalCard}>
        <Text style={[styles.totalLabel, { color: palette.textMuted }]}>Total Debt</Text>
        <Text style={[styles.totalValue, { color: palette.text }]}>{formatMoney(total, currency)}</Text>
        <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 4 }}>Monthly payments: {formatMoney(monthly, currency, { compact: true })}</Text>
      </Card>

      <Card>
        <SectionTitle title="Debts" action={
          <Pressable onPress={() => setSheetOpen(true)}>
            <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>+ Add</Text>
          </Pressable>
        } />
        {data.debts.length === 0 ? (
          <EmptyState title="No debts tracked" subtitle="Add loans, credit cards, and EMIs to see payoff timelines." />
        ) : (
          sortedDebts.map((d) => {
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
                    onPause={() => setDebtLifecycle(d, 'paused')}
                    onResume={() => setDebtLifecycle(d, 'active')}
                    onClose={() => setDebtLifecycle(d, 'closed')}
                    onReopen={() => setDebtLifecycle(d, 'active')}
                  />
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{formatMoney(d.outstanding, currency, { compact: true })}</Text>
                  <Text style={{ fontSize: 11, color: palette.textMuted }}>EMI {formatMoney(d.emi, currency, { compact: true })}</Text>
                </View>
                <Pressable onPress={() => setEditingDebt(data.debts.find((x) => x.id === d.id) ?? d)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit">
                  <Pencil size={16} color={palette.primary} />
                </Pressable>
                <Pressable onPress={() => setPendingDelete(d)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete">
                  <Trash2 size={16} color={palette.danger} />
                </Pressable>
              </View>
            );
          })
        )}
      </Card>

      <DebtSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={addDebt}
      />
      {editingDebt && (
        <DebtSheet
          key={editingDebt.id}
          visible={!!editingDebt}
          onClose={() => setEditingDebt(null)}
          initial={editingDebt}
          onSave={(fields) => {
            updateDebt(editingDebt.id, { ...fields, status: editingDebt.status });
            setEditingDebt(null);
          }}
        />
      )}
      {pendingDelete && (
        <ConfirmDeleteSheet
          name={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { deleteDebt(pendingDelete.id); setPendingDelete(null); }}
        />
      )}
    </View>
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
  const { palette } = useUi();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<DebtType>(initial?.type ?? 'loan');
  const [outstanding, setOutstanding] = useState(initial ? String(initial.outstanding) : '');
  const [interestRate, setInterestRate] = useState(initial ? String(initial.interestRate) : '');
  const [emi, setEmi] = useState(initial ? String(initial.emi) : '');
  const [tenureMonths, setTenureMonths] = useState(initial ? String(initial.tenureMonths) : '');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const o = Number(outstanding);
    const r = Number(interestRate);
    const e = Number(emi);
    const t = Number(tenureMonths);
    if (!name.trim() || !o || r < 0 || e < 0 || t < 0) { setError('Enter a name, outstanding balance, and valid non-negative values.'); return; }
    if (!isValidIsoDate(date)) { setError('Use a valid date in YYYY-MM-DD format.'); return; }
    setError(null);
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
      <Field money label="Outstanding Balance">
        <Input value={outstanding} onChangeText={(t) => setOutstanding(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <View style={styles.twoCol}>
        <Field half label="Interest %">
          <Input value={interestRate} onChangeText={(t) => setInterestRate(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
        </Field>
        <Field half label="Tenure (mo)">
          <Input value={tenureMonths} onChangeText={(t) => setTenureMonths(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
        </Field>
      </View>
      <Field money label="Monthly EMI">
        <Input value={emi} onChangeText={(t) => setEmi(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <Field label="Date">
        <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      </Field>
      {error && <Text style={{ fontSize: 13, color: palette.danger }}>{error}</Text>}
      <Button label={initial ? 'Save' : 'Add Debt'} onPress={submit} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

function ContributionsSheet({ investment, onClose }: { investment: Investment; onClose: () => void }) {
  const { data, palette, currency } = useUi();
  const { addContribution, updateContribution, deleteContribution, setContributionStatus, updateInvestment } = useStore();
  const items = useMemo(
    () => data.contributions
      .filter((c) => c.holdingKind === 'investment' && c.holdingId === investment.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [data.contributions, investment.id],
  );
  const [editing, setEditing] = useState<Contribution | 'new' | null>(null);
  const [type, setType] = useState<ContributionType>('recurring');
  const [amount, setAmount] = useState('');
  const [freq, setFreq] = useState<ContributionFreq>('monthly');
  const [startDate, setStartDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Contribution | null>(null);

  const openForm = (c?: Contribution) => {
    setEditing(c ?? 'new');
    setType(c?.type ?? 'recurring');
    setAmount(c ? String(c.amount) : '');
    setFreq(c?.freq ?? 'monthly');
    setStartDate(c?.startDate ?? todayISO());
    setError(null);
  };

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (!isValidIsoDate(startDate)) { setError('Use a valid date in YYYY-MM-DD format.'); return; }
    const fields = { type, amount: amt, freq: type === 'recurring' ? freq : undefined, startDate };
    if (editing && editing !== 'new') {
      updateContribution(editing.id, fields);
      // The earliest entry is the purchase itself, so keep the investment's purchase details in step with it.
      const earliest = [...items].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      if (earliest?.id === editing.id) updateInvestment(investment.id, { purchaseValue: amt, purchaseDate: startDate });
    } else {
      addContribution({ holdingKind: 'investment', holdingId: investment.id, status: 'active', ...fields });
    }
    setEditing(null);
  };

  return (
    <Sheet visible onClose={onClose} title={`${investment.name} — SIPs & top-ups`}>
      {items.length === 0 && editing === null && (
        <Text style={{ fontSize: 12, color: palette.textMuted }}>No contributions recorded yet.</Text>
      )}

      {editing === null && items.map((c) => (
        <View key={c.id} style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>
                {formatMoney(c.amount, currency)}{c.type === 'recurring' ? ` ${c.freq ?? 'monthly'}` : ''}
              </Text>
              {c.type === 'recurring' && <StatusBadge status={c.status} />}
            </View>
            <Text style={{ fontSize: 11, color: palette.textMuted }}>
              {c.type === 'recurring' ? `SIP from ${c.startDate}` : `One-time on ${c.startDate}`}
            </Text>
            {c.type === 'recurring' && (
              <LifecycleActions
                status={c.status}
                onPause={() => setContributionStatus(c.id, 'paused')}
                onResume={() => setContributionStatus(c.id, 'active')}
                onClose={() => setContributionStatus(c.id, 'closed')}
                onReopen={() => setContributionStatus(c.id, 'active')}
              />
            )}
          </View>
          <Pressable onPress={() => openForm(c)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit">
            <Pencil size={16} color={palette.primary} />
          </Pressable>
          <Pressable onPress={() => setPendingDelete(c)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete">
            <Trash2 size={16} color={palette.danger} />
          </Pressable>
        </View>
      ))}

      {pendingDelete && editing === null && (
        <View style={{ borderWidth: 1, borderColor: palette.danger + '44', backgroundColor: palette.danger + '11', borderRadius: 12, padding: 12, marginTop: 8 }}>
          <Text style={{ fontSize: 13, color: palette.danger, fontWeight: '600', marginBottom: 8 }}>
            Delete this {pendingDelete.type === 'recurring' ? 'SIP' : 'contribution'}?
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Cancel" variant="outline" onPress={() => setPendingDelete(null)} style={{ flex: 1 }} />
            <Button label="Delete" variant="danger" onPress={() => { deleteContribution(pendingDelete.id); setPendingDelete(null); }} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {editing !== null ? (
        <View style={{ gap: 12 }}>
          <Field label="Type">
            <View style={styles.chipRow}>
              <Chip label="One-time top-up" selected={type === 'onetime'} onPress={() => setType('onetime')} />
              <Chip label="Recurring (SIP)" selected={type === 'recurring'} onPress={() => setType('recurring')} />
            </View>
          </Field>
          <Field money label="Amount">
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
          <Field label={type === 'recurring' ? 'Start Date' : 'Date'}>
            <Input value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
          </Field>
          <Text style={{ fontSize: 11, color: palette.textMuted }}>
            Payments dated after {investment.valueUpdatedDate ?? 'the last value update'} are added to the current value; earlier ones are assumed to be in it already.
          </Text>
          {error && <Text style={{ fontSize: 13, color: palette.danger }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Cancel" variant="outline" onPress={() => setEditing(null)} style={{ flex: 1 }} />
            <Button label={editing === 'new' ? 'Add' : 'Save'} onPress={submit} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button label="+ Add SIP or top-up" onPress={() => openForm()} style={{ marginTop: 8 }} />
      )}
    </Sheet>
  );
}

function InvestmentEditSheet({
  visible, onClose, investment, onSave,
}: {
  visible: boolean;
  onClose: () => void;
  investment: Investment;
  onSave: (i: Partial<Investment>) => void;
}) {
  const { palette } = useUi();
  const [name, setName] = useState(investment.name);
  const [type, setType] = useState<InvestmentType>(investment.type);
  const [currentValue, setCurrentValue] = useState(String(investment.currentValue));
  const [purchaseValue, setPurchaseValue] = useState(String(investment.purchaseValue));
  const [purchaseDate, setPurchaseDate] = useState(investment.purchaseDate);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const cv = Number(currentValue);
    const pv = Number(purchaseValue);
    if (!name.trim() || cv <= 0 || pv <= 0) { setError('Enter a name and values greater than zero.'); return; }
    if (!isValidIsoDate(purchaseDate)) { setError('Use a valid date in YYYY-MM-DD format.'); return; }
    setError(null);
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
      <Field money label="Purchase Value">
        <Input value={purchaseValue} onChangeText={(t) => setPurchaseValue(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <Field money label="Current Value">
        <Input value={currentValue} onChangeText={(t) => setCurrentValue(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <Field label="Purchase Date">
        <Input value={purchaseDate} onChangeText={setPurchaseDate} placeholder="YYYY-MM-DD" />
      </Field>
      {error && <Text style={{ fontSize: 13, color: palette.danger }}>{error}</Text>}
      <Button label="Save" onPress={submit} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

/** Percent field keeping its own text, so it can be cleared and accepts decimals (value is a 0..1 fraction). */
function PercentInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(value ? String(Math.round(value * 10000) / 100) : '');
  return (
    <Input
      value={text}
      onChangeText={(t) => {
        const cleaned = t.replace(/[^0-9.]/g, '');
        setText(cleaned);
        onChange(Math.max(0, Math.min(100, Number(cleaned) || 0)) / 100);
      }}
      keyboardType="numeric"
      placeholder="0"
    />
  );
}

function AllocationTab() {
  const { data, palette, currency } = useUi();
  const { setAllocationTargets } = useStore();
  const [editing, setEditing] = useState(false);
  const [draftEntries, setDraftEntries] = useState<Array<{ id: string; key?: AllocationKey; name: string; value: number }>>([]);

  const liveData = useMemo(() => withLiveData(data, todayISO()), [data]);
  const actual = useMemo(() => actualAllocation(liveData.investments, liveData.assets), [liveData]);
  const age = data.settings.age;
  const band = age ? bandForAge(age) : null;
  const bandLabel = age ? bandLabelForAge(age) : null;
  const target: AllocationTarget | null = data.settings.allocationTargets || band;
  const targetEntries = useMemo(() => allocationTargetEntries(target), [target]);
  const drift = target ? allocationDrift(actual, target) : [];
  const targetDonutData = targetEntries
    .filter((entry) => entry.value > 0)
    .map((entry, index) => ({ label: entry.name, value: entry.value, color: palette.chart[index % palette.chart.length] }));
  const draftTotal = draftEntries.reduce((sum, entry) => sum + entry.value, 0);

  const startEditing = () => {
    setDraftEntries(allocationTargetEntries(target).map((entry) => ({ ...entry })));
    setEditing(true);
  };

  const addEntry = () => {
    setDraftEntries((current) => [
      ...current,
      {
        id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: `Custom ${current.filter((entry) => !entry.key).length + 1}`,
        value: 0,
      },
    ]);
  };

  const updateDraftEntry = (id: string, updates: Partial<{ name: string; value: number }>) => {
    setDraftEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)));
  };

  const removeDraftEntry = (id: string) => {
    setDraftEntries((current) => current.map((entry) =>
      entry.id === id
        ? { ...entry, value: 0 }
        : entry,
    ));
  };

  const saveTarget = () => {
    if (Math.abs(draftTotal - 1) > 0.001) return;

    const base: AllocationTarget = {
      ...(target ?? { stocks: 0, mutualfund: 0, fd: 0, ppf: 0, gold: 0, crypto: 0, other: 0, custom: true }),
      custom: true,
      customTargets: [],
    };

    for (const entry of draftEntries) {
      if (entry.key) {
        const numericKey: AllocationKey = entry.key;
        base[numericKey] = entry.value;
      } else if (entry.value > 0) {
        base.customTargets = [
          ...(base.customTargets ?? []),
          { id: entry.id, name: entry.name.trim() || 'Custom Target', value: entry.value },
        ];
      }
    }

    setAllocationTargets(base);
    setEditing(false);
  };

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <SectionTitle title="Actual vs. Target" action={
          <Pressable onPress={editing ? () => setEditing(false) : startEditing}>
            <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>{editing ? 'Cancel' : 'Edit Target'}</Text>
          </Pressable>
        } />
        <View style={styles.donutRow}>
          <View style={{ alignItems: 'center' }}>
            <DonutChart size={130} thickness={22} data={['stocks', 'mutualfund', 'fd', 'ppf', 'gold', 'crypto', 'other'].map((k, i) => ({ label: k, value: actual[k as keyof typeof actual] || 0, color: palette.chart[i] })).filter((d) => d.value > 0)} />
            <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 6 }}>Actual</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <DonutChart size={130} thickness={22} data={targetDonutData.filter((d) => d.value > 0)} />
            <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 6 }}>Target {bandLabel ? `(${bandLabel})` : ''}</Text>
          </View>
        </View>
        {age && data.settings.allocationTargets?.custom && !editing && (
          <Button label={`Reset to age-based target (${bandLabel})`} variant="outline" onPress={() => setAllocationTargets(bandForAge(age))} style={{ marginTop: 12 }} />
        )}
      </Card>

      {editing && (
        <Card>
          <SectionTitle title="Edit Target Allocation" action={
            <Pressable onPress={addEntry}>
              <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>+ Add</Text>
            </Pressable>
          } />
          {draftEntries.map((entry) => (
            <View key={entry.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.text }}>{entry.key ? entry.name : 'Custom Target'}</Text>
                <Pressable onPress={() => removeDraftEntry(entry.id)}>
                  <Text style={{ fontSize: 11, color: palette.danger, fontWeight: '600' }}>Delete</Text>
                </Pressable>
              </View>
              {!entry.key && (
                <Field label="Name">
                  <Input
                    value={entry.name}
                    onChangeText={(text) => updateDraftEntry(entry.id, { name: text })}
                    placeholder="e.g. REIT"
                  />
                </Field>
              )}
              <Field label="Percent (%)">
                <PercentInput value={entry.value} onChange={(value) => updateDraftEntry(entry.id, { value })} />
              </Field>
            </View>
          ))}
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>Values are percentages (0–100). The total must equal 100% before saving.</Text>
          <Text style={{ fontSize: 11, color: Math.abs(draftTotal - 1) < 0.001 ? palette.success : palette.danger, marginTop: 4 }}>
            Total: {formatPercent(draftTotal, 0)} {Math.abs(draftTotal - 1) < 0.001 ? 'ready to save' : 'must equal 100%'}
          </Text>
          <Button label="Save Target" onPress={saveTarget} disabled={Math.abs(draftTotal - 1) > 0.001} style={{ marginTop: 12 }} />
        </Card>
      )}

      {drift.length > 0 && (
        <Card>
          <SectionTitle title="Drift & Rebalancing" />
          {(target?.customTargets?.length ?? 0) > 0 && (
            <Text style={{ fontSize: 11, color: palette.textMuted, marginBottom: 8 }}>
              Custom targets can't be matched to holdings, so drift compares your built-in targets rescaled to 100%.
            </Text>
          )}
          {drift.map((d) => {
            const investTotal = totalInvestments(liveData.investments) + liveData.assets.filter((a) => a.type === 'gold').reduce((s, a) => s + a.value, 0);
            const shiftAmt = d.drift * investTotal;
            return (
              <View key={d.type} style={styles.driftRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{ALLOCATION_LABELS[d.type]}</Text>
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
  totalCard: { padding: 20 },
  totalLabel: { fontSize: 13, fontWeight: '600' },
  totalValue: { fontSize: 30, fontWeight: '800', marginTop: 4 },
  totalSub: { flexDirection: 'row', gap: 16, marginTop: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 10 },
  typeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  twoCol: { flexDirection: 'row', gap: 12 },
  donutRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 12 },
  driftRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  stepIndicator: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  stepDotWrap: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNavRow: { flexDirection: 'row', marginTop: 8 },
});
