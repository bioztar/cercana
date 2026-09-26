// In-memory fixtures behind EXPO_PUBLIC_DEMO=1 (see api.ts). Same signatures as api.real.ts.
// State is replaced, never mutated. Nothing here runs unless the flag is set.
import { reply as scriptReply } from './assistantScript';
import { instants, localParts, looksDistressed, resolveWhen } from '../../supabase/functions/_shared/assistantCore';
import type {
  AssistantAnswer, AssistantAsk, BriefSettings, CalendarPublic, Checkin, CheckinAnswer, Circle, Comment, CommentInput, CommentSummary,
  CreatedCircle, DeviceCalendarLink, DeviceEventRow, EventRow, ImportantEvent, ImportantInput, LeadInput,
  Medication, MedicationInput, MedicationLog, MedicationLogStatus,
  MemberRole, Moment, MomentInput, NewEventInput, Person, PersonInput, Ping, Session,
} from './types';
import type { FeedHandlers } from './api.real';
import { defaultReminders } from './important';
import { normalizeCode, urlHint, uuidv4 } from './util';
import { summarizeComments, titleFromTranscript } from './voice';

const CIRCLE: Circle = { id: 'demo-circle', code: 'K7M4QX', patient_name: 'Carmen' };

const DAY = 86_400_000;
const now = () => new Date();
const isoDaysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
const utcDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const tomorrow = addDays(now(), 1);
const inThreeDays = addDays(now(), 3); // "Sunday" relative to whatever day the demo runs on

// Same family, photos and captions as demo/seed-abuela.sql ("Carmen's family", code ABUELA) —
// keep the two in sync by hand; this is the in-memory stand-in for that seed.
const MEDIA = 'https://xgelxazkvsgrhggmxlzz.supabase.co/storage/v1/object/public/media/demo/';
const img = (file: string) => `${MEDIA}${file}`;

const person = (id: string, name: string, relation: string, extra: Partial<Person> = {}): Person => ({
  id, circle_id: CIRCLE.id, name, relation, phone: null, photo_url: img(`${id}.jpg`), birthday: null,
  role: 'member', claimed: false, ...extra,
});

const pad2 = (n: number) => String(n).padStart(2, '0');

// View family mode as someone else with /?demo=family&as=pedro|anna|diego.
let people: Person[] = [
  person('pedro', 'Pedro', 'your son', { birthday: '1979-06-02', role: 'lead', claimed: true }),
  person('anna', 'Anna', 'your daughter-in-law', { birthday: '1976-03-14', role: 'admin', claimed: true }),
  // Turns 10 tomorrow, like the seed's `(current_date + 1) - interval '10 years'`.
  person('diego', 'Diego', 'your grandson', {
    birthday: `${tomorrow.getFullYear() - 10}-${pad2(tomorrow.getMonth() + 1)}-${pad2(tomorrow.getDate())}`,
  }), // unclaimed: a child who doesn't use the app
];

// `about`/`by` are people ids (null `about` = about everyone); `audio` mirrors the seed's optional voice note.
const moment = (
  id: string, about: string | null, by: string, body: string, photo: string, hoursAgo: number, audio: string | null = null,
): Moment => ({
  id, circle_id: CIRCLE.id, person_id: about, author_person_id: by,
  author: people.find((p) => p.id === by)?.name ?? null, body, photo_url: img(photo),
  audio_url: audio ? img(audio) : null, created_at: isoDaysAgo(hoursAgo / 24),
});

let moments: Moment[] = [
  moment('m1', 'anna', 'anna', "Landed in London! Raining, of course. I'll call you tonight.", 'm_london.jpg', 2, 'v_anna.mp3'),
  moment('m2', null, 'pedro', 'This morning we walked to the park and fed the pigeons. You laughed a lot.', 'm_park.jpg', 4),
  moment('m3', 'diego', 'pedro', "Diego made you a drawing at school. We're coming on Sunday with the cake.", 'm_drawing.jpg', 24, 'v_pedro.mp3'),
  moment('m4', 'anna', 'anna', 'We had lunch at the beach. You loved the paella.', 'm_paella.jpg', 144),
];

