// In-memory fixtures behind EXPO_PUBLIC_DEMO=1 (see api.ts). Same signatures as api.real.ts.
// State is replaced, never mutated. Nothing here runs unless the flag is set.
import type {
  BriefSettings, CalendarPublic, Checkin, CheckinAnswer, Circle, Comment, CommentInput, CommentSummary,
  CreatedCircle, DeviceEventRow, EventRow, ImportantEvent, ImportantInput, LeadInput, MemberRole, Moment,
  MomentInput, NewEventInput, Person, PersonInput, Ping, Session,
} from './types';
import type { FeedHandlers } from './api.real';
import { defaultReminders } from './important';
import { normalizeCode, urlHint, uuidv4 } from './util';
import { summarizeComments } from './voice';

const CIRCLE: Circle = { id: 'demo-circle', code: 'K7M4QX', patient_name: 'Maria' };

const DAY = 86_400_000;
const now = () => new Date();
const isoDaysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
const utcDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const tomorrow = addDays(now(), 1);
const untilSunday = (7 - now().getDay()) % 7; // days from today to the coming Sunday (0 if today is Sunday)

const person = (id: string, name: string, relation: string, extra: Partial<Person> = {}): Person => ({
  id, circle_id: CIRCLE.id, name, relation, phone: '+34600000000', photo_url: null, birthday: null,
  role: 'member', claimed: false, ...extra,
});

// Roles for design review: Anna = lead, Pedro = admin, Carmen = member, Lucia = unclaimed (a child).
// View family mode as someone else with /?demo=family&as=pedro|carmen|lucia.
let people: Person[] = [
  person('anna', 'Anna', 'your daughter', { birthday: '1975-03-05', role: 'lead', claimed: true }),
  person('pedro', 'Pedro', 'your son', { birthday: '1978-11-20', role: 'admin', claimed: true }),
  person('lucia', 'Lucia', 'your granddaughter', {
    birthday: `2010-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`,
  }),
  person('carmen', 'Carmen', 'your sister', { birthday: '1950-07-14', claimed: true }),
];

// `about` = who it concerns, `by` = who posted it (both people ids)
const moment = (id: string, about: string, by: string, body: string, days: number): Moment => ({
  id, circle_id: CIRCLE.id, person_id: about, author_person_id: by,
  author: people.find((p) => p.id === by)?.name ?? null, body, photo_url: null, audio_url: null,
  created_at: isoDaysAgo(days),
});

// Tiny inline illustrations so the demo shows photos without any hosted assets.
const scene = (sky: string, ground: string, accent: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><rect width="400" height="260" fill="${sky}"/>` +
      `<circle cx="330" cy="50" r="24" fill="#F2D27A"/><rect y="170" width="400" height="90" fill="${ground}"/>` +
      `<circle cx="150" cy="140" r="34" fill="${accent}"/><rect x="128" y="170" width="44" height="60" rx="8" fill="${accent}"/></svg>`,
  )}`;
const PARK = scene('#D3E3EF', '#8FBF77', '#E8735A');
const PARK2 = scene('#CFE0EC', '#9BC780', '#F2B84B');
const HOUSE = scene('#D3E3EF', '#A6C88A', '#A34A24');

let moments: Moment[] = [
  { ...moment('m1', 'pedro', 'pedro', 'I called from work. I will visit you on Sunday and bring the cake.', 1), photo_url: HOUSE },
  { ...moment('m2', 'lucia', 'anna', 'Lucia got a nine in her maths exam!', 0.1), photo_url: PARK, photo_urls: [PARK2, HOUSE] },
  moment('m3', 'anna', 'anna', 'We had lunch at the beach. You loved the paella.', 3),
  moment('m4', 'carmen', 'carmen', 'I made your favourite soup. I will bring it on Friday.', 5),
];

const comment = (
  id: string, moment_id: string, by: string | null, body: string | null, mins: number, audio_url: string | null = null,
): Comment => ({
  id, moment_id, circle_id: CIRCLE.id, author_person_id: by,
  author_name: by ? people.find((p) => p.id === by)?.name ?? null : 'Maria',
  body, audio_url, created_at: new Date(Date.now() - mins * 60_000).toISOString(),
});

let comments: Comment[] = [
  comment('c1', 'm2', 'pedro', 'A champion in the making!', 90),
  comment('c2', 'm2', null, null, 20, 'demo-audio://mom-reply'), // Mom's voice reply
  comment('c3', 'm1', 'anna', 'Looking forward to Sunday!', 200),
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
  {
    id: 'cal-walks', circle_id: CIRCLE.id, label: 'Walks', url_hint: null,
    last_synced_at: null, last_error: null, person_ids: ['anna', 'lucia'],
  },
];

const at = (d: Date, h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0).toISOString();
const event = (id: string, calendar_id: string, title: string, starts: string, ends: string, all_day: boolean, location: string | null = null) =>
  ({ id, calendar_id, uid: id, title, location, starts_at: starts, ends_at: ends, all_day });

let rawEvents = [
  event('e1', 'cal-anna', 'In London', utcDay(now()).toISOString(), utcDay(addDays(now(), untilSunday + 1)).toISOString(), true),
  event('e2', 'cal-anna', 'Dentist', at(tomorrow, 16), at(tomorrow, 17), false, 'Calle Mayor 1'),
  event('e3', 'cal-family', 'Family lunch', at(addDays(now(), untilSunday || 7), 14), at(addDays(now(), untilSunday || 7), 16), false, "Pedro's house"),
  event('e4', 'cal-walks', 'Walk in the park', at(now(), 10), at(now(), 12), false, 'Retiro park'),
];

// `check` reminder is overridden to a few minutes ago so the demo patient sees it due immediately,
// regardless of when the demo happens to be opened (the mockups always show it due).
const appt = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 30).toISOString();
let importantEvents: ImportantEvent[] = [
  {
    id: 'imp-cardio', circle_id: CIRCLE.id, title: 'Cardiologist appointment', starts_at: appt, ends_at: null,
    location: 'Calle Mayor 1', for_person: 'mom', created_by_person_id: 'anna',
    reminders: defaultReminders(new Date(appt), null).map((r) =>
      r.kind === 'check' ? { ...r, at: new Date(Date.now() - 5 * 60_000).toISOString() } : r,
    ),
    created_at: isoDaysAgo(1),
  },
];
let checkins: Checkin[] = [];
let briefSettings: BriefSettings = { brief_time: '09:00', brief_enabled: true };

