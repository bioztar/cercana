// All Supabase data access lives here.
import { getSupabase } from './supabase';
import { generateCode, normalizeCode, isValidCode, urlHint, uuidv4 } from './util';
import { summarizeComments } from './voice';
import type {
  BriefSettings, CalendarPublic, Checkin, CheckinAnswer, Circle, Comment, CommentInput, CommentSummary,
  CreatedCircle, DeviceCalendarLink, DeviceEventRow, EventRow, ImportantEvent, ImportantInput, LeadInput,
  Moment, MomentInput, NewEventInput, Person, PersonInput, Ping,
} from './types';

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

/**
 * Creates the circle and, when given, the lead's profile (role 'lead', unclaimed until the lead
 * picks it on their own phone through the invite link).
 */
export async function createCircle(patientName: string, lead?: LeadInput): Promise<CreatedCircle> {
  const db = getSupabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await db
      .from('circles')
      .insert({ code: generateCode(), patient_name: patientName })
      .select()
      .single();
    if (res.error) {
      if (res.error.code !== '23505') throw new Error(`Could not create circle: ${res.error.message}`);
      continue;
    }
    const circle = res.data as Circle;
    if (!lead) return { ...circle, lead_id: null };
    const made = await db
      .from('people')
      // Claimed: the relative creating the circle is on this device now, not an unclaimed profile to pick later.
      .insert({ circle_id: circle.id, name: lead.name, relation: lead.relation || null, role: 'lead', claimed: true })
      .select()
      .single();
    if (made.error) {
      await db.from('circles').delete().eq('id', circle.id); // do not leave a circle without its lead
      throw new Error(`Could not create the lead profile: ${made.error.message}`);
    }
    return { ...circle, lead_id: (made.data as Person).id };
  }
  throw new Error('Could not create a unique circle code, try again');
}

/** Claim an unclaimed profile. Atomic: fails when someone else picked it first. */
export async function claimPerson(personId: string): Promise<Person> {
  const res = await getSupabase()
    .from('people')
    .update({ claimed: true })
    .eq('id', personId)
    .eq('claimed', false)
    .select()
    .maybeSingle();
  const person = check(res, 'Could not claim profile') as Person | null;
  if (!person) throw new Error('Someone already picked that profile. Please choose again.');
  return person;
}

/** Best effort: frees the profile when a device leaves the circle, so it can be claimed again. */
export async function unclaimPerson(personId: string): Promise<void> {
  const res = await getSupabase().from('people').update({ claimed: false }).eq('id', personId);
  if (res.error) console.warn('unclaimPerson failed', res.error.message);
}

export async function setPersonRole(personId: string, role: 'admin' | 'member'): Promise<void> {
  check(await getSupabase().from('people').update({ role }).eq('id', personId), 'Could not change role');
}

/** Lead hand-over. The old lead is demoted first (one lead per circle is a unique index); rolls back on failure. */
export async function transferLead(fromId: string, toId: string): Promise<void> {
  const db = getSupabase();
  check(await db.from('people').update({ role: 'admin' }).eq('id', fromId), 'Could not hand over lead');
  const promoted = await db.from('people').update({ role: 'lead' }).eq('id', toId);
  if (promoted.error) {
    await db.from('people').update({ role: 'lead' }).eq('id', fromId);
    throw new Error(`Could not hand over lead: ${promoted.error.message}`);
  }
}

export async function findCircleByCode(input: string): Promise<Circle | null> {
  const code = normalizeCode(input);
  if (!isValidCode(code)) return null;
  const res = await getSupabase().from('circles').select().eq('code', code).maybeSingle();
  return check(res, 'Could not look up circle') as Circle | null;
}

export async function listPeople(circleId: string): Promise<Person[]> {
  const res = await getSupabase()
    .from('people')
    .select()
    .eq('circle_id', circleId)
    .order('name', { ascending: true });
  return check(res, 'Could not load people') ?? [];
}

/** `initial` (role / claimed) applies to new profiles only; edits never change them. */
export async function savePerson(
  circleId: string,
  p: PersonInput,
  initial?: { claimed?: boolean },
): Promise<Person> {
  const row = p.id ? { ...p, circle_id: circleId } : { ...p, circle_id: circleId, ...initial };
  const q = getSupabase().from('people');
  const res = await (p.id ? q.update(row).eq('id', p.id) : q.insert(row)).select().single();
  return check(res, 'Could not save person') as Person;
}