const comment = (
  id: string, moment_id: string, by: string | null, body: string | null, mins: number, audio_url: string | null = null,
): Comment => ({
  id, moment_id, circle_id: CIRCLE.id, author_person_id: by,
  author_name: by ? people.find((p) => p.id === by)?.name ?? null : 'Carmen',
  body, audio_url, created_at: new Date(Date.now() - mins * 60_000).toISOString(),
});

let comments: Comment[] = [
  comment('c1', 'm2', 'anna', 'A champion in the making!', 90),
  comment('c2', 'm2', null, null, 20, 'demo-audio://mom-reply'), // Carmen's voice reply
  comment('c3', 'm1', 'pedro', 'Looking forward to Sunday!', 200),
];

let calendars: CalendarPublic[] = [
  {
    id: 'cal-anna', circle_id: CIRCLE.id, label: "Anna's calendar", url_hint: 'anna.ics',
    last_synced_at: isoDaysAgo(0.003), last_error: null, person_ids: ['anna'],
  },
  {
    id: 'cal-family', circle_id: CIRCLE.id, label: 'Family', url_hint: 'family-v2.ics',
    last_synced_at: isoDaysAgo(0.003), last_error: null, person_ids: ['pedro', 'diego'],
  },
];

const at = (d: Date, h: number, min = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min).toISOString();
const event = (
  id: string, calendar_id: string, title: string, starts: string, ends: string, all_day: boolean,
  location: string | null = null, includes_patient = false,
): Omit<EventRow, 'person_ids'> =>
  ({ id, calendar_id, uid: id, title, location, starts_at: starts, ends_at: ends, all_day, created_by_person_id: null, includes_patient });

// Mirrors demo/assets/anna.ics + family-v2.ics, kept relative to "today" instead of their fixed
// 2026-09-24 dates so the demo looks current on any day. "For you" vs "Family" (Vitaly, 15:50):
// the Sunday lunch includes Carmen; Anna's own trip to London doesn't.
let rawEvents = [
  event('e-london', 'cal-anna', 'In London', utcDay(now()).toISOString(), utcDay(addDays(now(), 4)).toISOString(), true),
  event('e-flight', 'cal-anna', 'Flying home to Madrid', at(inThreeDays, 18), at(inThreeDays, 20, 30), false),
  event(
    'e-lunch', 'cal-family', 'Sunday lunch with you — Pedro and Diego bring the cake',
    at(inThreeDays, 13, 30), at(inThreeDays, 16, 30), false, 'Your home', true,
  ),
];

// Blood test this morning, like the seed's `current_date + 09:00..09:30`. The `check` reminder is
// overridden to a few minutes ago so the demo patient sees "Did you go?" due immediately, regardless
// of when the demo happens to be opened.
const bloodTestStart = new Date(now().getFullYear(), now().getMonth(), now().getDate(), 9, 0).toISOString();
const bloodTestEnd = new Date(now().getFullYear(), now().getMonth(), now().getDate(), 9, 30).toISOString();
let importantEvents: ImportantEvent[] = [
  {
    id: 'imp-blood', circle_id: CIRCLE.id, title: 'Blood test', starts_at: bloodTestStart, ends_at: bloodTestEnd,
    location: 'Health centre', for_person: 'mom', created_by_person_id: 'pedro',
    reminders: defaultReminders(new Date(bloodTestStart), new Date(bloodTestEnd)).map((r) =>
      r.kind === 'check' ? { ...r, at: new Date(Date.now() - 5 * 60_000).toISOString() } : r,
    ),
    created_at: isoDaysAgo(1),
  },
];
let checkins: Checkin[] = [];
let briefSettings: BriefSettings = { brief_time: '09:00', brief_enabled: true };

