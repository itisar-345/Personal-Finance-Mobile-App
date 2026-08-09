import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useUi } from './ui';
import { useStore } from '../lib/store';
import { verifyPin } from '../lib/crypto';

export function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const { palette } = useUi();
  const { data } = useStore();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);

  const press = (d: string) => {
    if (entry.length >= 4) return;
    const next = entry + d;
    setEntry(next);
    setError(false);
    if (next.length === 4) {
      verifyPin(next, data.settings.pin || '').then((ok) => {
        if (ok) {
          setTimeout(onUnlock, 100);
        } else {
          setTimeout(() => { setError(true); setEntry(''); }, 200);
        }
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <Text style={[styles.title, { color: palette.text }]}>Enter PIN</Text>
      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: error ? palette.danger : i < entry.length ? palette.primary : palette.surfaceAlt, borderColor: palette.border },
            ]}
          />
        ))}
      </View>
      {error && <Text style={[styles.error, { color: palette.danger }]}>Incorrect PIN</Text>}
      <View style={styles.pad}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) =>
          d === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable key={i} style={[styles.key, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={() => (d === '⌫' ? setEntry((e) => e.slice(0, -1)) : press(d))}>
              <Text style={[styles.keyText, { color: palette.text }]}>{d}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  dots: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
  error: { fontSize: 13, marginBottom: 16 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: 240, gap: 12 },
  key: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  keyText: { fontSize: 24, fontWeight: '600' },
});
