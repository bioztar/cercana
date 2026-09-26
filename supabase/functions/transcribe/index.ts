// Edge function `transcribe`: POST {circle_id, audio_url} → {text, language} (Deepgram via _shared/ai.ts).
// Deploy: supabase functions deploy transcribe   (secrets DEEPGRAM_API_KEY etc. are set in Supabase.)
import { transcribe } from '../_shared/ai.ts';
import { cors, json, overDailyCap, serviceClient, writeLog } from '../_shared/aiGuard.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: { circle_id?: unknown; audio_url?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const circleId = body.circle_id;
  const audioUrl = body.audio_url;
  if (typeof circleId !== 'string' || !UUID.test(circleId)) return json({ error: 'circle_id must be a uuid' }, 400);
  if (typeof audioUrl !== 'string' || audioUrl.length > 500) return json({ error: 'audio_url is required' }, 400);
  // Only our own public `media` bucket: otherwise this is an open proxy that fetches any URL.
  const allowed = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/media/`;
  if (!audioUrl.startsWith(allowed)) return json({ error: 'audio_url must be in the media bucket' }, 400);

  const db = serviceClient();
  try {
    const circle = await db.from('circles').select('id').eq('id', circleId).maybeSingle();
    if (!circle.data) return json({ error: 'unknown circle' }, 404);
    if (await overDailyCap(db, circleId)) return json({ error: 'daily limit reached' }, 429);
    const out = await transcribe(audioUrl);
    await writeLog(db, { circle_id: circleId, kind: 'dictation', speaker_person_id: null, input: audioUrl, output: out });
    return json(out);
  } catch (e) {
    console.error('transcribe failed', e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : 'transcribe failed' }, 502);
  }
});
