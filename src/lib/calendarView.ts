// Pure view logic for the Calendar and EventDetail screens and the feed's event chip.
// No React / RN imports so `node --test` can run it.
import { eventSpan } from './briefing.ts';
import { MONTHS, nextOccurrence, parseBirthday, startOfDay, WEEKDAYS } from './dates.ts';
import type { EventRow, Moment, Person } from './types.ts';

export type AgendaItem = {
  key: string;
  kind: 'event' | 'birthday';
  title: string;
  firstDay: Date; // local calendar days the item covers (inclusive)
  lastDay: Date;
  allDay: boolean;
  start: Date;
  personIds: string[]; // who is involved
  location: string | null;
  eventId?: string;
};

const DAY = 86_400_000;
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const sameDay = (a: Date, b: Date) => daysBetween(startOfDay(a), startOfDay(b)) === 0;

/** Events and birthdays that touch [from, to] (local days), earliest first. The same event on several calendars is one row. */
export function agenda(events: EventRow[], people: Person[], from: Date, to: Date): AgendaItem[] {
  const f = startOfDay(from);
  const t = startOfDay(to);
  const merged = new Map<string, AgendaItem>();
  for (const e of events) {
    const span = eventSpan({ title: e.title ?? '', starts_at: e.starts_at, ends_at: e.ends_at, all_day: e.all_day });
    if (span.lastDay < f || span.firstDay > t) continue;
    const key = `${e.uid}|${e.starts_at}`;
    const prev = merged.get(key);
    merged.set(key, {
      ...(prev ?? {
        key, kind: 'event' as const, title: e.title ?? '(no title)', firstDay: span.firstDay, lastDay: span.lastDay,
        allDay: e.all_day, start: span.start, location: e.location, eventId: e.id,
      }),
      personIds: [...new Set([...(prev?.personIds ?? []), ...e.person_ids])],
    });
  }
  const items = [...merged.values()];
  for (const p of people) {
    const b = parseBirthday(p.birthday);
    if (!b) continue;
    const day = nextOccurrence(b, f);
    if (day > t) continue;
    items.push({
      key: `bday|${p.id}|${day.getFullYear()}`, kind: 'birthday', title: `${p.name}’s birthday`, firstDay: day,
      lastDay: day, allDay: true, start: day, personIds: [p.id], location: null,
    });
  }
  return items.sort((a, b) => a.firstDay.getTime() - b.firstDay.getTime() || a.start.getTime() - b.start.getTime());
}

/** "Tomorrow, Friday, September 25" · "Saturday, September 27" · "Today, …". */
export function dayHeading(day: Date, today: Date): string {
  const n = daysBetween(startOfDay(today), startOfDay(day));
  const long = `${WEEKDAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}`;
  return n === 0 ? `Today, ${long}` : n === 1 ? `Tomorrow, ${long}` : long;
}

export type AgendaGroup = { key: string; heading: string; items: AgendaItem[] };

/** Groups by the first day still to come (an event already under way lists under today). */
export function groupByDay(items: AgendaItem[], today: Date): AgendaGroup[] {
  const t = startOfDay(today);
  const groups: AgendaGroup[] = [];
  for (const it of items) {
    const day = it.firstDay < t ? t : it.firstDay;
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(it);
    else groups.push({ key, heading: dayHeading(day, t), items: [it] });
  }
  return groups;
}

const SHORT_DAY = WEEKDAYS.map((d) => d.slice(0, 3).toUpperCase());

/** Date tile text: "FRI" / "25", or "SAT–SUN" / "3–4" for a span. */
export function dateTile(it: Pick<AgendaItem, 'firstDay' | 'lastDay'>): { top: string; bottom: string } {
  if (sameDay(it.firstDay, it.lastDay)) return { top: SHORT_DAY[it.firstDay.getDay()], bottom: String(it.firstDay.getDate()) };
  return {
    top: `${SHORT_DAY[it.firstDay.getDay()]}–${SHORT_DAY[it.lastDay.getDay()]}`,
    bottom: `${it.firstDay.getDate()}–${it.lastDay.getDate()}`,
  };
}

/** Long date for headers: "Thursday, September 24". */
export function longDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const involves = (it: AgendaItem, m: Pick<Moment, 'person_id' | 'author_person_id'>) =>
  (!!m.person_id && it.personIds.includes(m.person_id)) ||
  (!!m.author_person_id && it.personIds.includes(m.author_person_id));

/** Moments that belong to an event: posted on one of its days, by or about someone involved. */
export function eventMoments(it: AgendaItem, moments: Moment[]): Moment[] {
  return moments.filter((m) => {
    const d = new Date(m.created_at);
    return startOfDay(d) >= it.firstDay && startOfDay(d) <= it.lastDay && involves(it, m);
  });
}

/** The event a moment is linked to (for the feed chip), by the same day + person rule.
 * Several events can match (e.g. a multi-day family calendar plus a same-day outing); prefer the
 * one the moment is *about* over one it only shares an author with, then the shortest (most
 * specific) span. */
export function momentEvent(m: Moment, items: AgendaItem[]): AgendaItem | null {
  const d = startOfDay(new Date(m.created_at));
  const candidates = items.filter((it) => it.kind === 'event' && d >= it.firstDay && d <= it.lastDay && involves(it, m));
  const rank = (it: AgendaItem) => {
    const about = !!m.person_id && it.personIds.includes(m.person_id) ? 0 : 1;
    const span = daysBetween(it.firstDay, it.lastDay);
    return about * 1000 + span;
  };
  return candidates.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}