export async function deletePerson(id: string): Promise<void> {
  check(await getSupabase().from('people').delete().eq('id', id), 'Could not delete person');
}

export async function listMoments(circleId: string, personId?: string, limit = 50): Promise<Moment[]> {
  let q = getSupabase().from('moments').select().eq('circle_id', circleId);
  // A person's slice of the feed: moments about them or posted by them.
  if (personId) q = q.or(`person_id.eq.${personId},author_person_id.eq.${personId}`);
  const res = await q.order('created_at', { ascending: false }).limit(limit);
  return check(res, 'Could not load moments') ?? [];
}

export async function deleteMoment(id: string): Promise<void> {
  check(await getSupabase().from('moments').delete().eq('id', id), 'Could not delete moment');
}

export async function addMoment(circleId: string, m: MomentInput): Promise<void> {
  check(await getSupabase().from('moments').insert({ ...m, circle_id: circleId }), 'Could not post moment');
}

/** Uploads a local/blob URI to the public `media` bucket and returns its public URL. */
export async function uploadMedia(uri: string, kind: 'photo' | 'audio'): Promise<string> {
  const db = getSupabase();
  const blob = await (await fetch(uri)).blob();
  const type = blob.type || (kind === 'photo' ? 'image/jpeg' : 'audio/mp4');
  const ext = type.includes('webm') ? 'webm' : type.includes('png') ? 'png' : kind === 'photo' ? 'jpg' : 'm4a';
  const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await db.storage.from('media').upload(path, blob, { contentType: type });
  if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
  return db.storage.from('media').getPublicUrl(path).data.publicUrl;
}

export async function sendPing(circleId: string, fromName: string, message: string): Promise<void> {
  const res = await getSupabase().functions.invoke('ping', {
    body: { circle_id: circleId, from_name: fromName, message },
  });
  if (res.error) throw new Error(`Could not send ping: ${res.error.message}`);
}

export async function registerDevice(
  circleId: string,
  role: 'patient' | 'family',
  pushToken: string,
  platform: string,
): Promise<void> {
  const res = await getSupabase()
    .from('devices')
    .upsert({ circle_id: circleId, role, push_token: pushToken, platform }, { onConflict: 'push_token' });
  if (res.error) console.warn('registerDevice failed', res.error.message);
}

// ---- Calendar subscriptions -------------------------------------------------------------------
// The ICS URL is write-only from the client: it is inserted here and read only by the edge function.

async function personIdsByCalendar(calendarIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (calendarIds.length === 0) return map;
  const res = await getSupabase().from('calendar_people').select('calendar_id, person_id').in('calendar_id', calendarIds);
  for (const r of check(res, 'Could not load calendar people') ?? []) {
    map.set(r.calendar_id, [...(map.get(r.calendar_id) ?? []), r.person_id]);
  }
  return map;
}

export async function listCalendars(circleId: string): Promise<CalendarPublic[]> {
  const res = await getSupabase()
    .from('calendars_public')
    .select('id, circle_id, label, url_hint, last_synced_at, last_error')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: true });
  const rows = (check(res, 'Could not load calendars') ?? []) as Omit<CalendarPublic, 'person_ids'>[];
  const links = await personIdsByCalendar(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, person_ids: links.get(r.id) ?? [] }));
}

/** Adds a feed, links it to people, and triggers a first sync. Returns the sync error, if any. */
export async function addCalendar(
  circleId: string,
  label: string,
  icsUrl: string,
  personIds: string[],
  includesPatientDefault = false,
): Promise<string | null> {
  const db = getSupabase();
  const id = uuidv4(); // client-side id: the row cannot be read back (select on calendars is revoked)
  check(
    await db.from('calendars').insert({
      id, circle_id: circleId, label, ics_url: icsUrl.trim(), url_hint: urlHint(icsUrl),
      includes_patient: includesPatientDefault,
    }),
    'Could not save calendar',
  );
  if (personIds.length > 0) {
    check(
      await db.from('calendar_people').insert(personIds.map((person_id) => ({ calendar_id: id, person_id }))),
      'Could not link calendar to people',
    );
  }
  await syncCalendars({ calendar_id: id }).catch((e) => console.warn('first sync failed', e));
  const after = await listCalendars(circleId);
  return after.find((c) => c.id === id)?.last_error ?? null;
}

