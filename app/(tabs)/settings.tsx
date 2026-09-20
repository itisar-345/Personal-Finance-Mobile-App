import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestNotificationPermission, scheduleRecurringNotifications, cancelAllNotifications } from '@/lib/notifications';
import { Card, SectionTitle, useUi, Chip, Button, Input, Field, StatusBadge, LifecycleActions } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useStore } from '@/lib/store';
import { DEFAULT_CURRENCIES } from '@/lib/defaults';
import { formatMoney, todayISO } from '@/lib/format';
import { Moon, Sun, Monitor, Lock, Trash2, Bell, Coins, Calendar, FileText, Info, Tag, ChevronRight, Pause, Play, Pencil } from 'lucide-react-native';

function formatBackupDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
import type { Currency, AppData, Category, RecurringType, ContributionFreq, ItemStatus } from '@/lib/types';

export default function SettingsScreen() {
  const { data, palette, currency, settings } = useUi();
  const { updateSettings, importData, resetData, exportData } = useStore();
  const [pinSheet, setPinSheet] = useState(false);
  const [ageSheet, setAgeSheet] = useState(false);
  const [returnSheet, setReturnSheet] = useState(false);
  const [rateSheet, setRateSheet] = useState(false);
  const [importSheet, setImportSheet] = useState(false);
  const [recurringSheet, setRecurringSheet] = useState(false);
  const [categorySheet, setCategorySheet] = useState(false);
  const [aboutSheet, setAboutSheet] = useState(false);
  const [resetSheet, setResetSheet] = useState(false);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);

  const recurringCount = useMemo(
    () => {
      const activeHoldingIds = new Set([
        ...data.debts.filter((d) => d.status === 'active').map((d) => d.id),
        ...data.investments.filter((i) => i.status === 'active').map((i) => i.id),
      ]);
      return data.transactions.filter((t) => t.recurring !== 'none' && t.status === 'active').length +
        data.contributions.filter((c) => c.type === 'recurring' && c.status === 'active' && activeHoldingIds.has(c.holdingId)).length;
    },
    [data.transactions, data.contributions, data.debts, data.investments, data.assets],
  );

  const doExport = async () => {
    const json = JSON.stringify(exportData(), null, 2);
    const today = todayISO();
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fintrack-backup-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      try {
        await Share.share({ message: json, title: 'FinTrack Backup' });
      } catch { return; }
    }
    updateSettings({ lastBackupDate: today });
  };

  // Quote the field, and neutralise leading = + - @ so spreadsheets don't run it as a formula.
  const csvEscape = (s: string) => {
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
  };

  const doExportCsv = () => {
    const rows = ['date,type,amount,category,note,recurring'];
    for (const t of data.transactions) {
      const cat = data.categories.find((c) => c.id === t.categoryId)?.name || '';
      rows.push(`${t.date},${t.type},${t.amount},${csvEscape(cat)},${csvEscape(t.note || '')},${t.recurring}`);
    }
    const csv = rows.join('\n');
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fintrack-transactions-${todayISO()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      Share.share({ message: csv, title: 'FinTrack Transactions' }).catch(() => {});
    }
  };

  const doImportJson = (jsonText: string): { ok: boolean; message: string } => {
    try {
      const parsed = JSON.parse(jsonText) as AppData;
      if (!parsed || typeof parsed !== 'object') return { ok: false, message: 'Invalid JSON structure.' };
      if (!Array.isArray(parsed.transactions) && !Array.isArray(parsed.assets) && !Array.isArray(parsed.investments)) {
        return { ok: false, message: 'This does not look like a FinTrack backup file.' };
      }
      importData(parsed);
      return { ok: true, message: 'Backup restored successfully.' };
    } catch {
      return { ok: false, message: 'Could not parse JSON. Please check the file.' };
    }
  };

  const toggleReminders = async () => {
    if (!settings.reminderEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setReminderStatus('Permission denied. Enable notifications for FinTrack in your device settings.');
        return;
      }
      await scheduleRecurringNotifications(data);
      setReminderStatus(null);
      updateSettings({ reminderEnabled: true });
    } else {
      await cancelAllNotifications();
      updateSettings({ reminderEnabled: false });
      setReminderStatus(null);
    }
  };

  const confirmReset = () => {
    setResetSheet(true);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Appearance */}
        <Card>
          <SectionTitle title="Appearance" />
          <View style={styles.themeRow}>
            <ThemeOption icon={<Sun size={18} color={palette.text} />} label="Light" selected={settings.theme === 'light'} onPress={() => updateSettings({ theme: 'light' })} />
            <ThemeOption icon={<Moon size={18} color={palette.text} />} label="Dark" selected={settings.theme === 'dark'} onPress={() => updateSettings({ theme: 'dark' })} />
            <ThemeOption icon={<Monitor size={18} color={palette.text} />} label="System" selected={settings.theme === 'system'} onPress={() => updateSettings({ theme: 'system' })} />
          </View>
        </Card>

        {/* Currency */}
        <Card>
          <SectionTitle title="Currency" action={<Coins size={16} color={palette.textMuted} />} />
          <View style={styles.chipRow}>
            {settings.currencies.map((c) => (
              <Chip key={c.code} label={`${c.symbol} ${c.code}`} selected={settings.currencyCode === c.code} onPress={() => updateSettings({ currencyCode: c.code })} />
            ))}
          </View>
          <Pressable onPress={() => setRateSheet(true)} style={styles.subAction}>
            <Text style={{ fontSize: 13, color: palette.primary, fontWeight: '600' }}>Edit exchange rates</Text>
          </Pressable>
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>
            Amounts are stored in your base currency (INR). Rates convert for display only.
          </Text>
        </Card>

        {/* Profile */}
        <Card>
          <SectionTitle title="Your Profile" action={<Calendar size={16} color={palette.textMuted} />} />
          <Pressable style={styles.rowAction} onPress={() => setAgeSheet(true)}>
            <Text style={{ fontSize: 14, color: palette.text }}>Age</Text>
            <Text style={{ fontSize: 14, color: palette.textMuted }}>{settings.age ?? 'Not set'}</Text>
          </Pressable>
          <Pressable style={styles.rowAction} onPress={() => setReturnSheet(true)}>
            <Text style={{ fontSize: 14, color: palette.text }}>Expected annual return</Text>
            <Text style={{ fontSize: 14, color: palette.textMuted }}>{settings.expectedReturn ?? 10}%</Text>
          </Pressable>
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>
            Your age determines your suggested investment allocation band. Expected return is used for goal projections.
          </Text>
        </Card>

        {/* Security */}
        <Card>
          <SectionTitle title="Security" action={<Lock size={16} color={palette.textMuted} />} />
          <Pressable style={styles.rowAction} onPress={() => setPinSheet(true)}>
            <Text style={{ fontSize: 14, color: palette.text }}>App PIN</Text>
            <Text style={{ fontSize: 14, color: palette.textMuted }}>{settings.pin ? 'Enabled' : 'Disabled'}</Text>
          </Pressable>
        </Card>

        {/* Reminders */}
        <Card>
          <SectionTitle title="Reminders" action={<Bell size={16} color={palette.textMuted} />} />
          <Pressable style={styles.rowAction} onPress={toggleReminders}>
            <Text style={{ fontSize: 14, color: palette.text }}>Due date reminders</Text>
            <Text style={{ fontSize: 14, color: palette.textMuted }}>{settings.reminderEnabled ? 'On' : 'Off'}</Text>
          </Pressable>
          {reminderStatus && (
            <Text style={{ fontSize: 11, color: palette.danger, marginTop: 4 }}>{reminderStatus}</Text>
          )}
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>
            Active recurring items alert at 9:00 AM local time on their due date. No internet needed.
          </Text>
          {settings.reminderEnabled && recurringCount > 0 && (
            <Pressable
              style={[styles.recurringRow, { borderTopColor: palette.border }]}
              onPress={() => setRecurringSheet(true)}
            >
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>
                  {recurringCount} recurring item{recurringCount !== 1 ? 's' : ''}
                </Text>
                <Text style={{ fontSize: 11, color: palette.textMuted }}>Tap to view, pause, or resume</Text>
              </View>
              <ChevronRight size={18} color={palette.textMuted} />
            </Pressable>
          )}
        </Card>

        {/* Data */}
        <Card>
          <SectionTitle title="Backup & Data" action={<FileText size={16} color={palette.textMuted} />} />

          {/* Auto-backup reminder */}
          <View style={styles.rowAction}>
            <Text style={{ fontSize: 14, color: palette.text }}>Remind me to backup</Text>
            <View style={styles.chipRow}>
              <Chip label="Off" selected={settings.backupFreq === 'none'} onPress={() => updateSettings({ backupFreq: 'none' })} />
              <Chip label="Weekly" selected={settings.backupFreq === 'weekly'} onPress={() => updateSettings({ backupFreq: 'weekly' })} />
              <Chip label="Monthly" selected={settings.backupFreq === 'monthly'} onPress={() => updateSettings({ backupFreq: 'monthly' })} />
            </View>
          </View>
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>
            Your data is stored only on this device. A periodic reminder helps you export a backup so you don't lose everything if the device is lost or reset.
          </Text>

          {settings.lastBackupDate ? (
            <View style={[styles.lastBackupRow, { borderColor: palette.success + '44', backgroundColor: palette.success + '11' }]}>
              <Text style={{ fontSize: 12, color: palette.success, fontWeight: '600' }}>Last exported: {formatBackupDate(settings.lastBackupDate)}</Text>
            </View>
          ) : (
            <View style={[styles.lastBackupRow, { borderColor: palette.warning + '44', backgroundColor: palette.warning + '11' }]}>
              <Text style={{ fontSize: 12, color: palette.warning, fontWeight: '600' }}>No backup exported yet</Text>
            </View>
          )}

          <View style={[styles.dataActions, { marginTop: 12 }]}>
            <Button label="Export Backup (JSON)" variant="outline" onPress={doExport} style={styles.dataBtn} />
            <Button label="Import Backup (JSON)" variant="outline" onPress={() => setImportSheet(true)} style={styles.dataBtn} />
            <Button label="Export Transactions (CSV)" variant="outline" onPress={doExportCsv} style={styles.dataBtn} />
            <Button label="Reset All Data" variant="danger" onPress={confirmReset} style={styles.dataBtn} />
          </View>
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 8 }}>
            JSON backup includes everything: transactions, assets, investments, debts, goals, categories, and settings.
          </Text>
        </Card>

        {/* Categories */}
        <Card>
          <SectionTitle title="Categories" action={<Tag size={16} color={palette.textMuted} />} />
          <Pressable style={styles.rowAction} onPress={() => setCategorySheet(true)}>
            <Text style={{ fontSize: 14, color: palette.text }}>Manage transaction categories</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14, color: palette.textMuted }}>{data.categories.length}</Text>
              <ChevronRight size={18} color={palette.textMuted} />
            </View>
          </Pressable>
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 4 }}>
            Add, rename, or delete the categories used to tag your income and expenses.
          </Text>
        </Card>

        {/* About */}
        <Card>
          <SectionTitle title="About" action={<Info size={16} color={palette.textMuted} />} />
          <Pressable style={styles.rowAction} onPress={() => setAboutSheet(true)}>
            <Text style={{ fontSize: 14, color: palette.text }}>About FinTrack & Help</Text>
            <ChevronRight size={18} color={palette.textMuted} />
          </Pressable>
        </Card>

        <Text style={[styles.about, { color: palette.textMuted }]}>FinTrack · Offline personal finance · v1.0</Text>
      </ScrollView>

      <PinSheet visible={pinSheet} onClose={() => setPinSheet(false)} />
      <AgeSheet visible={ageSheet} onClose={() => setAgeSheet(false)} />
      <ReturnRateSheet visible={returnSheet} onClose={() => setReturnSheet(false)} />
      <RateSheet visible={rateSheet} onClose={() => setRateSheet(false)} />
      <ImportJsonSheet visible={importSheet} onClose={() => setImportSheet(false)} onImport={doImportJson} />
      <RecurringItemsSheet visible={recurringSheet} onClose={() => setRecurringSheet(false)} />
      <CategorySheet visible={categorySheet} onClose={() => setCategorySheet(false)} />
      <AboutSheet visible={aboutSheet} onClose={() => setAboutSheet(false)} />
      <ResetConfirmSheet visible={resetSheet} onClose={() => setResetSheet(false)} onConfirm={() => { resetData(); setResetSheet(false); }} />
    </SafeAreaView>
  );
}