// ---- feed (stands in for Supabase realtime) ------------------------------------------------------
let listeners: FeedHandlers[] = [];
const emitChange = () => listeners.forEach((l) => l.onChange?.());

export function subscribeCircle(_circleId: string, h: FeedHandlers): () => void {
  listeners = [...listeners, h];
  return () => { listeners = listeners.filter((l) => l !== h); };
}

// ---- api surface ---------------------------------------------------------------------------------
export async function createCircle(patientName: string, lead?: LeadInput): Promise<CreatedCircle> {
  return { ...CIRCLE, patient_name: patientName, lead_id: lead ? 'demo-lead' : null };
}

export async function claimPerson(personId: string): Promise<Person> {
  const target = people.find((p) => p.id === personId);
  if (!target || target.claimed) throw new Error('Someone already picked that profile. Please choose again.');
  const claimed = { ...target, claimed: true };
  people = people.map((p) => (p.id === personId ? claimed : p));
  emitChange();
  return claimed;
}

export async function unclaimPerson(personId: string): Promise<void> {
  people = people.map((p) => (p.id === personId ? { ...p, claimed: false } : p));
  emitChange();
}

export async function setPersonRole(personId: string, role: Exclude<MemberRole, 'lead'>): Promise<void> {
  people = people.map((p) => (p.id === personId ? { ...p, role } : p));
  emitChange();
}

export async function transferLead(fromId: string, toId: string): Promise<void> {
  people = people.map((p) => (p.id === fromId ? { ...p, role: 'admin' } : p.id === toId ? { ...p, role: 'lead' } : p));
  emitChange();
}

export async function deleteMoment(id: string): Promise<void> {
  moments = moments.filter((m) => m.id !== id);
  emitChange();
}

export async function findCircleByCode(input: string): Promise<Circle | null> {
  return normalizeCode(input).length === 6 ? CIRCLE : null;
}

export async function listPeople(_circleId: string): Promise<Person[]> {
  return [...people].sort((a, b) => a.name.localeCompare(b.name));
}

export async function savePerson(circleId: string, p: PersonInput, initial?: { claimed?: boolean }): Promise<Person> {
  const existing = p.id ? people.find((x) => x.id === p.id) : undefined;
  const saved: Person = existing
    ? { ...existing, ...p, id: existing.id }
    : { role: 'member', claimed: initial?.claimed ?? false, ...p, id: uuidv4(), circle_id: circleId };
  people = existing ? people.map((x) => (x.id === saved.id ? saved : x)) : [...people, saved];
  emitChange();
  return saved;
}

export async function deletePerson(id: string): Promise<void> {
  people = people.filter((p) => p.id !== id);
  emitChange();
}

