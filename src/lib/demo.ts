// In-memory fixtures behind EXPO_PUBLIC_DEMO=1 (see api.ts). Same signatures as api.real.ts.
// State is replaced, never mutated. Nothing here runs unless the flag is set.
import type {
  CalendarPublic, Circle, EventRow, Moment, MomentInput, Person, PersonInput, Ping, Session,
} from './types';
import type { FeedHandlers } from './api.real';
import { normalizeCode, urlHint, uuidv4 } from './util';

const CIRCLE: Circle = { id: 'demo-circle', code: 'K7M4QX', patient_name: 'Maria' };

const DAY = 86_400_000;
const now = () => new Date();
const isoDaysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
const utcDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const tomorrow = addDays(now(), 1);
const untilSunday = (7 - now().getDay()) % 7; // days from today to the coming Sunday (0 if today is Sunday)

const person = (id: string, name: string, relation: string, extra: Partial<Person> = {}): Person => ({
  id, circle_id: CIRCLE.id, name, relation, phone: '+34600000000', photo_url: null, birthday: null, ...extra,
});

let people: Person[] = [
  person('anna', 'Anna', 'your daughter', { birthday: '1975-03-05' }),
  person('pedro', 'Pedro', 'your son', { birthday: '1978-11-20' }),
  person('lucia', 'Lucia', 'your granddaughter', {
    birthday: `2010-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`,
  }),
  person('carmen', 'Carmen', 'your sister', { birthday: '1950-07-14' }),
];

const moment = (id: string, person_id: string, author: string, body: string, days: number): Moment => ({
  id, circle_id: CIRCLE.id, person_id, author, body, photo_url: null, audio_url: null, created_at: isoDaysAgo(days),
});

let moments: Moment[] = [
  moment('m1', 'pedro', 'Pedro', 'I called from work. I will visit you on Sunday and bring the cake.', 1),
  moment('m2', 'lucia', 'Anna', 'Lucia got a nine in her maths exam!', 2),
  moment('m3', 'anna', 'Anna', 'We had lunch at the beach. You loved the paella.', 3),
];

let calendars: CalendarPublic[] = [
  {
    id: 'cal-anna', circle_id: CIRCLE.id, label: "Anna's calendar", url_hint: '…/basic.ics',
    last_synced_at: isoDaysAgo(0.003), last_error: null, person_ids: ['anna'],
  },
  {
    id: 'cal-family', circle_id: CIRCLE.id, label: 'Family', url_hint: 'calendar.google.com',
    last_synced_at: isoDaysAgo(0.003), last_error: null, person_ids: ['pedro', 'lucia'],
  },
];

const at = (d: Date, h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0).toISOString();
const event = (id: string, calendar_id: string, title: string, starts: string, ends: string, all_day: boolean, location: string | null = null) =>
  ({ id, calendar_id, uid: id, title, location, starts_at: starts, ends_at: ends, all_day });

const rawEvents = [
  event('e1', 'cal-anna', 'In London', utcDay(now()).toISOString(), utcDay(addDays(now(), untilSunday + 1)).toISOString(), true),
  event('e2', 'cal-anna', 'Dentist', at(tomorrow, 16), at(tomorrow, 17), false, 'Calle Mayor 1'),
  event('e3', 'cal-family', 'Family lunch', at(addDays(now(), untilSunday || 7), 14), at(addDays(now(), untilSunday || 7), 16), false, "Pedro's house"),
];

// ---- feed (stands in for Supabase realtime) ------------------------------------------------------
let listeners: FeedHandlers[] = [];
const emitChange = () => listeners.forEach((l) => l.onChange?.());

export function subscribeCircle(_circleId: string, h: FeedHandlers): () => void {
  listeners = [...listeners, h];
  return () => { listeners = listeners.filter((l) => l !== h); };
}

// ---- api surface ---------------------------------------------------------------------------------
export async function createCircle(patientName: string): Promise<Circle> {
  return { ...CIRCLE, patient_name: patientName };
}

export async function findCircleByCode(input: string): Promise<Circle | null> {
  return normalizeCode(input).length === 6 ? CIRCLE : null;
}

export async function listPeople(_circleId: string): Promise<Person[]> {
  return [...people].sort((a, b) => a.name.localeCompare(b.name));
}

export async function savePerson(circleId: string, p: PersonInput): Promise<Person> {
  const saved: Person = { ...p, id: p.id ?? uuidv4(), circle_id: circleId };
  people = p.id ? people.map((x) => (x.id === p.id ? saved : x)) : [...people, saved];
  emitChange();
  return saved;
}

export async function deletePerson(id: string): Promise<void> {
  people = people.filter((p) => p.id !== id);
  emitChange();
}

export async function listMoments(_circleId: string, personId?: string, limit = 50): Promise<Moment[]> {
  return moments
    .filter((m) => !personId || m.person_id === personId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function addMoment(circleId: string, m: MomentInput): Promise<void> {
  moments = [...moments, { ...m, id: uuidv4(), circle_id: circleId, created_at: new Date().toISOString() }];
  emitChange();
}

/** Demo has no storage bucket: the local/blob URI is used directly for this session. */
export async function uploadMedia(uri: string, _kind: 'photo' | 'audio'): Promise<string> {
  return uri;
}

export async function sendPing(circleId: string, fromName: string, message: string): Promise<void> {
  const ping: Ping = {
    id: uuidv4(), circle_id: circleId, from_name: fromName, person_id: null, message, created_at: new Date().toISOString(),
  };
  listeners.forEach((l) => l.onPing?.(ping)); // patient overlay fires locally
}

export async function registerDevice(): Promise<void> {}

export async function listCalendars(_circleId: string): Promise<CalendarPublic[]> {
  return calendars;
}

export async function addCalendar(circleId: string, label: string, icsUrl: string, personIds: string[]): Promise<string | null> {
  calendars = [
    ...calendars,
    { id: uuidv4(), circle_id: circleId, label, url_hint: urlHint(icsUrl), last_synced_at: new Date().toISOString(), last_error: null, person_ids: personIds },
  ];
  return null; // demo cannot fetch feeds, so no events are added
}

export async function deleteCalendar(id: string): Promise<void> {
  calendars = calendars.filter((c) => c.id !== id);
}

export async function syncCalendars(): Promise<void> {}

export async function listEvents(_circleId: string): Promise<EventRow[]> {
  return rawEvents.map((e) => ({
    ...e,
    person_ids: calendars.find((c) => c.id === e.calendar_id)?.person_ids ?? [],
  }));
}

// ---- boot links: ?demo=patient | ?demo=family [&person=anna] (web only) ---------------------------
export function demoBoot(): { session: Session; personId?: string } | null {
  const search = (globalThis as { location?: { search?: string } }).location?.search;
  if (!search) return null;
  const q = new URLSearchParams(search);
  const role = q.get('demo');
  if (role !== 'patient' && role !== 'family') return null;
  const session: Session = role === 'patient'
    ? { role, circleId: CIRCLE.id, code: CIRCLE.code, patientName: 'Maria', memberName: 'Maria' }
    : { role, circleId: CIRCLE.id, code: CIRCLE.code, patientName: 'Maria', memberName: 'Anna', relation: 'daughter' };
  return { session, personId: q.get('person') ?? undefined };
}