// Medicines (cercana-meds): "Blood pressure pill" already taken this morning, "Memory pill" due
// right now (its time is computed from the clock the demo happens to load at) so the full-screen
// "Did you take it?" is visible without waiting for the real clock.
const pad = (n: number) => String(n).padStart(2, '0');
const nowHHMM = `${pad(now().getHours())}:${pad(now().getMinutes())}`;
let medications: Medication[] = [
  { id: 'med-bp', circle_id: CIRCLE.id, name: 'Blood pressure pill', dose: '1 pill', times: ['08:00'], active: true, created_by_person_id: 'pedro', created_at: isoDaysAgo(30) },
  { id: 'med-memory', circle_id: CIRCLE.id, name: 'Memory pill', dose: '1 pill', times: [nowHHMM], active: true, created_by_person_id: 'pedro', created_at: isoDaysAgo(30) },
];
const bpDoseAt = new Date(now().getFullYear(), now().getMonth(), now().getDate(), 8, 0);
const bpTakenAt = new Date(now().getFullYear(), now().getMonth(), now().getDate(), 8, 4);
let medicationLogs: MedicationLog[] = [
  { id: 'medlog-bp', circle_id: CIRCLE.id, medication_id: 'med-bp', scheduled_for: bpDoseAt.toISOString(), status: 'taken', answered_at: bpTakenAt.toISOString() },
];

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
  const row: Moment = { ...m, id: uuidv4(), circle_id: circleId, created_at: new Date().toISOString() };
  moments = [...moments, row];
  emitChange();
  listeners.forEach((l) => l.onMomentInsert?.(row));
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

export async function addCalendar(
  circleId: string, label: string, icsUrl: string, personIds: string[], _includesPatientDefault = false,
): Promise<string | null> {
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
  const row: Comment = { ...c, id: uuidv4(), circle_id: CIRCLE.id, created_at: new Date().toISOString() };
  comments = [...comments, row];
  emitChange();
  listeners.forEach((l) => l.onCommentInsert?.(row));
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
  _circleId: string, calendarId: string, input: NewEventInput, createdByPersonId: string | null,
): Promise<string> {
  const id = uuidv4();
  rawEvents = [
    ...rawEvents,
    {
      id, calendar_id: calendarId, uid: uuidv4(), title: input.title, location: input.location ?? null, starts_at: input.starts_at,
      ends_at: input.ends_at, all_day: input.all_day, created_by_person_id: createdByPersonId,
      includes_patient: createdByPersonId === null, // Carmen created it herself → it's for her
    },
  ];
  emitChange();
  return id;
}

