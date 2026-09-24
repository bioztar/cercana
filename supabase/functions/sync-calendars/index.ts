// Edge function `sync-calendars`: fetches ICS feeds server-side (browsers cannot: no CORS on
// Google/iCloud feeds), expands recurrences for now-1d .. now+60d, and replaces each calendar's `events`.
//
// Body: { calendar_id } | { circle_id } | {}   ({} = every calendar; used by the pg_cron schedule).
// Deploy: supabase functions deploy sync-calendars
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by Supabase. The service role is the only
// reader of calendars.ics_url — a secret ICS URL is read access to a whole calendar. Never log it.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import ICAL from 'npm:ical.js@2.2.1';
import { expandIcs, normalizeFeedUrl } from '../_shared/ics.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const WINDOW_BACK_MS = 86_400_000;
const WINDOW_FWD_MS = 60 * 86_400_000;
const MAX_BYTES = 5_000_000;
const MAX_REDIRECTS = 3;

/** Refuse loopback / private / link-local targets (basic SSRF guard; hostnames only, no DNS resolution). */
function isPublicHost(url: string): boolean {
  const host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (host.includes(':')) return !/^(::1?$|f[cd]|fe80)/.test(host); // IPv6 loopback / ULA / link-local
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  if (!m) return true;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return !(a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
}

/** Errors are shown to family members, so they must never contain the feed URL. */
class FeedError extends Error {}

async function fetchFeed(rawUrl: string): Promise<string> {
  let url = normalizeFeedUrl(rawUrl);
  if (!url) throw new FeedError('Not a valid http(s)/webcal address');
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicHost(url)) throw new FeedError('Address is not allowed');
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { Accept: 'text/calendar, */*' } });
    } catch {
      throw new FeedError('Could not reach the calendar address');
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url).toString();
      continue;
    }
    if (!res.ok) throw new FeedError(`Calendar server answered HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new FeedError('Calendar is too large');
    if (!text.includes('BEGIN:VCALENDAR')) throw new FeedError('That address is not an ICS calendar');
    return text;
  }
  throw new FeedError('Too many redirects');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let input: { calendar_id?: string; circle_id?: string } = {};
  try {
    input = await req.json();
  } catch {
    /* empty body = sync everything */
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let q = db.from('calendars').select('id, circle_id, ics_url, includes_patient').eq('source', 'ics');
  if (input.calendar_id) q = q.eq('id', input.calendar_id);
  else if (input.circle_id) q = q.eq('circle_id', input.circle_id);
  const { data: calendars, error } = await q;
  if (error) return json({ error: error.message }, 400);

  const now = Date.now();
  const from = new Date(now - WINDOW_BACK_MS);
  const to = new Date(now + WINDOW_FWD_MS);
  const results: { calendar_id: string; ok: boolean; events?: number; error?: string }[] = [];

  for (const cal of calendars ?? []) {
    try {
      const text = await fetchFeed(cal.ics_url);
      const events = expandIcs(ICAL, text, from, to);
      const rows = events.map((e) => ({ ...e, calendar_id: cal.id, circle_id: cal.circle_id, includes_patient: cal.includes_patient ?? false }));

      const del = await db.from('events').delete().eq('calendar_id', cal.id);
      if (del.error) throw new Error(del.error.message);
      for (let i = 0; i < rows.length; i += 500) {
        const ins = await db.from('events').insert(rows.slice(i, i + 500));
        if (ins.error) throw new Error(ins.error.message);
      }
      await db.from('calendars').update({ last_synced_at: new Date().toISOString(), last_error: null }).eq('id', cal.id);
      results.push({ calendar_id: cal.id, ok: true, events: rows.length });
    } catch (e) {
      // FeedError text is URL-free by construction; anything else is reported generically.
      const message = e instanceof FeedError ? e.message : 'Could not read the calendar';
      console.error('sync failed', cal.id, message);
      await db.from('calendars').update({ last_error: message }).eq('id', cal.id);
      results.push({ calendar_id: cal.id, ok: false, error: message });
    }
  }
  return json({ results });
});
