// Push registration, local birthday reminders, and web Notification fallback.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerDevice } from './api';
import { parseBirthday, nextOccurrence, startOfDay } from './dates';
import { briefNotificationBody } from './briefing';
import { notificationPlan } from './important';
import type { BriefSettings, Checkin, ImportantEvent, Person, Ping, Role } from './types';

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
  const projectId = easProjectId();
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

export type NotificationStatus = {
  /** OS permission on this phone ('unsupported' = web without the Notification API). */
  permission: 'granted' | 'denied' | 'undetermined' | 'unsupported';
  /** Push (messages while the app is closed) needs an EAS projectId in app.json. */
  pushConfigured: boolean;
};

const easProjectId = () =>
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? null;

/** What the Settings "Notifications" card shows. Never prompts. */
export async function notificationStatus(): Promise<NotificationStatus> {
  if (!isNative) {
    const N = (globalThis as { Notification?: { permission: string } }).Notification;
    const p = N?.permission;
    return {
      permission: !N ? 'unsupported' : p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'undetermined',
      pushConfigured: false,
    };
  }
  const { status } = await Notifications.getPermissionsAsync();
  return {
    permission: status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined',
    pushConfigured: !!easProjectId(),
  };
}

/** "Turn on": asks the OS (once — after a denial only iPhone Settings can change it), then registers for push. */
export async function turnOnNotifications(circleId: string, role: Role): Promise<NotificationStatus> {
  if (!isNative) {
    const N = (globalThis as { Notification?: { requestPermission: () => Promise<string> } }).Notification;
    await N?.requestPermission().catch(() => undefined);
    return notificationStatus();
  }
  await Notifications.requestPermissionsAsync();
  await registerForPush(circleId, role);
  return notificationStatus();
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

/** Cancels only our own previously-scheduled notifications (by identifier prefix), leaving anything else alone. */
async function cancelByPrefix(prefix: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((s) => s.identifier.startsWith(prefix)).map((s) => Notifications.cancelScheduledNotificationAsync(s.identifier)),
  );
}

async function ensurePermission(): Promise<boolean> {
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status === 'granted') return true;
  return (await Notifications.requestPermissionsAsync()).status === 'granted';
}

/** Native: cancel + reschedule birthday reminders (day before 10:00, day of 09:00). */
export async function scheduleBirthdayReminders(people: Person[], now = new Date()): Promise<void> {
  if (!isNative) return;
  try {
    if (!(await ensurePermission())) return;
    await cancelByPrefix('bday-');
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
      for (const [i, [date, body]] of items.entries()) {
        if (date <= now) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: `bday-${p.id}-${i}`,
          content: { title: 'Birthday', body },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
        });
      }
    }
  } catch (e) {
    console.warn('scheduling birthday reminders failed', e);
  }
}

/** Native: cancel + reschedule reminders for upcoming important events (see important.ts). */
export async function scheduleImportantReminders(events: ImportantEvent[], checkins: Checkin[], now = new Date()): Promise<void> {
  if (!isNative) return;
  try {
    if (!(await ensurePermission())) return;
    await cancelByPrefix('imp-');
    for (const n of notificationPlan(events, checkins, now)) {
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: n.title, body: n.body, data: { impKind: n.kind, impEventId: n.eventId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at },
      });
    }
  } catch (e) {
    console.warn('scheduling important reminders failed', e);
  }
}

/** The important_event id to open MomCheck for, when a tapped notification was a check-in prompt. */
export function checkinEventFromNotificationData(data: unknown): string | null {
  const d = data as { impKind?: string; impEventId?: string } | undefined;
  return (d?.impKind === 'check' || d?.impKind === 're_ask') && d.impEventId ? d.impEventId : null;
}

/** Native: (re)schedules the daily morning-brief notification at `brief.brief_time`, cancelling
 * any previous one first. `items`/`newPhotos` are the caller's already-computed brief content
 * (see briefing.ts) — recompute and call again on app open, realtime changes, or a time edit. */
export async function scheduleMorningBrief(patientName: string, items: string[], newPhotos: number, brief: BriefSettings): Promise<void> {
  if (!isNative) return;
  try {
    await cancelByPrefix('brief-');
    if (!brief.brief_enabled) return;
    if (!(await ensurePermission())) return;
    const [hour, minute] = brief.brief_time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: 'brief-daily',
      content: { title: 'Good morning', body: briefNotificationBody(patientName, items, newPhotos), data: { brief: true } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
  } catch (e) {
    console.warn('scheduling morning brief failed', e);
  }
}

/** True when a tapped notification was the daily morning brief (tapping it speaks the full brief). */
export function isBriefNotificationData(data: unknown): boolean {
  return (data as { brief?: boolean } | undefined)?.brief === true;
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

/** An arrival (new moment/comment) so it shows even if the app is on another screen or just
 * backgrounded. Native: fires immediately. Web: same as the ping fallback above. */
export async function notifyArrival(title: string, body: string): Promise<void> {
  if (!isNative) {
    showWebNotification(title, body);
    return;
  }
  try {
    if (!(await ensurePermission())) return;
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch (e) {
    console.warn('arrival notification failed', e);
  }
}
