import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { AppData } from './types';

const REMINDER_CHANNEL_ID = 'payment-reminders';
type ReminderFrequency = 'monthly' | 'yearly' | 'weekly' | 'quarterly';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Android requires a channel before scheduled alerts can be presented. */
export async function initializeNotifications(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Payment reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  await initializeNotifications();
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

/** A repeating native trigger, so reminders continue even while the app is closed. */
function recurringNotificationTrigger(
  dateStr: string,
  freq: 'monthly' | 'yearly' | 'weekly',
): Notifications.NotificationTriggerInput {
  const [, month, day] = dateStr.split('-').map(Number);
  if (freq === 'weekly') {
    const weekday = new Date(`${dateStr}T00:00:00`).getDay() + 1; // Expo: Sunday = 1
    return { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: 9, minute: 0 };
  }
  if (Platform.OS === 'ios') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      repeats: true,
      ...(freq === 'monthly' ? { day } : { month: month - 1, day }),
      hour: 9,
      minute: 0,
    };
  }
  return freq === 'monthly'
    ? { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day, hour: 9, minute: 0 }
    : { type: Notifications.SchedulableTriggerInputTypes.YEARLY, month: month - 1, day, hour: 9, minute: 0 };
}

function recurringNotificationTriggers(dateStr: string, freq: ReminderFrequency): Notifications.NotificationTriggerInput[] {
  if (freq !== 'quarterly') return [recurringNotificationTrigger(dateStr, freq)];
  const [year, month, day] = dateStr.split('-').map(Number);
  return [0, 3, 6, 9].map((offset) => {
    const nextMonth = ((month - 1 + offset) % 12) + 1;
    const lastDay = new Date(year, nextMonth, 0).getDate();
    const nextDate = `${year}-${String(nextMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
    return recurringNotificationTrigger(nextDate, 'yearly');
  });
}

export async function scheduleRecurringNotifications(data: AppData): Promise<void> {
  if (Platform.OS === 'web') return;

  await initializeNotifications();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const items: { name: string; amount: number; freq: ReminderFrequency; date: string }[] = [];

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
    const freq = c.freq ?? 'monthly';
    const holding =
      data.debts.find((d) => d.id === c.holdingId) ||
      data.investments.find((i) => i.id === c.holdingId) ||
      data.assets.find((a) => a.id === c.holdingId);
    if (!holding || holding.status !== 'active') continue;
    items.push({ name: holding.name, amount: c.amount, freq, date: c.startDate });
  }

  for (const item of items) {
    for (const baseTrigger of recurringNotificationTriggers(item.date, item.freq)) {
      const trigger = {
        ...baseTrigger,
        ...(Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL_ID } : {}),
      } as Notifications.NotificationTriggerInput;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'FinTrack — Payment Due',
          body: `${item.name}: ₹${item.amount.toLocaleString()} due today`,
          data: {},
        },
        trigger,
      });
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