/** Demo-only title guess: the words before the first day/time cue ("I have the dentist Tuesday at 11" → "Dentist"). */
function eventTitle(text: string): string {
  const head = text
    .replace(/^\s*(i have|i've got|i got|remind me of|add)\s+(the|a|an|my)?\s*/i, '')
    .replace(/\s+(on|at|next|this|tomorrow|today|el|a las|mañana|hoy|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*$/i, '');
  return titleFromTranscript(head) || 'Event';
}

/** Offline stand-in for the `assistant` edge fn: no network. Chat uses the scripted replies, dictate
 * parses the sentence with the same pure date rules the server uses. */
export async function askAssistant(ask: AssistantAsk): Promise<AssistantAnswer> {
  const text = ask.text ?? '';
  const now = new Date(ask.now);
  const distress = looksDistressed(text);
  if (ask.mode === 'chat') {
    const r = scriptReply(text, now, { people, events: rawEvents.map((e) => ({ ...e, person_ids: [] })) });
    const when = resolveWhen(text, now, ask.tz);
    if (!r.card && when.date && when.time) {
      const title = eventTitle(text);
      return { reply: `Add ${title}? Yes / No`, distress, proposal: { title, ...instants(when.date, when.time, ask.tz) } };
    }
    if (!r.card) return { reply: r.text, distress };
    const date = when.date ?? localParts(new Date(now.getTime() + DAY), ask.tz);
    const time = when.time ?? { h: 10, mi: 0 };
    return { reply: r.text, distress, proposal: { title: r.card.title, ...instants(date, time, ask.tz) } };
  }
  const when = resolveWhen(text, now, ask.tz);
  if (!when.date) return { reply: "I didn't catch the day. Please pick it.", distress: false };
  const title = eventTitle(text);
  return { reply: 'Got it.', distress: false, proposal: { title, ...instants(when.date, when.time, ask.tz) } };
}

export async function transcribeAudio(_circleId: string, _audioUrl: string): Promise<string> {
  return '';
}

/** The "<patient> takes part" toggle on EventDetail (demo stand-in for api.real.ts). */
export async function setEventIncludesPatient(eventId: string, includesPatient: boolean): Promise<void> {
  rawEvents = rawEvents.map((e) => (e.id === eventId ? { ...e, includes_patient: includesPatient } : e));
  emitChange();
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

export async function addDeviceCalendar(circleId: string, label: string, deviceCalendarId: string, personIds: string[]): Promise<string> {
  const id = uuidv4();
  calendars = [...calendars, { id, circle_id: circleId, label, url_hint: deviceCalendarId, last_synced_at: new Date().toISOString(), last_error: null, person_ids: personIds }];
  return id;
}

export async function upsertDeviceEvents(_circleId: string, _calendarId: string, _rows: DeviceEventRow[]): Promise<void> {}

export async function listDeviceCalendars(_circleId: string): Promise<DeviceCalendarLink[]> {
  return []; // demo has no real iPhone to read a device calendar id from
}

// ---- scheduled morning brief (cercana-care) --------------------------------------------------------

export async function getBriefSettings(_circleId: string): Promise<BriefSettings> {
  return briefSettings;
}

export async function updateBriefSettings(_circleId: string, settings: BriefSettings): Promise<void> {
  briefSettings = settings;
  emitChange();
}

// ---- medications + "Did you take it?" logs (cercana-meds) ----------------------------------------

export async function listMedications(_circleId: string): Promise<Medication[]> {
  return [...medications].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function createMedication(circleId: string, input: MedicationInput): Promise<Medication> {
  const created: Medication = { ...input, id: uuidv4(), circle_id: circleId, active: true, created_at: new Date().toISOString() };
  medications = [...medications, created];
  emitChange();
  return created;
}

export async function updateMedication(id: string, patch: Partial<Pick<Medication, 'name' | 'dose' | 'times' | 'active'>>): Promise<Medication> {
  const found = medications.find((m) => m.id === id);
  if (!found) throw new Error('Medicine not found');
  const updated = { ...found, ...patch };
  medications = medications.map((m) => (m.id === id ? updated : m));
  emitChange();
  return updated;
}

export async function listMedicationLogs(_circleId: string): Promise<MedicationLog[]> {
  return medicationLogs;
}

export async function submitMedicationLog(
  circleId: string,
  medicationId: string,
  scheduledFor: string,
  status: MedicationLogStatus,
): Promise<MedicationLog> {
  const saved: MedicationLog = { id: uuidv4(), circle_id: circleId, medication_id: medicationId, scheduled_for: scheduledFor, status, answered_at: new Date().toISOString() };
  medicationLogs = [...medicationLogs.filter((l) => !(l.medication_id === medicationId && l.scheduled_for === scheduledFor)), saved];
  emitChange();
  return saved;
}

/** Demo-only, button-free way to see an arrival: Pedro's voice note lands a few seconds after
 * `?demo=patient` loads, so ArrivalOverlay can be screenshotted without a second device. */
export async function demoTriggerArrival(): Promise<void> {
  await addMoment(CIRCLE.id, {
    person_id: null, author_person_id: 'pedro', author: 'Pedro',
    body: 'On our way, see you soon!', photo_url: null, audio_url: img('v_pedro.mp3'),
  });
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
      session: { role: 'patient', circleId: CIRCLE.id, code: CIRCLE.code, patientName: 'Carmen', memberName: 'Carmen' },
      personId: q.get('person') ?? undefined,
    };
  }
  if (kind !== 'family') return null;
  const me = people.find((p) => p.id === q.get('as')) ?? people[0];
  return {
    session: {
      role: 'family', circleId: CIRCLE.id, code: CIRCLE.code, patientName: 'Carmen',
      memberName: me.name, memberId: me.id, relation: me.relation ?? undefined,
    },
  };
}
