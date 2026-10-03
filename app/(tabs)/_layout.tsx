import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, ArrowLeftRight, Landmark, Target, Swords, Settings as SettingsIcon } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';

// Icon + label need ~58px of content height (icon, the item's own 5px padding, label). Below that the flex
// layout squeezes the label to a few pixels and it gets clipped. The inset is 0 on web (and some Android
// nav modes), so keep a minimum bottom padding as well.
const TAB_CONTENT_HEIGHT = 64;
const MIN_BOTTOM_PADDING = 10;

export default function TabLayout() {
  const { data } = useStore();
  const palette = useTheme(data.settings);
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, MIN_BOTTOM_PADDING);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: TAB_CONTENT_HEIGHT + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        // An explicit lineHeight stops the label box collapsing to ~9px (its text was cut off at the bottom).
        // Six tabs share a ~70px slot on a 420px-wide phone, so the label needs the full width: no horizontal
        // item padding, and a slightly smaller size so "Transactions" fits rather than truncating.
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarLabelStyle: { fontSize: 10, lineHeight: 14, marginTop: 2, marginBottom: 0 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ size, color }) => <LayoutDashboard size={size} color={color} /> }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions', tabBarIcon: ({ size, color }) => <ArrowLeftRight size={size} color={color} /> }} />
      <Tabs.Screen name="assets" options={{ title: 'Assets', tabBarIcon: ({ size, color }) => <Landmark size={size} color={color} /> }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals', tabBarIcon: ({ size, color }) => <Target size={size} color={color} /> }} />
      <Tabs.Screen name="quests" options={{ title: 'Quests', tabBarIcon: ({ size, color }) => <Swords size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ size, color }) => <SettingsIcon size={size} color={color} /> }} />
    </Tabs>
  );
}
