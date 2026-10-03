import React, { createContext, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput as RNTextInput,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import type { Palette } from '../lib/theme';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { getCurrency } from '../lib/format';
import type { Settings, Currency } from '../lib/types';

export function useUi() {
  const { data } = useStore();
  const palette = useTheme(data.settings);
  const currency = getCurrency(data.settings.currencies, data.settings.currencyCode);
  return { data, palette, currency, settings: data.settings };
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette } = useUi();
  return <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  const { palette } = useUi();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
      {action}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}) {
  const { palette } = useUi();
  const bg =
    variant === 'primary'
      ? palette.primary
      : variant === 'danger'
      ? palette.danger
      : 'transparent';
  const fg = variant === 'primary' ? palette.primaryText : variant === 'danger' ? palette.dangerText : palette.text;
  const border = variant === 'outline' ? palette.border : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: pressed ? 0.8 : disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { palette } = useUi();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? palette.primary : palette.surfaceAlt,
          borderColor: selected ? palette.primary : palette.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? palette.primaryText : palette.text }]}>{label}</Text>
      {color ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
    </Pressable>
  );
}

// Lets an Input announce the label of the Field it sits in, so screen readers read more than "edit text".
const FieldLabelContext = createContext<string | undefined>(undefined);

/**
 * `half` sizes the field to share a row equally (put two in a row View); without it the second one overflows.
 * `money` marks an amount input. Amounts are always entered in the base currency (rate 1), so when a
 * different display currency is selected the label says so instead of silently misreading the number.
 */
export function Field({ label, money, half, children }: { label: string; money?: boolean; half?: boolean; children: React.ReactNode }) {
  const { palette, currency, settings } = useUi();
  const base = settings.currencies.find((c) => c.rate === 1);
  const suffix = money && base && base.code !== currency.code ? ` (in ${base.symbol} ${base.code})` : '';
  return (
    <View style={[styles.field, half && styles.fieldHalf]}>
      <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>{label}{suffix}</Text>
      <FieldLabelContext.Provider value={label + suffix}>{children}</FieldLabelContext.Provider>
    </View>
  );
}

export function Input(props: React.ComponentProps<typeof RNTextInput>) {
  const { palette } = useUi();
  const fieldLabel = useContext(FieldLabelContext);
  const { style, ...rest } = props;
  return (
    <RNTextInput
      accessibilityLabel={fieldLabel}
      placeholderTextColor={palette.textMuted}
      style={[
        styles.input,
        { backgroundColor: palette.surfaceAlt, color: palette.text, borderColor: palette.border },
        style,
      ]}
      {...rest}
    />
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  const { palette } = useUi();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: palette.textMuted }]}>{title}</Text>
      {subtitle ? <Text style={[styles.emptySub, { color: palette.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function RiskBadge({ zone }: { zone: 'green' | 'yellow' | 'red' }) {
  const { palette } = useUi();
  const color = zone === 'green' ? palette.success : zone === 'yellow' ? palette.warning : palette.danger;
  const label = zone === 'green' ? 'Healthy' : zone === 'yellow' ? 'Caution' : 'High Risk';
  return (
    <View style={[styles.badge, { backgroundColor: color + '11', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: 'active' | 'paused' | 'closed' }) {
  const { palette } = useUi();
  if (status === 'active') return null;
  const color = status === 'paused' ? palette.warning : palette.textMuted;
  const label = status === 'paused' ? 'Paused' : 'Closed';
  return (
    <View style={[styles.badge, { backgroundColor: color + '11', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

/** Compact lifecycle action row: pause/resume + close/reopen. */
export function LifecycleActions({
  status,
  onPause,
  onResume,
  onClose,
  onReopen,
}: {
  status: 'active' | 'paused' | 'closed';
  onPause?: () => void;
  onResume?: () => void;
  onClose?: () => void;
  onReopen?: () => void;
}) {
  const { palette } = useUi();
  return (
    <View style={styles.lifecycleRow}>
      {status === 'active' && onPause && (
        <Pressable onPress={onPause} accessibilityRole="button" accessibilityLabel="Pause" style={[styles.lifecycleBtn, { borderColor: palette.warning }]}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: palette.warning }}>Pause</Text>
        </Pressable>
      )}
      {status === 'paused' && onResume && (
        <Pressable onPress={onResume} accessibilityRole="button" accessibilityLabel="Resume" style={[styles.lifecycleBtn, { borderColor: palette.success }]}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: palette.success }}>Resume</Text>
        </Pressable>
      )}
      {status !== 'closed' && onClose && (
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={[styles.lifecycleBtn, { borderColor: palette.textMuted }]}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: palette.textMuted }}>Close</Text>
        </Pressable>
      )}
      {status === 'closed' && onReopen && (
        <Pressable onPress={onReopen} accessibilityRole="button" accessibilityLabel="Reopen" style={[styles.lifecycleBtn, { borderColor: palette.success }]}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: palette.success }}>Reopen</Text>
        </Pressable>
      )}
    </View>
  );
}

/** An unticked-by-default checkbox for consents. `children` is the label and may contain links. */
export function Checkbox({ checked, onChange, label, children }: { checked: boolean; onChange: (v: boolean) => void; label: string; children: React.ReactNode }) {
  const { palette } = useUi();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      style={styles.checkRow}
    >
      <View style={[styles.checkBox, { borderColor: checked ? palette.primary : palette.textMuted, backgroundColor: checked ? palette.primary : 'transparent' }]}>
        {checked && <Text style={{ color: palette.primaryText, fontSize: 14, fontWeight: '800', lineHeight: 16 }}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export type { Palette, Settings, Currency };

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  button: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  buttonText: { fontSize: 15, fontWeight: '600' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  field: { marginBottom: 12 },
  fieldHalf: { flex: 1, minWidth: 0 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptySub: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  lifecycleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  lifecycleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
});