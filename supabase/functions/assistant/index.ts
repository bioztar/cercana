// Edge function `assistant`: Carmen's chat + family dictation.
// POST {circle_id, speaker_person_id|null, mode:'chat'|'dictate', text?, audio_url?, history[], now, tz}
//   → {reply, proposal?: {title, starts_at, ends_at?, location?, note?, all_day?}, distress}
// Loads people, the next 14 days of events and today's medicines server-side; thalamus does the language,
// assistantCore.ts does the date maths. Deploy: supabase functions deploy assistant
import { chat, transcribe, type Msg } from '../_shared/ai.ts';
import { buildSystemPrompt, FALLBACK_REPLY, shapeResponse, validateRequest } from '../_shared/assistantCore.ts';
import { cors, json, overDailyCap, serviceClient, writeLog } from '../_shared/aiGuard.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const v = validateRequest(raw);
  if (!v.ok) return json({ error: v.error }, 400);
  const r = v.value;

  const db = serviceClient();
  try {
    const circle = await db.from('circles').select('patient_name').eq('id', r.circle_id).maybeSingle();
    if (!circle.data) return json({ error: 'unknown circle' }, 404);
    if (await overDailyCap(db, r.circle_id)) return json({ error: 'daily limit reached' }, 429);

    let text = r.text;
    if (!text && r.audio_url) {
      const allowed = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/media/`;
      if (!r.audio_url.startsWith(allowed)) return json({ error: 'audio_url must be in the media bucket' }, 400);
      text = (await transcribe(r.audio_url)).text.trim().slice(0, 1000);
    }
    if (!text) return json({ reply: FALLBACK_REPLY, distress: false });

    const now = new Date(r.now);
    const horizon = new Date(now.getTime() + 14 * 86_400_000);
    const [peopleRes, eventsRes, medsRes] = await Promise.all([
      db.from('people').select('id, name, relation').eq('circle_id', r.circle_id).limit(60),
      db.from('events').select('title, starts_at, all_day, location').eq('circle_id', r.circle_id)
        .gte('ends_at', now.toISOString()).lte('starts_at', horizon.toISOString()).order('starts_at').limit(60),
      db.from('medications').select('name, dose, times').eq('circle_id', r.circle_id).eq('active', true).limit(30),
    ]);
    const people = (peopleRes.data ?? []) as { id: string; name: string; relation: string | null }[];
    const speaker = r.speaker_person_id ? people.find((p) => p.id === r.speaker_person_id) ?? null : null;
    const doses = ((medsRes.data ?? []) as { name: string; dose: string; times: string[] }[])
      .flatMap((m) => m.times.map((time) => ({ name: m.name, dose: m.dose, time })))
      .sort((a, b) => a.time.localeCompare(b.time));

    const system = buildSystemPrompt({
      patientName: circle.data.patient_name, speaker: speaker && { name: speaker.name, relation: speaker.relation },
      mode: r.mode, people, events: (eventsRes.data ?? []) as never, doses, now, tz: r.tz,
    });
    const messages: Msg[] = [
      { role: 'system', content: system },
      ...r.history.map((h): Msg => ({ role: h.role, content: h.text })),
      { role: 'user', content: text },
    ];

    let out;
    try {
      out = shapeResponse(await chat(messages, { json: true, maxTokens: 500 }), { text, mode: r.mode }, now, r.tz);
    } catch (e) {
      console.error('assistant model failed', e instanceof Error ? e.message : e);
      out = shapeResponse(null, { text, mode: r.mode }, now, r.tz); // keeps the keyword distress net working
    }
    await writeLog(db, {
      circle_id: r.circle_id, kind: r.mode === 'dictate' ? 'dictation' : 'assistant', speaker_person_id: r.speaker_person_id,
      input: text, output: out, distress: out.distress,
    });
    return json(out);
  } catch (e) {
    console.error('assistant failed', e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : 'assistant failed' }, 502);
  }
});
