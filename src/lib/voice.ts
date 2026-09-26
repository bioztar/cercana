// Pure helpers for Mom's voice flows. No React / RN imports.
import type { AssistantProposal, Comment, CommentSummary, EventRow, NewEventInput } from './types';
import { MONTHS, startOfDay } from './dates.ts';

const DAY = 86_400_000;

export type QuickWhen = 'this-weekend' | 'next-weekend';
export type DayRange = { first: Date; last: Date }; // local days, inclusive

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * The Saturday–Sunday of "this weekend" (offset 0) or "next weekend" (offset 1).
 * On a Saturday or Sunday, "this weekend" is the one already under way, starting today only if today is Saturday.
 */
export function weekendRange(today: Date, offset: 0 | 1): DayRange {
  const t = startOfDay(today);
  const dow = t.getDay(); // 0 Sun … 6 Sat
  const sat = dow === 0 ? addDays(t, -1) : addDays(t, (6 - dow + 7) % 7);
  const first = addDays(sat, 7 * offset);
  return { first, last: addDays(first, 1) };
}

export const singleDay = (d: Date): DayRange => ({ first: startOfDay(d), last: startOfDay(d) });

/** "26–27 Sep", "30 Sep – 1 Oct" or "24 Sep". */
export function rangeLabel(r: DayRange): string {
  const mon = (d: Date) => MONTHS[d.getMonth()].slice(0, 3);
  if (r.first.getTime() === r.last.getTime()) return `${r.first.getDate()} ${mon(r.first)}`;
  if (r.first.getMonth() === r.last.getMonth()) return `${r.first.getDate()}–${r.last.getDate()} ${mon(r.first)}`;
  return `${r.first.getDate()} ${mon(r.first)} – ${r.last.getDate()} ${mon(r.last)}`;
}

/** All-day event span the way the ICS sync stores it: UTC midnight of the first day, exclusive UTC midnight after the last. */
export function allDaySpan(r: DayRange): { starts_at: string; ends_at: string } {
  const utc = (d: Date, plus = 0) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + plus)).toISOString();
  return { starts_at: utc(r.first), ends_at: utc(r.last, 1) };
}

/** A month laid out Monday-first: leading nulls pad the first week. */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))];
}

/** Events close to today (2 days back to 5 days ahead), one row per real event, soonest first. */
export function nearbyEvents(events: EventRow[], now: Date): EventRow[] {
  const from = startOfDay(now).getTime() - 2 * DAY;
  const to = startOfDay(now).getTime() + 6 * DAY;
  const seen = new Set<string>();
  return [...events]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .filter((e) => {
      const t = new Date(e.starts_at).getTime();
      const key = `${e.uid}|${e.starts_at}`;
      if (t < from || t >= to || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Per moment: how many comments and the newest one. */
export function summarizeComments(comments: Comment[]): Record<string, CommentSummary> {
  const out: Record<string, CommentSummary> = {};
  for (const c of comments) {
    const prev = out[c.moment_id];
    out[c.moment_id] = {
      count: (prev?.count ?? 0) + 1,
      last: !prev || c.created_at > prev.last.created_at ? c : prev.last,
    };
  }
  return out;
}

/** What a comment reads as in a preview line: its text, else "Voice message". */
export const commentText = (c: Pick<Comment, 'body' | 'audio_url'>): string =>
  c.body?.trim() || (c.audio_url ? 'Voice message' : '');

export const deviceTz = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';

/** What the events table stores for an assistant proposal. `events` has no note column, so a note
 * rides along in the title: "Cardiology (bring the blood test)". */
export function proposalToEvent(p: AssistantProposal): NewEventInput {
  const title = p.note?.trim() ? `${p.title} (${p.note.trim()})` : p.title;
  const ends = p.ends_at ?? new Date(new Date(p.starts_at).getTime() + (p.all_day ? DAY : 3_600_000)).toISOString();
  return { title, starts_at: p.starts_at, ends_at: ends, all_day: !!p.all_day, location: p.location ?? null };
}

/** A short title from a spoken sentence: first clause, sentence case, capped. */
export function titleFromTranscript(t: string, max = 60): string {
  const clean = t.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  if (!clean) return '';
  const cut = clean.length > max ? `${clean.slice(0, max).replace(/\s+\S*$/, '')}…` : clean;
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}
