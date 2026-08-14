import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button, Input, Field, useUi, Chip } from '../components/ui';
import { useStore } from '../lib/store';
import { bandForAge, bandLabelForAge } from '../lib/calc';
import { formatPercent } from '../lib/format';

export function Onboarding() {
  const { palette } = useUi();
  const { updateSettings, setAllocationTargets } = useStore();
  const [step, setStep] = useState(0);
  const [age, setAge] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const finish = () => {
    const ageNum = Number(age);
    if (!ageNum || ageNum < 18) {
      setError('Please enter a valid age (18+).');
      return;
    }
    if (pin && pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    const band = bandForAge(ageNum);
    setAllocationTargets({
      stocks: band.stocks,
      mutualfund: band.mutualfund,
      fd: band.fd,
      ppf: band.ppf,
      gold: band.gold,
      crypto: band.crypto,
      other: band.other,
      custom: false,
    });
    updateSettings({ age: ageNum, pin: pin || null, onboarded: true });
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg }]} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <Text style={[styles.brand, { color: palette.primary }]}>FinTrack</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Your private, offline personal finance dashboard.
        </Text>

        {step === 0 && (
          <View style={styles.step}>
            <Text style={[styles.heading, { color: palette.text }]}>Welcome</Text>
            <Text style={[styles.body, { color: palette.textMuted }]}>
              FinTrack stores everything on this device only. No accounts, no cloud, no tracking. You can back up your data anytime from Settings.
            </Text>
            <View style={styles.spacer} />
            <Button label="Get started" onPress={() => setStep(1)} />
          </View>
        )}

        {step === 1 && (
          <View style={styles.step}>
            <Text style={[styles.heading, { color: palette.text }]}>How old are you?</Text>
            <Text style={[styles.body, { color: palette.textMuted }]}>
              We use your age to suggest a balanced investment allocation. You can change it later.
            </Text>
            <View style={styles.spacer} />
            <Field label="Your age">
              <Input
                value={age}
                onChangeText={(t) => { setAge(t.replace(/[^0-9]/g, '')); setError(null); }}
                keyboardType="numeric"
                placeholder="e.g. 30"
              />
            </Field>
            {age ? (
              <View style={[styles.bandCard, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
                <Text style={[styles.bandTitle, { color: palette.text }]}>
                  Suggested band: {bandLabelForAge(Number(age))}
                </Text>
                <View style={styles.bandGrid}>
                  {(['stocks','mutualfund','fd','ppf','gold','crypto','other'] as const).map((k) => {
                    const band = bandForAge(Number(age));
                    return (
                      <Text key={k} style={[styles.bandItem, { color: palette.textMuted }]}>
                        {k}: {formatPercent(band[k])}
                      </Text>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <View style={styles.row}>
              <Button label="Back" variant="outline" onPress={() => setStep(0)} />
              <View style={{ width: 12 }} />
              <Button label="Next" onPress={() => setStep(2)} />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.step}>
            <Text style={[styles.heading, { color: palette.text }]}>Set an app PIN (optional)</Text>
            <Text style={[styles.body, { color: palette.textMuted }]}>
              Since your financial data lives only on this device, a PIN keeps it private if someone else uses your phone. You can skip this and add it later.
            </Text>
            <View style={styles.spacer} />
            <Field label="4-digit PIN">
              <Input value={pin} onChangeText={(t) => { setPin(t.replace(/[^0-9]/g, '').slice(0, 4)); setError(null); }} keyboardType="numeric" placeholder="Leave empty to skip" />
            </Field>
            {pin.length > 0 && (
              <Field label="Confirm PIN">
                <Input value={confirmPin} onChangeText={(t) => { setConfirmPin(t.replace(/[^0-9]/g, '').slice(0, 4)); setError(null); }} keyboardType="numeric" placeholder="Re-enter PIN" />
              </Field>
            )}
            {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}
            <View style={styles.row}>
              <Button label="Back" variant="outline" onPress={() => setStep(1)} />
              <View style={{ width: 12 }} />
              <Button label="Finish" onPress={finish} />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  inner: { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 32 },
  step: { gap: 8 },
  heading: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  spacer: { height: 16 },
  row: { flexDirection: 'row', marginTop: 16 },
  bandCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginVertical: 12 },
  bandTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  bandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bandItem: { fontSize: 12, width: '48%' },
  error: { fontSize: 13, marginTop: 8 },
});