function ThemeOption({ icon, label, selected, onPress }: { icon: React.ReactNode; label: string; selected: boolean; onPress: () => void }) {
  const { palette } = useUi();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.themeOpt, { backgroundColor: selected ? palette.primary + '22' : palette.surfaceAlt, borderColor: selected ? palette.primary : palette.border, opacity: pressed ? 0.8 : 1 }]}>
      {icon}
      <Text style={{ fontSize: 12, fontWeight: '600', color: palette.text, marginTop: 4 }}>{label}</Text>
    </Pressable>
  );
}

function PinSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette } = useUi();
  const { data, updateSettings } = useStore();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');

  const save = async () => {
    if (pin && pin.length !== 4) return;
    if (pin && pin !== confirm) return;
    await updateSettings({ pin: pin || null });
    setPin(''); setConfirm('');
    onClose();
  };

  const remove = () => {
    updateSettings({ pin: null });
    setPin(''); setConfirm('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="App PIN">
      <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 8 }}>
        {data.settings.pin ? 'PIN is currently enabled. Enter a new 4-digit PIN to change it, or remove it below.' : 'Set a 4-digit PIN to lock the app on launch.'}
      </Text>
      <Field label="4-digit PIN">
        <Input value={pin} onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="numeric" placeholder="Leave empty to disable" />
      </Field>
      {pin.length > 0 && (
        <Field label="Confirm PIN">
          <Input value={confirm} onChangeText={(t) => setConfirm(t.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="numeric" />
        </Field>
      )}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        <Button label="Save" onPress={save} style={{ flex: 1 }} />
        {data.settings.pin && <Button label="Remove PIN" variant="danger" onPress={remove} style={{ flex: 1 }} />}
      </View>
    </Sheet>
  );
}

function AgeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data } = useUi();
  const { updateSettings } = useStore();
  const [age, setAge] = useState(String(data.settings.age ?? ''));

  const save = () => {
    const n = Number(age);
    if (!n || n < 18) return;
    updateSettings({ age: n });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Your Age">
      <Field label="Age">
        <Input value={age} onChangeText={(t) => setAge(t.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="numeric" placeholder="e.g. 30" />
      </Field>
      <Button label="Save" onPress={save} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

function ReturnRateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data } = useUi();
  const { updateSettings } = useStore();
  const [rate, setRate] = useState(String(data.settings.expectedReturn ?? 10));

  const save = () => {
    const n = Number(rate);
    if (isNaN(n) || n < 0 || n > 30) return;
    updateSettings({ expectedReturn: n });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Expected Annual Return">
      <Text style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
        Used to project how much you need to save monthly toward your goals. Default is 10%.
      </Text>
      <Field label="Annual return %">
        <Input value={rate} onChangeText={(t) => setRate(t.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="10" />
      </Field>
      <Button label="Save" onPress={save} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

function RateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data, palette } = useUi();
  const { updateSettings } = useStore();
  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(data.settings.currencies.map((c) => [c.code, String(c.rate)])),
  );

  const [rateError, setRateError] = useState<string | null>(null);

  const save = () => {
    for (const c of data.settings.currencies) {
      const v = rates[c.code];
      if (v === '' || v === undefined) continue;
      if (isNaN(Number(v)) || Number(v) <= 0) {
        setRateError(`Invalid rate for ${c.code}.`);
        return;
      }
    }
    const updated: Currency[] = data.settings.currencies.map((c) => ({
      ...c,
      // INR is the base currency every amount is stored in, so its rate is fixed at 1.
      rate: c.code === 'INR' ? 1 : rates[c.code] !== '' && rates[c.code] !== undefined ? Number(rates[c.code]) : c.rate,
    }));
    updateSettings({ currencies: updated });
    setRateError(null);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Exchange Rates">
      <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 12 }}>
        Set the conversion rate from your base currency (INR = 1). Update manually whenever you like — no live API.
      </Text>
      {data.settings.currencies.filter((c) => c.code !== 'INR').map((c) => (
        <Field key={c.code} label={`1 INR = ? ${c.code}`}>
          <Input
            value={rates[c.code] ?? ''}
            onChangeText={(t) => setRates((r) => ({ ...r, [c.code]: t.replace(/[^0-9.]/g, '') }))}
            keyboardType="numeric"
            placeholder={String(c.rate)}
          />
        </Field>
      ))}
      {rateError && <Text style={{ fontSize: 12, color: palette.danger, marginBottom: 4 }}>{rateError}</Text>}
      <Button label="Save Rates" onPress={save} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

function ImportJsonSheet({
  visible,
  onClose,
  onImport,
}: {
  visible: boolean;
  onClose: () => void;
  onImport: (jsonText: string) => { ok: boolean; message: string };
}) {
  const { palette } = useUi();
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleImport = () => {
    const r = onImport(text.trim());
    setResult(r);
    if (r.ok) {
      setText('');
      setTimeout(onClose, 800);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Import Backup (JSON)">
      <Text style={{ fontSize: 13, color: palette.textMuted, marginBottom: 8 }}>
        {Platform.OS === 'web'
          ? 'Paste a JSON backup below, or upload a .json backup file. This will replace all current data.'
          : 'Paste a JSON backup below. This will replace all current data.'}
      </Text>
      {Platform.OS === 'web' && (
        <Field label="Upload .json file">
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => { setText(String(reader.result || '')); setResult(null); };
              reader.readAsText(f);
            }}
            style={{ fontSize: 13, color: palette.text }}
          />
        </Field>
      )}
      <Field label={Platform.OS === 'web' ? 'Or paste JSON text' : 'Paste JSON text'}>
        <Input
          value={text}
          onChangeText={setText}
          placeholder='{ "transactions": [...], "assets": [...] }'
          multiline
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
      </Field>
      {result && (
        <Text style={{ fontSize: 13, color: result.ok ? palette.success : palette.danger, marginBottom: 8 }}>
          {result.message}
        </Text>
      )}
      <Button label="Restore Backup" onPress={handleImport} disabled={!text.trim()} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

type RecurringItem = {
  id: string;
  contributionId?: string;
  name: string;
  type: string;
  kind: 'transaction' | 'asset' | 'debt' | 'investment';
  recurring: Exclude<RecurringType, 'none'> | ContributionFreq;
  status: ItemStatus;
  date: string;
  amount: number;
};

function nextDueDate(date: string, recurring: RecurringItem['recurring']): string {
  const today = todayISO();
  if (date > today) return date;
  let due = date;
  if (recurring === 'weekly') {
    while (due <= today) due = addDays(due, 7);
  } else if (recurring === 'monthly') {
    while (due <= today) due = advanceDueDate(due, 1);
  } else if (recurring === 'quarterly') {
    while (due <= today) due = advanceDueDate(due, 3);
  } else if (recurring === 'yearly') {
    while (due <= today) due = advanceDueDate(due, 12);
  }
  return due;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function advanceDueDate(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const totalMonths = year * 12 + month - 1 + months;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  const lastDay = new Date(nextYear, nextMonth, 0).getDate();
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function RecurringItemsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data, palette, currency } = useUi();
  const { setTransactionStatus, setDebtStatus, setInvestmentStatus, setContributionStatus } = useStore();

  const items: RecurringItem[] = useMemo(() => {
    const txns = data.transactions
      .filter((t) => t.recurring !== 'none')
      .map((t) => {
        const cat = data.categories.find((c) => c.id === t.categoryId);
        return {
          id: t.id,
          name: t.note || cat?.name || t.type,
          type: t.type === 'income' ? 'Income' : 'Expense',
          kind: 'transaction' as const,
          recurring: t.recurring as Exclude<RecurringType, 'none'>,
          status: t.status,
          date: t.date,
          amount: t.amount,
        };
      });
    const debts = data.debts
      .filter((d) => d.status !== 'closed' && data.contributions.some((c) => c.holdingId === d.id && c.type === 'recurring' && c.status !== 'closed'))
      .map((d) => {
        const contrib = data.contributions.find((c) => c.holdingId === d.id && c.type === 'recurring' && c.status !== 'closed');
        return {
          id: d.id,
          contributionId: contrib?.id,
          name: d.name,
          type: d.type,
          kind: 'debt' as const,
          recurring: contrib?.freq || 'monthly',
          status: d.status,
          date: contrib?.startDate || d.date || todayISO(),
          amount: contrib?.amount || d.emi,
        };
      });
    const invs = data.investments
      .filter((i) => i.status !== 'closed' && data.contributions.some((c) => c.holdingId === i.id && c.type === 'recurring' && c.status !== 'closed'))
      .map((i) => {
        const contrib = data.contributions.find((c) => c.holdingId === i.id && c.type === 'recurring' && c.status !== 'closed');
        return {
          id: i.id,
          contributionId: contrib?.id,
          name: i.name,
          type: i.type,
          kind: 'investment' as const,
          recurring: contrib?.freq || 'monthly',
          status: i.status,
          date: contrib?.startDate || i.purchaseDate,
          amount: contrib?.amount || 0,
        };
      });
    return [...txns, ...debts, ...invs];
  }, [data.transactions, data.assets, data.debts, data.investments, data.categories, data.contributions]);

  const togglePause = (item: RecurringItem) => {
    if (item.kind === 'transaction') {
      setTransactionStatus(item.id, item.status === 'active' ? 'paused' : 'active');
    } else if (item.kind === 'debt') {
      setDebtStatus(item.id, item.status === 'active' ? 'paused' : 'active');
      if (item.contributionId) setContributionStatus(item.contributionId, item.status === 'active' ? 'paused' : 'active');
    } else {
      setInvestmentStatus(item.id, item.status === 'active' ? 'paused' : 'active');
      if (item.contributionId) setContributionStatus(item.contributionId, item.status === 'active' ? 'paused' : 'active');
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Recurring Items">
      {items.length === 0 ? (
        <Text style={{ fontSize: 13, color: palette.textMuted, paddingVertical: 16, textAlign: 'center' }}>
          No recurring items tracked yet.
        </Text>
      ) : (
        items.map((item) => {
          const due = nextDueDate(item.date, item.recurring);
          const isPaused = item.status === 'paused';
          const dueLabel = isPaused ? 'Paused' : `Next: ${due}`;
          return (
            <View key={`${item.kind}-${item.id}`} style={[styles.recurringItemRow, { borderBottomColor: palette.border }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>{item.name}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 2 }}>
                  {item.type} · {item.recurring} · {dueLabel}
                  {item.amount > 0 && ` · ${formatMoney(item.amount, currency, { compact: true })}`}
                </Text>
              </View>
              {item.status !== 'closed' && (
                <Pressable
                  onPress={() => togglePause(item)}
                  style={[styles.pauseBtn, { borderColor: isPaused ? palette.success : palette.warning }]}
                >
                  {isPaused ? (
                    <Play size={14} color={palette.success} />
                  ) : (
                    <Pause size={14} color={palette.warning} />
                  )}
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isPaused ? palette.success : palette.warning, marginLeft: 4 }}>
                    {isPaused ? 'Resume' : 'Pause'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}
    </Sheet>
  );
}

function CategorySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette } = useUi();
  const { data, addCategory, updateCategory, deleteCategory } = useStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = data.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.type === type);
    if (exists) {
      setError('A category with this name already exists.');
      return;
    }
    addCategory({ name: trimmed, type });
    setName('');
    setError(null);
  };

  const handleDelete = (cat: Category) => {
    const inUse = data.transactions.some((t) => t.categoryId === cat.id);
    if (inUse) {
      setError(`"${cat.name}" is used by existing transactions. Remove or reassign those transactions first.`);
      return;
    }
    setPendingDelete(cat);
  };

  const startEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setType(cat.type);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setName('');
    setError(null);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editing && type !== editing.type && data.transactions.some((t) => t.categoryId === editing.id)) {
      setError('This category is used by existing transactions. Reassign them before changing its type.');
      return;
    }
    const exists = data.categories.some((c) => c.id !== editing?.id && c.name.toLowerCase() === trimmed.toLowerCase() && c.type === type);
    if (exists) {
      setError('A category with this name already exists.');
      return;
    }
    if (editing) updateCategory(editing.id, { name: trimmed, type });
    cancelEdit();
  };

  const incomeCats = data.categories.filter((c) => c.type === 'income');
  const expenseCats = data.categories.filter((c) => c.type === 'expense');

  const renderCat = (cat: Category) => (
    <View key={cat.id} style={[styles.catRow, { borderBottomColor: palette.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        <Tag size={14} color={cat.type === 'income' ? palette.success : palette.danger} />
        <Text style={{ fontSize: 14, color: palette.text }}>{cat.name}</Text>
      </View>
      <Pressable onPress={() => startEdit(cat)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit">
        <Pencil size={16} color={palette.primary} />
      </Pressable>
      <Pressable onPress={() => handleDelete(cat)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete">
        <Trash2 size={16} color={palette.danger} />
      </Pressable>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Manage Categories">
      <Field label="Add new category">
        <Input value={name} onChangeText={(t) => { setName(t); setError(null); }} placeholder="Category name" />
      </Field>
      <Field label="Type">
        <View style={styles.chipRow}>
          <Chip label="Expense" selected={type === 'expense'} onPress={() => setType('expense')} />
          <Chip label="Income" selected={type === 'income'} onPress={() => setType('income')} />
        </View>
      </Field>
      {error && <Text style={{ fontSize: 12, color: palette.danger, marginBottom: 8 }}>{error}</Text>}
      {pendingDelete && (
        <View style={[styles.aboutCard, { backgroundColor: palette.danger + '11', borderColor: palette.danger + '44', marginBottom: 8 }]}>
          <Text style={{ fontSize: 13, color: palette.danger, fontWeight: '600', marginBottom: 8 }}>
            Remove "{pendingDelete.name}"?
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Cancel" variant="outline" onPress={() => setPendingDelete(null)} style={{ flex: 1 }} />
            <Button label="Delete" variant="danger" onPress={() => { deleteCategory(pendingDelete.id); setPendingDelete(null); }} style={{ flex: 1 }} />
          </View>
        </View>
      )}
      {editing ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <Button label="Cancel" variant="outline" onPress={cancelEdit} style={{ flex: 1 }} />
          <Button label="Save Category" onPress={handleSave} disabled={!name.trim()} style={{ flex: 1 }} />
        </View>
      ) : (
        <Button label="Add Category" onPress={handleAdd} disabled={!name.trim()} style={{ marginTop: 4 }} />
      )}

      <Text style={[styles.subHeader, { color: palette.textMuted }]}>Expense ({expenseCats.length})</Text>
      {expenseCats.map(renderCat)}

      <Text style={[styles.subHeader, { color: palette.textMuted, marginTop: 16 }]}>Income ({incomeCats.length})</Text>
      {incomeCats.map(renderCat)}
    </Sheet>
  );
}

function AboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette } = useUi();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Where is my data stored?',
      a: 'Everything stays on your device. FinTrack uses local storage — no cloud, no servers, no account required. Your financial data never leaves your phone unless you manually export a backup.',
    },
    {
      q: 'How do I back up my data?',
      a: 'Go to Backup & Data and tap "Export Backup (JSON)". This saves a file with all your data. Store it somewhere safe like Google Drive or email. You can restore it later with "Import Backup (JSON)".',
    },
    {
      q: 'What happens if I lose my device?',
      a: 'Without a backup, data on the lost device cannot be recovered. That is why we recommend enabling the auto-backup reminder and exporting regularly.',
    },
    {
      q: 'Do reminders work offline?',
      a: 'Yes. Reminders use your device\'s local notification system via expo-notifications. No internet connection is needed — they fire based on the clock on your device.',
    },
    {
      q: 'Is my data shared with anyone?',
      a: 'No. FinTrack is fully offline. There are no analytics, no tracking, and no data sent to any server. What you enter stays on your device.',
    },
  ];

  return (
    <Sheet visible={visible} onClose={onClose} title="About FinTrack">
      <View style={{ gap: 12 }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: palette.text }}>FinTrack</Text>
          <Text style={{ fontSize: 13, color: palette.textMuted, marginTop: 2 }}>
            Offline personal finance tracker · v1.0
          </Text>
        </View>

        <View style={[styles.aboutCard, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text, marginBottom: 4 }}>
            100% Local, 0% Cloud
          </Text>
          <Text style={{ fontSize: 12, color: palette.textMuted, lineHeight: 18 }}>
            FinTrack stores all data on your device. No accounts, no sign-up, no internet required. Export a backup to keep your data safe.
          </Text>
        </View>

        <Text style={[styles.subHeader, { color: palette.textMuted }]}>Frequently Asked Questions</Text>
        {faqs.map((faq, i) => (
          <Pressable
            key={i}
            style={[styles.faqRow, { borderBottomColor: palette.border }]}
            onPress={() => setOpenFaq(openFaq === i ? null : i)}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text, flex: 1 }}>{faq.q}</Text>
              <ChevronRight
                size={16}
                color={palette.textMuted}
                style={{ transform: [{ rotate: openFaq === i ? '90deg' : '0deg' }] }}
              />
            </View>
            {openFaq === i && (
              <Text style={{ fontSize: 12, color: palette.textMuted, lineHeight: 18, marginTop: 6 }}>
                {faq.a}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

function ResetConfirmSheet({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: () => void }) {
  const { palette } = useUi();
  return (
    <Sheet visible={visible} onClose={onClose} title="Reset All Data">
      <View style={{ gap: 14 }}>
        <View style={[styles.aboutCard, { backgroundColor: palette.danger + '11', borderColor: palette.danger + '44' }]}>
          <Text style={{ fontSize: 13, color: palette.danger, fontWeight: '600', lineHeight: 18 }}>
            This permanently deletes all your transactions, assets, investments, debts, and goals. This cannot be undone.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Reset Everything" variant="danger" onPress={onConfirm} style={{ flex: 1 }} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  screenTitle: { fontSize: 24, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  themeRow: { flexDirection: 'row', gap: 12 },
  themeOpt: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, gap: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subAction: { marginTop: 8 },
  rowAction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 8 },
  dataActions: { gap: 8 },
  dataBtn: { alignItems: 'center' },
  about: { fontSize: 11, textAlign: 'center', marginTop: 8 },
  recurringRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  recurringItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  pauseBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  lastBackupRow: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },
  catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  subHeader: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  aboutCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  faqRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
