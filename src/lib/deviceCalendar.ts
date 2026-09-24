// Pure mapping from expo-calendar's Event shape to our `events` upsert rows. No expo-calendar
// import here (so `node --test` can run it) — screens/api.real.ts pass in plain objects.
import type { DeviceEventRow } from './types.ts';

export type DeviceCalendarEvent = {
  id: string;
  title: string | null;
  location: string | null;
  startDate: string | Date;
  endDate: string | Date | null;
  allDay?: boolean | null;
};

const toIso = (d: string | Date) => (d instanceof Date ? d : new Date(d)).toISOString();

/** `uid` = device event id, stable across syncs so re-runs upsert instead of duplicating. */
export function toEventRow(e: DeviceCalendarEvent): DeviceEventRow {
  return {
    uid: e.id,
    title: e.title,
    location: e.location,
    starts_at: toIso(e.startDate),
    ends_at: e.endDate ? toIso(e.endDate) : null,
    all_day: !!e.allDay,
  };
}

/** Maps and drops events with no id (defensive — expo-calendar always sets one). */
export function toEventRows(events: DeviceCalendarEvent[]): DeviceEventRow[] {
  return events.filter((e) => !!e.id).map(toEventRow);
}
