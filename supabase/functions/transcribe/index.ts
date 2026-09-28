// Edge function `transcribe`: POST {circle_id, code, audio_url} → {text, language} (Deepgram via _shared/ai.ts).
// `audio_url` is the storage PATH of a voice note uploaded for the circle; a signed URL is minted here.
// Deploy: supabase functions deploy transcribe   (secrets DEEPGRAM_API_KEY etc. are set in Supabase.)
import { transcribe } from '../_shared/ai.ts';
import { cors, json, overDailyCap, serviceClient, signedMediaUrl, writeLog } from '../_shared/aiGuard.ts';
import { authCircle, readJson } from '../_shared/circleAuth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const body = await readJson(req);
  if (!body) return json({ error: 'Invalid JSON' }, 400);
  const audioPath = body.audio_url;
  if (typeof audioPath !== 'string' || !audioPath || audioPath.length > 300) return json({ error: 'audio_url is required' }, 400);

  const db = serviceClient();
  const auth = await authCircle(db, req, body);
  if (!auth.ok) return json({ error: auth.denied.error }, auth.denied.status);
  const circleId = auth.caller.circle.id;
  try {
    const audioUrl = await signedMediaUrl(db, circleId, audioPath);
    if (!audioUrl) return json({ error: 'audio_url must be a voice note uploaded for this circle' }, 400);
    if (await overDailyCap(db, circleId)) return json({ error: 'daily limit reached' }, 429);
    const out = await transcribe(audioUrl);
    await writeLog(db, { circle_id: circleId, kind: 'dictation', speaker_person_id: null, input: audioPath, output: out });
    return json(out);
  } catch (e) {
    console.error('transcribe failed', e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : 'transcribe failed' }, 502);
  }
});
