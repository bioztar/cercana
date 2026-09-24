// Pure logic: "Coming up" phrases for a person card and the spoken morning briefing.
// No React / RN imports so `node --test` can run it.
import { greeting, MONTHS, startOfDay, WEEKDAYS } from './dates.ts';

export type EventLite = {
  title: string;
  starts_at: string; // ISO timestamptz. All-day events are UTC midnight of their date.
  ends_at: string | null; // all-day: exclusive (UTC midnight of the day after the last day)
  all_day: boolean;
};

const DAY = 86_400_000;

/** Inclusive local calendar days the event covers, plus the real instants for timed events. */
export function eventSpan(e: EventLite): { firstDay: Date; lastDay: Date; start: Date; end: Date } {
  if (e.all_day) {
    const s = new Date(e.starts_at);
    const firstDay = new Date(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
    let lastDay = firstDay;
    if (e.ends_at) {
      const en = new Date(e.ends_at);
      const endExclusive = new Date(en.getUTCFullYear(), en.getUTCMonth(), en.getUTCDate());
      const last = new Date(endExclusive.getFullYear(), endExclusive.getMonth(), endExclusive.getDate() - 1);
      if (last > firstDay) lastDay = last;
    }
    const end = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1);
    return { firstDay, lastDay, start: firstDay, end };
  }
  const start = new Date(e.starts_at);
  let end = e.ends_at ? new Date(e.ends_at) : start;
  if (end < start) end = start;
  // An event ending exactly at midnight belongs to the previous day.
  const lastInstant = end > start ? new Date(end.getTime() - 1) : end;
  return { firstDay: startOfDay(start), lastDay: startOfDay(lastInstant), start, end };
}

const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

