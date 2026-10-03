import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Sheet } from './Sheet';
import { Button, Checkbox, useUi } from './ui';
import { useStore } from '../lib/store';
import { BUSINESS, LEGAL_DOCS, LEGAL_VERSION, type LegalDocId } from '../lib/legal';
import { todayISO } from '../lib/format';

/** Shows one legal document. `doc: null` keeps it closed. */
export function LegalSheet({ doc, onClose }: { doc: LegalDocId | null; onClose: () => void }) {
  const { palette } = useUi();
  const d = doc ? LEGAL_DOCS[doc] : null;
  return (
    <Sheet visible={!!d} onClose={onClose} title={d?.title ?? ''}>
      {d && (
        <View style={{ gap: 14, paddingBottom: 16 }}>
          {d.updated && <Text style={{ fontSize: 12, color: palette.textMuted }}>Last updated: {d.updated}</Text>}
          {d.sections.map((section, i) => (
            <View key={i} style={{ gap: 6 }}>
              {section.heading && <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }} accessibilityRole="header">{section.heading}</Text>}
              {section.body.map((p, j) => (
                <Text key={j} style={{ fontSize: 13, lineHeight: 19, color: palette.text }}>{p}</Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}

function DocLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { palette } = useUi();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`Read the ${label}`} hitSlop={6}>
      <Text style={{ color: palette.primary, fontWeight: '700', textDecorationLine: 'underline', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * The two consents FinTrack needs before use. Both start unticked and are never pre-ticked: an adult-age
 * confirmation (the app is not meant for children) and agreement to the Terms and Privacy Policy.
 */
export function ConsentChecks({ value, onChange }: { value: { adult: boolean; terms: boolean }; onChange: (v: { adult: boolean; terms: boolean }) => void }) {
  const { palette } = useUi();
  const [open, setOpen] = useState<LegalDocId | null>(null);
  return (
    <View style={{ gap: 4 }}>
      <Checkbox checked={value.adult} onChange={(adult) => onChange({ ...value, adult })} label="I confirm I am 18 or older">
        <Text style={{ fontSize: 14, color: palette.text }}>I confirm I am 18 or older.</Text>
      </Checkbox>
      <Checkbox checked={value.terms} onChange={(terms) => onChange({ ...value, terms })} label="I have read and agree to the Terms of Service and Privacy Policy">
        <Text style={{ fontSize: 14, color: palette.text, lineHeight: 20 }}>I have read and agree to the Terms of Service and Privacy Policy.</Text>
      </Checkbox>
      {/* Links sit outside the checkbox so screen readers can reach them and a tap never ticks the box. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginLeft: 32 }}>
        <DocLink label="Terms of Service" onPress={() => setOpen('terms')} />
        <DocLink label="Privacy Policy" onPress={() => setOpen('privacy')} />
      </View>
      <LegalSheet doc={open} onClose={() => setOpen(null)} />
    </View>
  );
}

export const acceptedLegalSettings = () => ({ legalAcceptedVersion: LEGAL_VERSION, legalAcceptedAt: todayISO() });

/** Shown to an existing user when the Terms or Privacy Policy changed since they last accepted them. */
export function LegalUpdate() {
  const { palette } = useUi();
  const { updateSettings } = useStore();
  const [consent, setConsent] = useState({ adult: false, terms: false });
  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={styles.inner}>
        <Text style={[styles.heading, { color: palette.text }]} accessibilityRole="header">We&apos;ve updated our terms</Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: palette.textMuted, marginBottom: 16 }}>
          Please review the {BUSINESS.appName} Terms of Service and Privacy Policy to keep using the app. Your data has not changed and still stays on this device.
        </Text>
        <ConsentChecks value={consent} onChange={setConsent} />
        <Button label="Continue" onPress={() => updateSettings(acceptedLegalSettings())} disabled={!consent.adult || !consent.terms} style={{ marginTop: 16 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  inner: { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
});
