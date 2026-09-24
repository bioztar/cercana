// Pure date logic for birthdays. No React / RN imports so `node --test` can run it.

export type Birthday = { month: number; day: number; year: number | null };

const UNKNOWN_YEAR_BELOW = 1000; // a stored year < 1000 (e.g. 0004-02-29) means "year unknown"

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function parseBirthday(iso: string | null | undefined): Birthday | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day, year: year < UNKNOWN_YEAR_BELOW ? null : year };
}

export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Local-midnight date of the birthday in `year`; Feb 29 → Feb 28 in non-leap years. */
function occurrenceIn(b: Birthday, year: number): Date {
  const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day;
  return new Date(year, b.month - 1, day);
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Next occurrence on or after `today` (local midnight). */
export function nextOccurrence(b: Birthday, today: Date): Date {
  const t = startOfDay(today);
  const thisYear = occurrenceIn(b, t.getFullYear());
  return thisYear >= t ? thisYear : occurrenceIn(b, t.getFullYear() + 1);
}

export function daysUntil(b: Birthday, today: Date): number {
  const t = startOfDay(today);
  const next = nextOccurrence(b, t);
  // Round: DST shifts make the raw difference 23h/25h.
  return Math.round((next.getTime() - t.getTime()) / 86_400_000);
}

/** Age they turn on the next occurrence, or null when the birth year is unknown. */
export function ageTurning(b: Birthday, today: Date): number | null {
  if (b.year === null) return null;
  return nextOccurrence(b, today).getFullYear() - b.year;
}

export function formatDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Today is Lucia's birthday", "Tomorrow is …", "On Saturday it is …", "On 3 October it is …". */
export function birthdayPhrase(name: string, days: number, today: Date, b?: Birthday): string {
  const owner = `${name}'s birthday`;
  const age = b ? ageTurning(b, today) : null;
  const tail = age !== null && age > 0 ? `, ${age} years old` : '';
  if (days === 0) return `Today is ${owner}${tail}`;
  if (days === 1) return `Tomorrow is ${owner}${tail}`;
  const when = new Date(startOfDay(today).getTime());
  when.setDate(when.getDate() + days);
  const label = days < 7 ? WEEKDAYS[when.getDay()] : `${when.getDate()} ${MONTHS[when.getMonth()]}`;
  return `On ${label} it is ${owner}${tail}`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** "3 days ago" style, for moments. */
export function timeAgo(from: Date, now: Date): string {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(from).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/** Nearest upcoming birthday within `withinDays`, across many people. */
export function upcomingBirthday<T extends { birthday: string | null }>(
  people: T[],
  today: Date,
  withinDays = 7,
): { person: T; days: number; birthday: Birthday } | null {
  let best: { person: T; days: number; birthday: Birthday } | null = null;
  for (const person of people) {
    const birthday = parseBirthday(person.birthday);
    if (!birthday) continue;
    const days = daysUntil(birthday, today);
    if (days <= withinDays && (!best || days < best.days)) best = { person, days, birthday };
  }
  return best;
}
