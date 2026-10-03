import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useUi } from './ui';
import { useStore } from '../lib/store';
import { verifyPin } from '../lib/crypto';
import { loadPinHash } from '../lib/pinStorage';

const FREE_ATTEMPTS = 4;
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;

/** Lockout after the free attempts are used: 30s, then doubling per further miss, capped at 15 minutes. */
function lockDuration(failedAttempts: number): number {
  return Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** Math.max(0, failedAttempts - FREE_ATTEMPTS - 1));
}

export function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const { palette } = useUi();
  const { data, updateSettings } = useStore();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    loadPinHash().then(setHash);
  }, []);

  const lockedUntil = data.settings.pinLockedUntil ?? 0;
  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = secondsLeft > 0;

  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [locked]);

  const press = (d: string) => {
    if (locked || checking || hash === null || entry.length >= 4) return;
    const next = entry + d;
    setEntry(next);
    setError(false);
    if (next.length < 4) return;

    setChecking(true);
    verifyPin(next, hash || '')
      .then((ok) => {
        if (ok) {
          updateSettings({ pinFailedAttempts: 0, pinLockedUntil: null });
          onUnlock();
          return;
        }
        const failed = (data.settings.pinFailedAttempts ?? 0) + 1;
        const lockMs = failed > FREE_ATTEMPTS ? lockDuration(failed) : 0;
        updateSettings({ pinFailedAttempts: failed, pinLockedUntil: lockMs ? Date.now() + lockMs : null });
        setNow(Date.now());
        setError(true);
        setEntry('');
      })
      .finally(() => setChecking(false));
  };

  // Let keyboard users type the PIN on web instead of tabbing through the on-screen keypad.
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === 'Backspace') setEntry((x) => x.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">Enter PIN</Text>
      <View style={styles.dots} accessible accessibilityLabel={`${entry.length} of 4 digits entered`}>
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
      {locked ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { color: palette.danger }]}>Too many attempts. Try again in {secondsLeft}s.</Text>
      ) : error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { color: palette.danger }]}>Incorrect PIN</Text>
      ) : null}
      <View style={styles.pad}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) =>
          d === '' ? (
            <View key={i} style={styles.keyEmpty} />
          ) : (
            <Pressable key={i} disabled={locked || (d !== '⌫' && hash === null)} accessibilityRole="button" accessibilityLabel={d === '⌫' ? 'Delete digit' : d} style={[styles.key, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={() => (d === '⌫' ? setEntry((e) => e.slice(0, -1)) : press(d))}>
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
  keyEmpty: { width: 64, height: 64 },
  keyText: { fontSize: 24, fontWeight: '600' },
});
