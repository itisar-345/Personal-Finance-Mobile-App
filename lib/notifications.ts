import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { AppData } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** ISO date string → next occurrence at 09:00 local time on or after today. */
function nextTriggerDate(dateStr: string, freq: 'monthly' | 'yearly' | 'weekly'): Date {
  const now = new Date();
  const base = new Date(dateStr);
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0, 0);
  if (freq === 'weekly') {
    while (d <= now) d.setDate(d.getDate() + 7);
  } else if (freq === 'monthly') {
    while (d <= now) d.setMonth(d.getMonth() + 1);
  } else {
    while (d <= now) d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

export async function scheduleRecurringNotifications(data: AppData): Promise<void> {
  if (Platform.OS === 'web') return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const items: { name: string; amount: number; freq: 'monthly' | 'yearly' | 'weekly'; date: string }[] = [];

  // Recurring transactions
  for (const t of data.transactions) {
    if (t.recurring === 'none' || t.status !== 'active') continue;
    const cat = data.categories.find((c) => c.id === t.categoryId);
    items.push({
      name: t.note || cat?.name || (t.type === 'income' ? 'Income' : 'Expense'),
      amount: t.amount,
      freq: t.recurring,
      date: t.date,
    });
  }

  // Recurring contributions (debts + investments)
  for (const c of data.contributions) {
    if (c.type !== 'recurring' || c.status !== 'active') continue;
    const freq = c.freq === 'quarterly' ? 'monthly' : (c.freq ?? 'monthly');
    const holding =
      data.debts.find((d) => d.id === c.holdingId) ||
      data.investments.find((i) => i.id === c.holdingId) ||
      data.assets.find((a) => a.id === c.holdingId);
    if (!holding || holding.status !== 'active') continue;
    items.push({ name: holding.name, amount: c.amount, freq, date: c.startDate });
  }

  for (const item of items) {
    const trigger = nextTriggerDate(item.date, item.freq);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'FinTrack — Payment Due',
        body: `${item.name}: ₹${item.amount.toLocaleString()} due today`,
        data: {},
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    });
  }
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
