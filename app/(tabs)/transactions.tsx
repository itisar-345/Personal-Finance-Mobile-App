import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Pressable } from 'react-native';
import { Card, SectionTitle, useUi, Chip, Button, Input, Field, EmptyState, StatusBadge, LifecycleActions } from '@/components/ui';
import { DonutChart } from '@/components/charts';
import { Sheet } from '@/components/Sheet';
import { useStore } from '@/lib/store';
import { computeTotals, monthKey, yearKey, inPeriod, groupByPeriod } from '@/lib/calc';
import { formatMoney, todayISO, monthLabel } from '@/lib/format';
import { Plus, Repeat, Trash2, X, Pencil } from 'lucide-react-native';
import type { Transaction, TxnType, RecurringType, Category } from '@/lib/types';

type Filter = TxnType | 'all';
type Period = 'monthly' | 'annual';

export default function TransactionsScreen() {
  const { data, palette, currency } = useUi();
  const { addTransaction, updateTransaction, deleteTransaction, setTransactionStatus } = useStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [period, setPeriod] = useState<Period>('monthly');
  const today = todayISO();

  const totals = useMemo(() => computeTotals(data.transactions, data.categories, period, today), [data, period, today]);

  const periodTxns = useMemo(
    () => data.transactions.filter((t) => inPeriod(t.date, period, today)).sort((a, b) => b.date.localeCompare(a.date)),
    [data, today, period],
  );
  const shown = filter === 'all' ? periodTxns : periodTxns.filter((t) => t.type === filter);

  const grouped = useMemo(() => groupByPeriod(shown, period), [shown, period]);

  const recurring = useMemo(
    () => data.transactions.filter((t) => t.recurring !== 'none' && (filter === 'all' || t.type === filter)),
    [data, filter],
  );
  const activeRecurring = recurring.filter((t) => t.status !== 'closed');

  const catMap = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data]);

  const breakdown = useMemo(() => {
    const txns = filter === 'all' ? periodTxns : periodTxns.filter((t) => t.type === filter);
    return Object.entries(
      txns.reduce<Record<string, number>>((acc, t) => {
        const key = filter === 'all' ? t.type : t.categoryId;
        acc[key] = (acc[key] || 0) + t.amount;
        return acc;
      }, {})
    )
      .map(([key, amount]) => ({
        id: key,
        name: filter === 'all' ? (key === 'income' ? 'Income' : 'Expense') : (catMap.get(key)?.name || 'Unknown'),
        amount,
        color: filter === 'all' ? (key === 'income' ? palette.success : palette.danger) : undefined,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodTxns, filter, catMap, palette]);

  const showIncomeCard = filter === 'all' || filter === 'income';
  const showExpenseCard = filter === 'all' || filter === 'expense';
  const showSavingsCard = filter === 'all';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Transactions</Text>
        <Pressable style={[styles.fab, { backgroundColor: palette.primary }]} onPress={() => setSheetOpen(true)}>
          <Plus size={22} color={palette.primaryText} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.summaryRow}>
          {showIncomeCard && (
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Income ({period === 'monthly' ? 'mo' : 'yr'})</Text>
              <Text style={[styles.summaryValue, { color: palette.success }]}>{formatMoney(totals.income, currency, { compact: true })}</Text>
            </Card>
          )}
          {showExpenseCard && (
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Expenses ({period === 'monthly' ? 'mo' : 'yr'})</Text>
              <Text style={[styles.summaryValue, { color: palette.danger }]}>{formatMoney(totals.expenses, currency, { compact: true })}</Text>
            </Card>
          )}
          {showSavingsCard && (
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Saved</Text>
              <Text style={[styles.summaryValue, { color: palette.primary }]}>{formatMoney(totals.savings, currency, { compact: true })}</Text>
            </Card>
          )}
          {(filter === 'income' || filter === 'expense') && (
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Transactions</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>{shown.length}</Text>
            </Card>
          )}
        </View>

        {/* Filters */}
        <View style={styles.filterRow}>
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Income" selected={filter === 'income'} onPress={() => setFilter('income')} />
          <Chip label="Expense" selected={filter === 'expense'} onPress={() => setFilter('expense')} />
        </View>

        {/* Period toggle */}
        <View style={styles.filterRow}>
          <Chip label="Monthly" selected={period === 'monthly'} onPress={() => setPeriod('monthly')} />
          <Chip label="Yearly" selected={period === 'annual'} onPress={() => setPeriod('annual')} />
        </View>

        {/* Donut breakdown */}
        {breakdown.length > 0 && (
          <Card>
            <SectionTitle title={filter === 'all' ? 'Income vs Expense' : filter === 'income' ? 'Income Breakdown' : 'Expense Breakdown'} />
            <DonutChart
              data={breakdown.map((b, i) => ({ label: b.name, value: b.amount, color: b.color || palette.chart[i % palette.chart.length] }))}
            />
            <View style={styles.bdList}>
              {breakdown.map((b, i) => (
                <View key={b.id} style={styles.bdRow}>
                  <View style={[styles.bdDot, { backgroundColor: b.color || palette.chart[i % palette.chart.length] }]} />
                  <Text style={[styles.bdName, { color: palette.text }]}>{b.name}</Text>
                  <Text style={[styles.bdAmt, { color: palette.text }]}>{formatMoney(b.amount, currency, { compact: true })}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Recurring transactions */}
        {recurring.length > 0 && (
          <Card>
            <SectionTitle title="Recurring (label only)" action={<Repeat size={16} color={palette.textMuted} />} />
            <Text style={{ fontSize: 11, color: palette.textMuted, marginBottom: 8 }}>
              These are reminders only — amounts are not projected into future months automatically.
            </Text>
            {recurring.map((t) => (
              <View key={t.id} style={styles.recurRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.recurName, { color: palette.text }]}>{catMap.get(t.categoryId)?.name || t.note || 'Recurring'}</Text>
                    <StatusBadge status={t.status} />
                  </View>
                  <Text style={[styles.recurSub, { color: palette.textMuted }]}>{t.recurring === 'monthly' ? 'Monthly' : 'Yearly'} · {formatMoney(t.amount, currency)}{t.pausedDate ? ` · paused ${t.pausedDate}` : ''}{t.closedDate ? ` · closed ${t.closedDate}` : ''}</Text>
                  <LifecycleActions
                    status={t.status}
                    onPause={() => setTransactionStatus(t.id, 'paused')}
                    onResume={() => setTransactionStatus(t.id, 'active')}
                    onClose={() => setTransactionStatus(t.id, 'closed')}
                    onReopen={() => setTransactionStatus(t.id, 'active')}
                  />
                </View>
                <Pressable onPress={() => deleteTransaction(t.id)} hitSlop={8}>
                  <Trash2 size={16} color={palette.danger} />
                </Pressable>
              </View>
            ))}
          </Card>
        )}

        {/* This period's transactions */}
        <Card>
          <SectionTitle title={period === 'monthly' ? `This Month (${monthLabel(monthKey(today)).split(' ')[0]})` : `This Year (${yearKey(today)})`} />
          {shown.length === 0 ? (
            <EmptyState title="No transactions yet" subtitle="Tap the + button to add income or expenses." />
          ) : (
            <View style={styles.txnList}>
              {grouped.map((group) => (
                <View key={group.key}>
                  <Text style={[styles.groupHeader, { color: palette.textMuted }]}>{group.label}</Text>
                  {group.items.map((t) => {
                    const cat = catMap.get(t.categoryId);
                    return (
                      <Pressable key={t.id} style={styles.txnRow} onPress={() => setEditTxn(t)}>
                        <View style={[styles.txnIcon, { backgroundColor: (t.type === 'income' ? palette.success : palette.danger) + '22' }]}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: t.type === 'income' ? palette.success : palette.danger }}>
                            {t.type === 'income' ? '↑' : '↓'}
                          </Text>
                        </View>
                        <View style={styles.txnInfo}>
                          <Text style={[styles.txnCat, { color: palette.text }]}>{cat?.name || 'Unknown'}</Text>
                          <Text style={[styles.txnNote, { color: palette.textMuted }]}>{t.note || t.date}{t.recurring !== 'none' ? ' · recurring' : ''}</Text>
                        </View>
                        <Text style={[styles.txnAmt, { color: t.type === 'income' ? palette.success : palette.text }]}>
                          {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount, currency, { compact: true })}
                        </Text>
                        <Pressable onPress={() => setEditTxn(t)} hitSlop={8}>
                          <Pencil size={15} color={palette.textMuted} />
                        </Pressable>
                        <Pressable onPress={() => deleteTransaction(t.id)} hitSlop={8}>
                          <X size={16} color={palette.textMuted} />
                        </Pressable>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>

      <TransactionSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={addTransaction} categories={data.categories} />

      {editTxn && (
        <EditTransactionSheet
          txn={editTxn}
          onClose={() => setEditTxn(null)}
          onUpdate={updateTransaction}
          onDelete={deleteTransaction}
          categories={data.categories}
        />
      )}
    </SafeAreaView>
  );
}

function TransactionSheet({
  visible,
  onClose,
  onAdd,
  categories,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (t: Omit<Transaction, 'id'>) => void;
  categories: Category[];
}) {
  const { palette, currency } = useUi();
  const [type, setType] = useState<TxnType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [recurring, setRecurring] = useState<RecurringType>('none');

  const filtered = categories.filter((c) => c.type === type);
  const selectedCat = categoryId || filtered[0]?.id || '';

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    onAdd({ type, amount: amt, categoryId: selectedCat, note: note.trim() || undefined, date, recurring, status: 'active' });
    setAmount(''); setNote(''); setRecurring('none'); setDate(todayISO());
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Add Transaction">
      <View style={styles.typeToggle}>
        <Chip label="Expense" selected={type === 'expense'} onPress={() => { setType('expense'); setCategoryId(''); }} />
        <Chip label="Income" selected={type === 'income'} onPress={() => { setType('income'); setCategoryId(''); }} />
      </View>
      <Field label="Amount">
        <Input value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <Field label="Category">
        <View style={styles.catChips}>
          {filtered.map((c) => (
            <Chip key={c.id} label={c.name} selected={selectedCat === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>
      </Field>
      <Field label="Note (optional)">
        <Input value={note} onChangeText={setNote} placeholder="What was this for?" />
      </Field>
      <Field label="Date">
        <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      </Field>
      <Field label="Recurring (label only — not auto-projected)">
        <View style={styles.typeToggle}>
          <Chip label="One-time" selected={recurring === 'none'} onPress={() => setRecurring('none')} />
          <Chip label="Monthly" selected={recurring === 'monthly'} onPress={() => setRecurring('monthly')} />
          <Chip label="Yearly" selected={recurring === 'yearly'} onPress={() => setRecurring('yearly')} />
        </View>
      </Field>
      <Button label="Add" onPress={submit} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

function EditTransactionSheet({
  txn,
  onClose,
  onUpdate,
  onDelete,
  categories,
}: {
  txn: Transaction;
  onClose: () => void;
  onUpdate: (id: string, t: Partial<Transaction>) => void;
  onDelete: (id: string) => void;
  categories: Category[];
}) {
  const { palette, currency } = useUi();
  const [type, setType] = useState<TxnType>(txn.type);
  const [amount, setAmount] = useState(String(txn.amount));
  const [categoryId, setCategoryId] = useState(txn.categoryId);
  const [note, setNote] = useState(txn.note || '');
  const [date, setDate] = useState(txn.date);
  const [recurring, setRecurring] = useState<RecurringType>(txn.recurring);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const filtered = categories.filter((c) => c.type === type);
  const selectedCat = categoryId || filtered[0]?.id || '';

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    onUpdate(txn.id, { type, amount: amt, categoryId: selectedCat, note: note.trim() || undefined, date, recurring });
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title="Edit Transaction">
      <View style={styles.typeToggle}>
        <Chip label="Expense" selected={type === 'expense'} onPress={() => { setType('expense'); setCategoryId(''); }} />
        <Chip label="Income" selected={type === 'income'} onPress={() => { setType('income'); setCategoryId(''); }} />
      </View>
      <Field label="Amount">
        <Input value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" />
      </Field>
      <Field label="Category">
        <View style={styles.catChips}>
          {filtered.map((c) => (
            <Chip key={c.id} label={c.name} selected={selectedCat === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>
      </Field>
      <Field label="Note (optional)">
        <Input value={note} onChangeText={setNote} placeholder="What was this for?" />
      </Field>
      <Field label="Date">
        <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      </Field>
      <Field label="Recurring (label only — not auto-projected)">
        <View style={styles.typeToggle}>
          <Chip label="One-time" selected={recurring === 'none'} onPress={() => setRecurring('none')} />
          <Chip label="Monthly" selected={recurring === 'monthly'} onPress={() => setRecurring('monthly')} />
          <Chip label="Yearly" selected={recurring === 'yearly'} onPress={() => setRecurring('yearly')} />
        </View>
      </Field>
      <Button label="Save Changes" onPress={submit} style={{ marginTop: 8 }} />

      {confirmDelete ? (
        <View style={[styles.deleteConfirm, { backgroundColor: palette.danger + '11', borderColor: palette.danger + '44' }]}>
          <Text style={{ fontSize: 13, color: palette.danger, fontWeight: '600', marginBottom: 8 }}>
            Delete this transaction? This cannot be undone.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Cancel" variant="outline" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
            <Button label="Delete" variant="danger" onPress={() => { onDelete(txn.id); onClose(); }} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button label="Delete Transaction" variant="danger" onPress={() => setConfirmDelete(true)} style={{ marginTop: 8 }} />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  screenTitle: { fontSize: 24, fontWeight: '800' },
  fab: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: { flex: 1, padding: 12, gap: 2 },
  summaryLabel: { fontSize: 11, fontWeight: '600' },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 8 },
  bdList: { marginTop: 12, gap: 8 },
  bdRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bdDot: { width: 8, height: 8, borderRadius: 4 },
  bdName: { fontSize: 12, flex: 1 },
  bdAmt: { fontSize: 12, fontWeight: '700' },
  recurRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  recurName: { fontSize: 14, fontWeight: '600' },
  recurSub: { fontSize: 12 },
  txnList: { gap: 4 },
  groupHeader: { fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  txnIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txnInfo: { flex: 1 },
  txnCat: { fontSize: 14, fontWeight: '600' },
  txnNote: { fontSize: 11 },
  txnAmt: { fontSize: 14, fontWeight: '700' },
  typeToggle: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  catChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deleteConfirm: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
