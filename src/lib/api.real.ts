// All Supabase data access lives here.
import { getSupabase } from './supabase';
import { generateCode, normalizeCode, isValidCode, urlHint, uuidv4 } from './util';
import type {
  CalendarPublic, Circle, EventRow, Moment, MomentInput, Person, PersonInput, Ping,
} from './types';

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

export async function createCircle(patientName: string): Promise<Circle> {
  const db = getSupabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await db
      .from('circles')
      .insert({ code: generateCode(), patient_name: patientName })
      .select()
      .single();
    if (!res.error) return res.data as Circle;
    if (res.error.code !== '23505') throw new Error(`Could not create circle: ${res.error.message}`);
  }
  throw new Error('Could not create a unique circle code, try again');
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

export async function savePerson(circleId: string, p: PersonInput): Promise<Person> {
  const row = { ...p, circle_id: circleId };
  const q = getSupabase().from('people');
  const res = await (p.id ? q.update(row).eq('id', p.id) : q.insert(row)).select().single();
  return check(res, 'Could not save person') as Person;
}

export async function deletePerson(id: string): Promise<void> {
  check(await getSupabase().from('people').delete().eq('id', id), 'Could not delete person');
}

export async function listMoments(circleId: string, personId?: string, limit = 50): Promise<Moment[]> {
  let q = getSupabase().from('moments').select().eq('circle_id', circleId);
  if (personId) q = q.eq('person_id', personId);
  const res = await q.order('created_at', { ascending: false }).limit(limit);
  return check(res, 'Could not load moments') ?? [];
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
): Promise<string | null> {
  const db = getSupabase();
  const id = uuidv4(); // client-side id: the row cannot be read back (select on calendars is revoked)
  check(
    await db.from('calendars').insert({ id, circle_id: circleId, label, ics_url: icsUrl.trim(), url_hint: urlHint(icsUrl) }),
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
    .select('id, calendar_id, uid, title, location, starts_at, ends_at, all_day')
    .eq('circle_id', circleId)
    .gte('ends_at', since) // keeps multi-day events that began earlier but are still running
    .order('starts_at', { ascending: true })
    .limit(500);
  const rows = (check(res, 'Could not load events') ?? []) as Omit<EventRow, 'person_ids'>[];
  const links = await personIdsByCalendar([...new Set(rows.map((r) => r.calendar_id))]);
  return rows.map((r) => ({ ...r, person_ids: links.get(r.calendar_id) ?? [] }));
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
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}
