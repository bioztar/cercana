// Pure logic for the family-side "<patient> today" dashboard. No React / RN imports so
// `node --test` can run it. Composes cercana-care's important.ts rather than editing it.
import { hasNotAnswered, statusText } from './important.ts';
import type { Checkin, ImportantEvent } from './types.ts';

export type ImportantRow = { event: ImportantEvent; checkin: Checkin | null; status: string; urgent: boolean };

/** Every important event for the dashboard, most urgent first: unanswered-and-overdue, then
 * upcoming (soonest first), then waiting-for-an-answer, then answered (most recent first).
 *
 * Unlike `nextImportant` (which keeps only events not yet over — right for Mom's home, where a
 * past event has nothing left to show), the family dashboard must still surface an overdue,
 * unanswered check-in after its end time, or it silently disappears ("No important events yet"
 * for a Blood test that happened this morning and hasn't been answered). */
export function dashboardImportant(events: ImportantEvent[], checkins: Checkin[], now: Date): ImportantRow[] {
  const byEvent = new Map(checkins.map((c) => [c.important_event_id, c]));
  const rows: ImportantRow[] = events.map((event) => {
    const checkin = byEvent.get(event.id) ?? null;
    return { event, checkin, status: statusText(event, checkin, now), urgent: hasNotAnswered(event, checkin, now) };
  });

  const rank = (r: ImportantRow): 0 | 1 | 2 | 3 => {
    if (r.urgent) return 0;
    if (r.checkin) return 3; // answered
    if (new Date(r.event.starts_at) >= now) return 1; // upcoming
    return 2; // over, waiting on Mom (not yet at the re-ask/"hasn't answered" threshold)
  };

  return [...rows].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return ra === 3
      ? b.event.starts_at.localeCompare(a.event.starts_at) // answered: most recent first
      : a.event.starts_at.localeCompare(b.event.starts_at); // else: soonest first
  });
}