export async function deleteCalendar(id: string): Promise<void> {
  check(await getSupabase().from('calendars').delete().eq('id', id), 'Could not delete calendar');
}

export async function syncCalendars(scope: { calendar_id?: string; circle_id?: string }): Promise<void> {
  const res = await getSupabase().functions.invoke('sync-calendars', { body: scope });
  if (res.error) throw new Error(`Could not refresh calendars: ${res.error.message}`);
}

/** Events from a day ago onward, each tagged with the people whose calendars carry it. */
export async function listEvents(circleId: string): Promise<EventRow[]> {
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const res = await getSupabase()
    .from('events')
    .select('id, calendar_id, uid, title, location, starts_at, ends_at, all_day, created_by_person_id, includes_patient')
    .eq('circle_id', circleId)
    .gte('ends_at', since) // keeps multi-day events that began earlier but are still running
    .order('starts_at', { ascending: true })
    .limit(500);
  const rows = (check(res, 'Could not load events') ?? []) as Omit<EventRow, 'person_ids'>[];
  const links = await personIdsByCalendar([...new Set(rows.map((r) => r.calendar_id))]);
  return rows.map((r) => ({ ...r, person_ids: links.get(r.calendar_id) ?? [] }));
}

// ---- Thread comments ------------------------------------------------------------------------

export async function listComments(momentId: string): Promise<Comment[]> {
  const res = await getSupabase().from('comments').select().eq('moment_id', momentId).order('created_at', { ascending: true });
  return check(res, 'Could not load comments') ?? [];
}

export async function addComment(circleId: string, c: CommentInput): Promise<void> {
  check(await getSupabase().from('comments').insert({ ...c, circle_id: circleId }), 'Could not post comment');
}

/** commentCount + lastComment for every moment in a circle, for the feed cards. */
export async function commentSummaries(circleId: string): Promise<Record<string, CommentSummary>> {
  const res = await getSupabase().from('comments').select().eq('circle_id', circleId).order('created_at', { ascending: true });
  return summarizeComments(check(res, 'Could not load comments') ?? []);
}

// ---- "Tell the family": events Mom creates by voice ------------------------------------------

/** The circle's own "Family events" calendar (source: app), created the first time it is needed. */
export async function ensureFamilyCalendar(circleId: string): Promise<string> {
  const db = getSupabase();
  const found = await db.from('calendars_public').select('id, label').eq('circle_id', circleId).eq('label', 'Family events').maybeSingle();
  const existing = check(found, 'Could not look up calendars') as { id: string } | null;
  if (existing) return existing.id;
  const id = uuidv4();
  check(
    await db.from('calendars').insert({ id, circle_id: circleId, label: 'Family events', source: 'app' }),
    'Could not create the family calendar',
  );
  return id;
}

export async function addEvent(
  circleId: string,
  calendarId: string,
  input: NewEventInput,
  createdByPersonId: string | null,
): Promise<string> {
  const res = await getSupabase().from('events').insert({
    circle_id: circleId, calendar_id: calendarId, uid: uuidv4(), created_by_person_id: createdByPersonId,
    title: input.title, starts_at: input.starts_at, ends_at: input.ends_at, all_day: input.all_day,
  }).select('id').single();
  const row = check(res, 'Could not save the event') as { id: string };
  return row.id;
}

/** The "<patient> takes part" toggle on EventDetail (Vitaly, 2026-09-24 15:50) — app/device events
 * only; an ICS event's RLS write policy rejects this and the caller shows a friendly message. */
export async function setEventIncludesPatient(eventId: string, includesPatient: boolean): Promise<void> {
  check(
    await getSupabase().from('events').update({ includes_patient: includesPatient }).eq('id', eventId),
    'Could not update this event',
  );
}

export type FeedHandlers = { onPing?: (p: Ping) => void; onChange?: () => void };

