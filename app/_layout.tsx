import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { StoreProvider, useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { Onboarding } from '@/components/Onboarding';
import { PinLock } from '@/components/PinLock';
import { scheduleRecurringNotifications } from '@/lib/notifications';

function Gate({ children }: { children: React.ReactNode }) {
  const { data, ready } = useStore();
  const palette = useTheme(data.settings);
  const [unlocked, setUnlocked] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (ready && data.settings.reminderEnabled) {
      scheduleRecurringNotifications(data);
    }
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current === 'active' && next.match(/inactive|background/)) {
        if (data.settings.pin) setUnlocked(false);
      }
      if (next === 'active' && data.settings.reminderEnabled) {
        scheduleRecurringNotifications(data);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [ready, data.settings.pin, data.settings.reminderEnabled, data]);

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

  if (data.settings.pin && !unlocked) {
    return <PinLock onUnlock={() => setUnlocked(true)} />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  useFrameworkReady();

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