export async function listMoments(_circleId: string, personId?: string, limit = 50): Promise<Moment[]> {
  return moments
    .filter((m) => !personId || m.person_id === personId || m.author_person_id === personId)
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

// ---- Thread comments + "Tell the family" (voice mission) --------------------------------------

export async function listComments(momentId: string): Promise<Comment[]> {
  return comments.filter((c) => c.moment_id === momentId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function addComment(_circleId: string, c: CommentInput): Promise<void> {
  comments = [...comments, { ...c, id: uuidv4(), circle_id: CIRCLE.id, created_at: new Date().toISOString() }];
  emitChange();
}

export async function commentSummaries(_circleId: string): Promise<Record<string, CommentSummary>> {
  return summarizeComments(comments);
}

const FAMILY_CAL_ID = 'cal-family-app';

export async function ensureFamilyCalendar(_circleId: string): Promise<string> {
  if (!calendars.some((c) => c.id === FAMILY_CAL_ID)) {
    calendars = [
      ...calendars,
      { id: FAMILY_CAL_ID, circle_id: CIRCLE.id, label: 'Family events', url_hint: null, last_synced_at: null, last_error: null, person_ids: [] },
    ];
  }
  return FAMILY_CAL_ID;
}

export async function addEvent(
  _circleId: string, calendarId: string, input: NewEventInput, _createdByPersonId: string | null,
): Promise<string> {
  const id = uuidv4();
  rawEvents = [
    ...rawEvents,
    { id, calendar_id: calendarId, uid: uuidv4(), title: input.title, location: null, starts_at: input.starts_at, ends_at: input.ends_at, all_day: input.all_day },
  ];
  emitChange();
  return id;
}

// ---- important events + check-ins (cercana-care) -------------------------------------------------

export async function listImportant(_circleId: string): Promise<ImportantEvent[]> {
  return [...importantEvents].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function createImportant(circleId: string, input: ImportantInput): Promise<ImportantEvent> {
  const created: ImportantEvent = { ...input, id: uuidv4(), circle_id: circleId, for_person: 'mom', created_at: new Date().toISOString() };
  importantEvents = [...importantEvents, created];
  emitChange();
  return created;
}

export async function listCheckins(_circleId: string): Promise<Checkin[]> {
  return checkins;
}

export async function submitCheckin(
  circleId: string,
  importantEventId: string,
  answer: CheckinAnswer,
  noteAudioUrl: string | null,
): Promise<Checkin> {
  const saved: Checkin = {
    id: uuidv4(), circle_id: circleId, important_event_id: importantEventId, answer,
    note_audio_url: noteAudioUrl, answered_at: new Date().toISOString(),
  };
  checkins = [...checkins.filter((c) => c.important_event_id !== importantEventId), saved];
  emitChange();
  return saved;
}

// ---- device calendar sync (cercana-care) — demo has no real iPhone calendars to read -------------

export async function addDeviceCalendar(circleId: string, label: string, personIds: string[]): Promise<string> {
  const id = uuidv4();
  calendars = [...calendars, { id, circle_id: circleId, label, url_hint: 'iPhone', last_synced_at: new Date().toISOString(), last_error: null, person_ids: personIds }];
  return id;
}

export async function upsertDeviceEvents(_circleId: string, _calendarId: string, _rows: DeviceEventRow[]): Promise<void> {}

// ---- scheduled morning brief (cercana-care) --------------------------------------------------------

export async function getBriefSettings(_circleId: string): Promise<BriefSettings> {
  return briefSettings;
}

export async function updateBriefSettings(_circleId: string, settings: BriefSettings): Promise<void> {
  briefSettings = settings;
  emitChange();
}

// ---- boot links (web only): ?demo=patient | family | join  [&person=anna] [&as=pedro] ---------------
export type DemoBoot = { session: Session | null; personId?: string; joinCode?: string };

export function demoBoot(): DemoBoot | null {
  const search = (globalThis as { location?: { search?: string } }).location?.search;
  if (!search) return null;
  const q = new URLSearchParams(search);
  const kind = q.get('demo');
  if (kind === 'join') return { session: null, joinCode: CIRCLE.code }; // the "Which one are you?" screen
  if (kind === 'patient') {
    return {
      session: { role: 'patient', circleId: CIRCLE.id, code: CIRCLE.code, patientName: 'Maria', memberName: 'Maria' },
      personId: q.get('person') ?? undefined,
    };
  }
  if (kind !== 'family') return null;
  const me = people.find((p) => p.id === q.get('as')) ?? people[0];
  return {
    session: {
      role: 'family', circleId: CIRCLE.id, code: CIRCLE.code, patientName: 'Maria',
      memberName: me.name, memberId: me.id, relation: me.relation ?? undefined,
    },
  };
}