/** Realtime feed for one circle. Returns an unsubscribe function. */
export function subscribeCircle(circleId: string, h: FeedHandlers): () => void {
  const db = getSupabase();
  const filter = `circle_id=eq.${circleId}`;
  const channel = db
    .channel(`circle-${circleId}-${Math.random().toString(36).slice(2, 6)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pings', filter }, (e) =>
      h.onPing?.(e.new as Ping),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'people', filter }, () => h.onChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'moments', filter }, () => h.onChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter }, () => h.onChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'important_events', filter }, () => h.onChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins', filter }, () => h.onChange?.())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'circles', filter: `id=eq.${circleId}` }, () => h.onChange?.())
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}

// ---- Important events + "Did you go?" check-ins (cercana-care) ---------------------------------

export async function listImportant(circleId: string): Promise<ImportantEvent[]> {
  const res = await getSupabase()
    .from('important_events')
    .select()
    .eq('circle_id', circleId)
    .order('starts_at', { ascending: true });
  return check(res, 'Could not load important events') ?? [];
}

export async function createImportant(circleId: string, input: ImportantInput): Promise<ImportantEvent> {
  const res = await getSupabase()
    .from('important_events')
    .insert({ ...input, circle_id: circleId, for_person: 'mom' })
    .select()
    .single();
  return check(res, 'Could not save the important event') as ImportantEvent;
}

export async function listCheckins(circleId: string): Promise<Checkin[]> {
  const res = await getSupabase().from('checkins').select().eq('circle_id', circleId);
  return check(res, 'Could not load check-ins') ?? [];
}

export async function submitCheckin(
  circleId: string,
  importantEventId: string,
  answer: CheckinAnswer,
  noteAudioUrl: string | null,
): Promise<Checkin> {
  const res = await getSupabase()
    .from('checkins')
    .upsert(
      { circle_id: circleId, important_event_id: importantEventId, answer, note_audio_url: noteAudioUrl, answered_at: new Date().toISOString() },
      { onConflict: 'important_event_id' },
    )
    .select()
    .single();
  return check(res, 'Could not save your answer') as Checkin;
}

// ---- Device calendar sync (cercana-care) --------------------------------------------------------

/** Creates a `source: device` calendar (no ICS url) and links the people who usually take part.
 * `deviceCalendarId` (the OS-level calendar id) is kept in `url_hint` so later syncs can re-fetch
 * events from it — device calendars have no secret to protect there, unlike ICS urls. */
export async function addDeviceCalendar(circleId: string, label: string, deviceCalendarId: string, personIds: string[]): Promise<string> {
  const db = getSupabase();
  const id = uuidv4();
  check(
    await db.from('calendars').insert({ id, circle_id: circleId, label, source: 'device', url_hint: deviceCalendarId }),
    'Could not save calendar',
  );
  if (personIds.length > 0) {
    check(
      await db.from('calendar_people').insert(personIds.map((person_id) => ({ calendar_id: id, person_id }))),
      'Could not link calendar to people',
    );
  }
  return id;
}

/** Connected device calendars, for re-syncing on app open / pull-to-refresh (see CalendarConnect.tsx). */
export async function listDeviceCalendars(circleId: string): Promise<DeviceCalendarLink[]> {
  const res = await getSupabase()
    .from('calendars_public')
    .select('id, url_hint')
    .eq('circle_id', circleId)
    .eq('source', 'device');
  const rows = (check(res, 'Could not load device calendars') ?? []) as { id: string; url_hint: string | null }[];
  return rows.filter((r): r is { id: string; url_hint: string } => !!r.url_hint).map((r) => ({ id: r.id, device_calendar_id: r.url_hint }));
}

/** Upserts device events (by uid + start) into an app/device calendar. Client-writable per migration 01. */
export async function upsertDeviceEvents(circleId: string, calendarId: string, rows: DeviceEventRow[]): Promise<void> {
  if (rows.length === 0) return;
  const res = await getSupabase()
    .from('events')
    .upsert(
      rows.map((r) => ({ circle_id: circleId, calendar_id: calendarId, ...r })),
      { onConflict: 'calendar_id,uid,starts_at' },
    );
  if (res.error) throw new Error(`Could not sync calendar events: ${res.error.message}`);
}

// ---- Scheduled morning brief (cercana-care) -------------------------------------------------------

export async function getBriefSettings(circleId: string): Promise<BriefSettings> {
  const res = await getSupabase().from('circles').select('brief_time, brief_enabled').eq('id', circleId).single();
  const row = check(res, 'Could not load morning brief settings') as { brief_time: string; brief_enabled: boolean };
  return { brief_time: row.brief_time.slice(0, 5), brief_enabled: row.brief_enabled }; // "09:00:00" → "09:00"
}

export async function updateBriefSettings(circleId: string, settings: BriefSettings): Promise<void> {
  check(await getSupabase().from('circles').update(settings).eq('id', circleId), 'Could not save morning brief settings');
}