export function timeLabel(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

/** "Today", "Tomorrow", "Saturday", or "Saturday 3 October" for anything a week or more away. */
export function dayLabel(day: Date, today: Date): string {
  const n = daysBetween(startOfDay(today), day);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n > 1 && n < 7) return WEEKDAYS[day.getDay()];
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

/** dayLabel for mid-sentence use: "until today", "until Sunday". */
const untilLabel = (day: Date, today: Date) => {
  const l = dayLabel(day, today);
  return l === 'Today' || l === 'Tomorrow' ? l.toLowerCase() : l;
};

const isMultiDay = (span: { firstDay: Date; lastDay: Date }) => span.lastDay > span.firstDay;

/** Not over yet at `now`. */
export function isActive(e: EventLite, now: Date): boolean {
  const s = eventSpan(e);
  return e.all_day ? s.lastDay >= startOfDay(now) : s.end > now || (s.end.getTime() === s.start.getTime() && s.start >= now);
}

/** A multi-day event that has already started and is still running. */
export function isOngoing(e: EventLite, now: Date): boolean {
  const s = eventSpan(e);
  return isMultiDay(s) && s.firstDay <= startOfDay(now) && isActive(e, now);
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * A running multi-day event as a sentence (no final period):
 * "Anna is in London until Sunday" (titles starting "In "/"At "), else "Anna: Trip, until Sunday".
 */
export function ongoingSentence(title: string, owner: string | null, until: string): string {
  if (!owner) return `${title}, until ${until}`;
  return /^(in|at) /i.test(title) ? `${owner} is ${lowerFirst(title)} until ${until}` : `${owner}: ${title}, until ${until}`;
}

export function eventPhrase(e: EventLite, now: Date, owner: string | null = null): string {
  const s = eventSpan(e);
  const today = startOfDay(now);
  if (isOngoing(e, now)) return `${ongoingSentence(e.title, owner, untilLabel(s.lastDay, today))}.`;
  const until = isMultiDay(s) ? ` until ${untilLabel(s.lastDay, today)}` : '';
  const at = e.all_day ? '' : ` at ${timeLabel(s.start)}`;
  return `${dayLabel(s.firstDay, today)}${at}${until} — ${e.title}`;
}

export type ComingUp = { event: EventLite; phrase: string; ongoing: boolean };

/** Ongoing multi-day events first, then upcoming ones by start time. */
export function comingUp<T extends EventLite>(
  events: T[],
  now: Date,
  limit = 5,
  owner: string | null = null,
): (ComingUp & { event: T })[] {
  return events
    .filter((e) => isActive(e, now))
    .map((event) => ({ event, phrase: eventPhrase(event, now, owner), ongoing: isOngoing(event, now) }))
    .sort((a, b) => {
      if (a.ongoing !== b.ongoing) return a.ongoing ? -1 : 1;
      return eventSpan(a.event).start.getTime() - eventSpan(b.event).start.getTime();
    })
    .slice(0, limit);
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

export type BriefingEvent = EventLite & { owners?: string[] };

/** Owners to name in front of a title, or null when there are none / the title already names one. */
const ownerFor = (title: string, owners: string[] = []): string | null =>
  owners.length === 0 || owners.some((o) => title.toLowerCase().includes(o.toLowerCase()))
    ? null
    : owners.join(' and ');

const withOwner = (title: string, owners: string[] = []) => {
  const owner = ownerFor(title, owners);
  return owner ? `${owner}: ${title}` : title;
};

/** What is on today, as short spoken sentences. */
export function todaySentences(events: BriefingEvent[], now: Date, limit = 5): string[] {
  const today = startOfDay(now);
  return events
    .filter((e) => isActive(e, now))
    .filter((e) => {
      const s = eventSpan(e);
      return s.firstDay <= today && s.lastDay >= today;
    })
    .sort((a, b) => eventSpan(a).start.getTime() - eventSpan(b).start.getTime())
    .slice(0, limit)
    .map((e) => {
      const s = eventSpan(e);
      if (isMultiDay(s)) return `${ongoingSentence(e.title, ownerFor(e.title, e.owners), untilLabel(s.lastDay, today))}.`;
      const title = withOwner(e.title, e.owners);
      return e.all_day ? `Today, ${title}.` : `At ${timeLabel(s.start)}, ${title}.`;
    });
}

/**
 * The spoken morning briefing, in order: greeting + date, (1) Mom's own day (`leadLines`, e.g.
 * today's important events — see important.ts), (2) family news (today's/ongoing events of
 * others), (3) a birthday today/tomorrow, (4) new photos from the family.
 */
export function buildBriefing(input: {
  patientName: string;
  now: Date;
  events: BriefingEvent[];
  leadLines?: string[];
  birthdayPhrase?: string | null;
  newPhotosPhrase?: string | null;
}): string {
  const { patientName, now, events, leadLines, birthdayPhrase, newPhotosPhrase } = input;
  const parts = [
    `${greeting(now)} ${patientName}.`,
    `Today is ${WEEKDAYS[now.getDay()]} the ${ordinal(now.getDate())}.`,
    ...(leadLines ?? []),
    ...todaySentences(events, now),
  ];
  if (birthdayPhrase) parts.push(`${birthdayPhrase}.`);
  if (newPhotosPhrase) parts.push(`${newPhotosPhrase}.`);
  return parts.join(' ');
}

/** "You have 3 new photos from your family" — moments with a photo posted after `since`. */
export function newPhotosPhrase(count: number): string | null {
  if (count <= 0) return null;
  return `You have ${count} new photo${count === 1 ? '' : 's'} from your family`;
}

export function countNewPhotos(moments: { photo_url: string | null; created_at: string }[], since: Date | null): number {
  if (!since) return 0;
  return moments.filter((m) => !!m.photo_url && new Date(m.created_at) > since).length;
}

/** Short notification body: greeting + up to 2 lead-in items + the photo count, e.g.
 * "Good morning Maria — Rosa visits at nine, Anna is in London, 10 new photos". */
export function briefNotificationBody(patientName: string, items: string[], newPhotos: number): string {
  const lead = items
    .slice(0, 2)
    .map((s) => s.replace(/\.$/, ''))
    .join(', ');
  const photos = newPhotos > 0 ? `${newPhotos} new photo${newPhotos === 1 ? '' : 's'}` : '';
  const tail = [lead, photos].filter(Boolean).join(', ');
  return tail ? `Good morning ${patientName} — ${tail}` : `Good morning ${patientName}`;
}
