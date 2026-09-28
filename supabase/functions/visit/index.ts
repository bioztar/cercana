// Edge function `visit`: a recorded doctor visit -> transcript -> summary + proposed changes.
// POST { circle_id, code, audio_url, recorded_by_person_id, now, tz } -> { visit }
//   (audio_url = storage path of a recording uploaded for the circle)
// Deploy: supabase functions deploy visit  (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected by Supabase;
// THALAMUS_* and DEEPGRAM_API_KEY are Supabase secrets, read in _shared/ai.ts.)
import { chat, transcribe } from '../_shared/ai.ts';
import { cors, json, overDailyCap, serviceClient, signedMediaUrl, writeLog } from '../_shared/aiGuard.ts';
import { authCircle } from '../_shared/circleAuth.ts';
import { MAX_TRANSCRIPT_CHARS, parseVisit, visitPrompt } from '../_shared/visit.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let input: { circle_id?: string; code?: string; audio_url?: string; recorded_by_person_id?: string | null; now?: string; tz?: string };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const { audio_url } = input;
  if (typeof audio_url !== 'string' || !audio_url) return json({ error: 'circle_id, code and audio_url are required' }, 400);
  const nowIso = input.now && !Number.isNaN(Date.parse(input.now)) ? input.now : new Date().toISOString();
  const tz = (input.tz ?? 'Europe/Madrid').slice(0, 64);

  const db = serviceClient();
  const auth = await authCircle(db, req, input as Record<string, unknown>);
  if (!auth.ok) return json({ error: auth.denied.error }, auth.denied.status);
  const circle_id = auth.caller.circle.id;
  const circle = { data: { patient_name: auth.caller.circle.patient_name } };

  try {
    // The anon key is public: only fetch audio that lives in our own bucket, under this circle.
    const audioUrl = await signedMediaUrl(db, circle_id, audio_url);
    if (!audioUrl) return json({ error: 'audio_url must be a recording uploaded for this circle' }, 400);
    if (await overDailyCap(db, circle_id)) return json({ error: 'daily limit reached' }, 429);

    const { text } = await transcribe(audioUrl);
    const transcript = text.trim();
    if (!transcript) return json({ error: 'nothing was heard in the recording' }, 422);
    if (transcript.length > MAX_TRANSCRIPT_CHARS) return json({ error: 'recording too long' }, 413);

    const raw = await chat(
      [
        { role: 'system', content: visitPrompt(circle.data.patient_name, nowIso, tz) },
        { role: 'user', content: transcript },
      ],
      { json: true, maxTokens: 1800 },
    );
    const result = parseVisit(raw, transcript);
    if (!result) return json({ error: 'could not make a summary of this visit' }, 502);

    const { summary, patient_summary, med_changes, follow_ups } = result;
    const inserted = await db.from('visits').insert({
      circle_id, audio_url, transcript, summary, patient_summary,
      recorded_by_person_id: input.recorded_by_person_id ?? null,
      proposals: { med_changes, follow_ups },
    }).select().single();
    if (inserted.error) return json({ error: inserted.error.message }, 500);

    await writeLog(db, {
      circle_id, kind: 'visit', speaker_person_id: input.recorded_by_person_id ?? null,
      input: transcript.slice(0, 2000), output: { visit_id: inserted.data.id, ...result },
    });

    return json({ visit: inserted.data });
  } catch (e) {
    console.error('visit failed', e);
    return json({ error: e instanceof Error ? e.message : 'visit failed' }, 502);
  }
});
