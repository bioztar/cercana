// Pure logic for important events: reminder times, next due, status text, notification plan.
// No React / RN imports so `node --test` can run it.
import { dayLabel, timeLabel } from './briefing.ts';
import { startOfDay } from './dates.ts';
import type { Checkin, CheckinAnswer, ImportantEvent, Reminder, ReminderKind } from './types.ts';

const HOUR = 3_600_000;
const CHECK_WINDOW = 24 * HOUR; // a check-in stops nagging a day after it came due
const MAX_SCHEDULED = 40; // iOS keeps at most 64 local notifications; birthdays use the rest

/** Evening before 20:00, on the day 2 h before the start, check-in 2 h after the end (or start). */
export function defaultReminders(start: Date, end: Date | null): Reminder[] {
  const eveningBefore = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1, 20, 0);
  const onDay = new Date(start.getTime() - 2 * HOUR);
  const check = new Date((end && end > start ? end : start).getTime() + 2 * HOUR);
  return [
    { kind: 'evening_before', at: eveningBefore.toISOString() },
    { kind: 'on_day', at: onDay.toISOString() },
    { kind: 'check', at: check.toISOString() },
  ];
}

const endOf = (e: ImportantEvent) => new Date(e.ends_at ?? e.starts_at);

/** The next important event that is not over yet. */
export function nextImportant(events: ImportantEvent[], now: Date): ImportantEvent | null {
  const open = events
    .filter((e) => endOf(e) >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return open[0] ?? null;
}

/** Earliest event whose check-in time has passed (within a day) and that Mom has not answered. */
export function dueCheckin(events: ImportantEvent[], checkins: Checkin[], now: Date): ImportantEvent | null {
  const answered = new Set(checkins.map((c) => c.important_event_id));
  const due = events
    .filter((e) => !answered.has(e.id))
    .map((e) => ({ e, at: e.reminders.find((r) => r.kind === 'check')?.at }))
    .filter((x): x is { e: ImportantEvent; at: string } => !!x.at)
    .filter((x) => {
      const t = new Date(x.at).getTime();
      return t <= now.getTime() && now.getTime() - t < CHECK_WINDOW;
    })
    .sort((a, b) => a.at.localeCompare(b.at));
  return due[0]?.e ?? null;
}

/** "Tomorrow at 10:30 am" — lower-cased mid-sentence by the callers. */
export function whenPhrase(e: ImportantEvent, now: Date): string {
  const s = new Date(e.starts_at);
  return `${dayLabel(startOfDay(s), now)} at ${timeLabel(s)}`;
}

/** Patient home card text: "Cardiologist appointment, Tomorrow at 10:30 am". */
export function cardText(e: ImportantEvent, now: Date): string {
  return `${e.title}, ${whenPhrase(e, now)}`;
}

/** Spoken in the morning briefing; null when the event is more than a week away. */
export function importantPhrase(e: ImportantEvent | null, now: Date): string | null {
  if (!e) return null;
  const days = Math.round((startOfDay(new Date(e.starts_at)).getTime() - startOfDay(now).getTime()) / (24 * HOUR));
  if (days > 7) return null;
  const when = whenPhrase(e, now);
  return `Important: ${e.title}, ${when.charAt(0).toLowerCase()}${when.slice(1)}`;
}

/** "Did you go to the doctor?" for medical titles, a plain "Did you go?" otherwise. */
export function checkQuestion(title: string): string {
  if (/dentist/i.test(title)) return 'Did you go to the dentist?';
  if (/doctor|cardiolog|physician|clinic|hospital|check-?up|appointment/i.test(title)) return 'Did you go to the doctor?';
  return 'Did you go?';
}

export const ANSWER_LABEL: Record<CheckinAnswer, string> = {
  went: 'Yes, I went',
  missed: "No, I couldn't make it",
  rescheduled: 'It was rescheduled',
};

/** Family-side headline for the answer, e.g. "Mom went". */
export function answerHeadline(a: CheckinAnswer, who = 'Mom'): string {
  return { went: `${who} went`, missed: `${who} couldn't make it`, rescheduled: 'It was rescheduled' }[a];
}

export const REMINDER_LABEL: Record<ReminderKind, string> = {
  evening_before: 'The evening before',
  on_day: 'On the day',
  check: '"Did you go?" question',
};

export type Delivery = 'delivered' | 'scheduled';
export const deliveryOf = (r: Reminder, now: Date): Delivery => (new Date(r.at) <= now ? 'delivered' : 'scheduled');

/** One line for the family status screen. */
export function statusText(e: ImportantEvent, checkin: Checkin | null, now: Date): string {
  if (checkin) return answerHeadline(checkin.answer);
  const check = e.reminders.find((r) => r.kind === 'check');
  if (check && new Date(check.at) <= now) return 'Waiting for Mom’s answer';
  return 'Reminders are set';
}

export type PlannedNotification = {
  id: string; // stable, prefixed `imp-`, so re-scheduling only touches our own
  at: Date;
  title: string;
  body: string;
  kind: ReminderKind;
  eventId: string;
};

/** Future reminders of unanswered events, soonest first, capped for the iOS notification limit. */
export function notificationPlan(events: ImportantEvent[], checkins: Checkin[], now: Date): PlannedNotification[] {
  const answered = new Set(checkins.map((c) => c.important_event_id));
  const out: PlannedNotification[] = [];
  for (const e of events) {
    if (answered.has(e.id)) continue;
    for (const r of e.reminders) {
      const at = new Date(r.at);
      if (at <= now) continue;
      const when = whenPhrase(e, at); // relative to when the reminder fires
      const [title, body] =
        r.kind === 'evening_before' ? [`Tomorrow: ${e.title}`, `${e.title}, ${when}. Reminder from your family.`]
        : r.kind === 'on_day' ? [`Today: ${e.title}`, `${e.title}, ${when.replace(/^Today/, 'today')}.`]
        : [checkQuestion(e.title), 'Your family will see your answer.'];
      out.push({ id: `imp-${e.id}-${r.kind}`, at, title, body, kind: r.kind, eventId: e.id });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED);
}
