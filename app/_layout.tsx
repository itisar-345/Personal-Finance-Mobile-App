import { useEffect, useMemo, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, View, ActivityIndicator, StyleSheet } from 'react-native';
import { StoreProvider, useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { Onboarding } from '@/components/Onboarding';
import { PinLock } from '@/components/PinLock';
import { buildReminderItems, scheduleRecurringNotifications } from '@/lib/notifications';

function Gate({ children }: { children: React.ReactNode }) {
  const { data, ready } = useStore();
  const palette = useTheme(data.settings);
  const [unlocked, setUnlocked] = useState(false);
  const appState = useRef(AppState.currentState);

  const dataRef = useRef(data);
  dataRef.current = data;

  // Only reschedule when something a reminder depends on changes, not on every edit.
  const reminderKey = useMemo(
    () => JSON.stringify({
      items: buildReminderItems(data),
      currency: data.settings.currencies.find((c) => c.code === data.settings.currencyCode) ?? data.settings.currencyCode,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.transactions, data.contributions, data.debts, data.investments, data.categories, data.settings.currencyCode, data.settings.currencies],
  );

  useEffect(() => {
    if (ready && data.settings.reminderEnabled) {
      scheduleRecurringNotifications(dataRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data.settings.reminderEnabled, reminderKey]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current === 'active' && next === 'background') {
        if (dataRef.current.settings.pinEnabled) setUnlocked(false);
      }
      if (next === 'active' && dataRef.current.settings.reminderEnabled) {
        scheduleRecurringNotifications(dataRef.current);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  if (!data.settings.onboarded) {
    return <Onboarding />;
  }

  if (data.settings.pinEnabled && !unlocked) {
    return <PinLock onUnlock={() => setUnlocked(true)} />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <StoreProvider>
      <Gate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </Gate>
    </StoreProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
