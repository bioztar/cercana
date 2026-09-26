// Edge function `see`: Carmen's camera helpers.
//   who    — "Who is this?": match a photo against the circle's people photos.
//   letter — "Read this for me": plain-words summary + scam check of a letter/bill/SMS photo.
// Deploy: supabase functions deploy see   (helm deploys; needs THALAMUS_* secrets, see _shared/ai.ts)
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { chat } from '../_shared/ai.ts';
import { cors, json, overDailyCap, serviceClient, writeLog } from '../_shared/aiGuard.ts';
import {
  isMediaUrl, letterFeedBody, letterMessages, letterSpoken, parseLetter, parseWho, shouldAlert,
  whoMessages, whoReply, withMediaPhoto, type Known,
} from '../_shared/see.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let input: { circle_id?: string; mode?: string; image_url?: string };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const { circle_id, mode, image_url } = input;
  if (!circle_id || (mode !== 'who' && mode !== 'letter')) return json({ error: 'circle_id and mode (who|letter) are required' }, 400);
  if (!isMediaUrl(image_url, supabaseUrl)) return json({ error: 'image_url must be an uploaded photo' }, 400);

  const db = serviceClient();

  try {
    if (await overDailyCap(db, circle_id)) return json({ error: 'Daily limit reached. Please try again tomorrow.' }, 429);
  } catch (e) {
    console.error('cap check failed', e instanceof Error ? e.message : e);
    return json({ error: 'Could not check usage' }, 500);
  }

  const [{ data: circle }, { data: people, error: pErr }] = await Promise.all([
    db.from('circles').select('patient_name').eq('id', circle_id).maybeSingle(),
    db.from('people').select('id, name, relation, photo_url, role').eq('circle_id', circle_id),
  ]);
  if (pErr || !circle) return json({ error: 'Circle not found' }, 404);
  const family = (people ?? []) as Known[];

  const log = (output: unknown) =>
    writeLog(db, { circle_id, kind: mode, speaker_person_id: null, input: image_url, output });

  try {
    if (mode === 'who') {
      const known = withMediaPhoto(family, supabaseUrl);
      const match = known.length ? parseWho(await chat(whoMessages(image_url, known, supabaseUrl), { json: true, maxTokens: 200 }), known) : null;
      const reply = whoReply(match);
      await log({ person_id: match?.id ?? null, confident: !!match, reply });
      return json({ person_id: match?.id ?? null, confident: !!match, reply });
    }

    const letter = parseLetter(await chat(letterMessages(image_url), { json: true, maxTokens: 500 }));
    const alerted = shouldAlert(letter);
    const lead = family.find((p) => p.role === 'lead')?.name ?? null;
    const reply = letterSpoken(letter, lead);
    await log({ ...letter, alerted, reply });
    await db.from('moments').insert({
      circle_id, person_id: null, author_person_id: null, author: circle.patient_name,
      body: letterFeedBody(circle.patient_name, letter), photo_url: image_url, audio_url: null, by_patient: true,
    });
    if (alerted) await pushFamily(db, circle_id, `${circle.patient_name} photographed a letter`, letter.scam_risk === 'high' ? 'It looks like a scam.' : letter.summary);
    return json({ ...letter, alerted, reply });
  } catch (e) {
    console.error('see failed', e instanceof Error ? e.message : e);
    return json({ error: 'Could not look at that photo right now.' }, 502);
  }
});

async function pushFamily(db: SupabaseClient, circleId: string, title: string, body: string) {
  const { data } = await db.from('devices').select('push_token').eq('circle_id', circleId).eq('role', 'family');
  const tokens = (data ?? []).map((d: { push_token: string | null }) => d.push_token).filter((t): t is string => !!t);
  if (!tokens.length) return;
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({ to, sound: 'default', title, body }))),
  });
  if (!res.ok) console.error('expo push failed', res.status);
}
