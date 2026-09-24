// Push registration, local birthday reminders, and web Notification fallback.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerDevice } from './api';
import { parseBirthday, nextOccurrence, startOfDay } from './dates';
import type { Person, Ping, Role } from './types';

const isNative = Platform.OS !== 'web';
let warnedNoProject = false;

export function initNotifications(): void {
  if (!isNative) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Native: ask permission, get Expo push token, store in `devices`. Skips quietly without an EAS projectId. */
export async function registerForPush(circleId: string, role: Role): Promise<void> {
  if (!isNative || !Device.isDevice) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) {
    if (!warnedNoProject) {
      warnedNoProject = true;
      console.log('[cercana] push disabled: no EAS projectId in app config (extra.eas.projectId)');
    }
    return;
  }
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await registerDevice(circleId, role, token, Platform.OS);
  } catch (e) {
    console.warn('push registration failed', e);
  }
}

/** Ping payload carried in the push `data`, so a tap can open the overlay. */
export function pingFromNotificationData(data: unknown): Ping | null {
  const d = data as Partial<Ping> | undefined;
  if (!d || typeof d.message !== 'string' || typeof d.id !== 'string') return null;
  return {
    id: d.id,
    circle_id: d.circle_id ?? '',
    from_name: d.from_name ?? null,
    person_id: d.person_id ?? null,
    message: d.message,
    created_at: d.created_at ?? new Date().toISOString(),
  };
}

/** Native: cancel + reschedule birthday reminders (day before 10:00, day of 09:00). */
export async function scheduleBirthdayReminders(people: Person[], now = new Date()): Promise<void> {
  if (!isNative) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') {
      if ((await Notifications.requestPermissionsAsync()).status !== 'granted') return;
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const p of people) {
      const b = parseBirthday(p.birthday);
      if (!b) continue;
      const day = nextOccurrence(b, startOfDay(now));
      const before = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 10, 0);
      const on = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
      const who = p.relation ? `${p.name}, ${p.relation}` : p.name;
      const items: [Date, string][] = [
        [before, `Tomorrow is ${p.name}'s birthday`],
        [on, `Today is ${p.name}'s birthday (${who})`],
      ];
      for (const [date, body] of items) {
        if (date <= now) continue;
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Birthday', body },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
        });
      }
    }
  } catch (e) {
    console.warn('scheduling birthday reminders failed', e);
  }
}

export function requestWebNotificationPermission(): void {
  if (Platform.OS !== 'web' || typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') void Notification.requestPermission();
}

/** Web: show a system notification when the tab is hidden. */
export function showWebNotification(title: string, body: string): void {
  if (Platform.OS !== 'web' || typeof Notification === 'undefined') return;
  if (typeof document !== 'undefined' && !document.hidden) return;
  if (Notification.permission === 'granted') new Notification(title, { body });
}
