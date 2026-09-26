// Edge function `digest`: the evening "Today with <patient>" note for a circle.
// POST { circle_id, day? } with the service-role key as bearer (the anon key is public, and this
// spends model budget, so it is not callable with it). Called daily by pg_cron (20260926_05_digest.sql).
// One row per circle and day: a second call returns the stored digest instead of asking the model again.
// Deploy: supabase functions deploy digest
import { chat } from '../_shared/ai.ts';
import { json, overDailyCap, serviceClient, writeLog } from '../_shared/aiGuard.ts';
import {
  computeMetrics, doseCounts, driftFlags, fallbackNote, notePrompt, rawLines, watchLine, windowFor,
  type Metrics,
} from '../_shared/digestMetrics.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return json({ error: 'missing setting SUPABASE_SERVICE_ROLE_KEY' }, 500);
  if (req.headers.get('Authorization') !== `Bearer ${serviceKey}`) return json({ error: 'forbidden' }, 403);

  let input: { circle_id?: string; day?: string };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!input.circle_id || !UUID.test(input.circle_id)) return json({ error: 'circle_id required' }, 400);
  if (input.day && !DAY.test(input.day)) return json({ error: 'day must be YYYY-MM-DD' }, 400);

  const db = serviceClient();
  const circleId = input.circle_id;

  const { data: circle, error: cErr } = await db.from('circles').select('patient_name, tz').eq('id', circleId).single();
  if (cErr || !circle) return json({ error: 'circle not found' }, 404);
  const tz: string = circle.tz || 'Europe/Madrid';
  const name: string = circle.patient_name;

  const now = new Date();
  const win = windowFor(now, tz, input.day);
  const from = win.start.toISOString();
  const to = win.end.toISOString();

  const existing = await db.from('digests').select().eq('circle_id', circleId).eq('day', win.day).maybeSingle();
  if (existing.data) return json({ digest: existing.data, cached: true });

  const since = (table: string, col = 'created_at') =>
    db.from(table).select().eq('circle_id', circleId).gte(col, from).lt(col, to).limit(500);
  const [ai, meds, logs, pings, moments, messages, prev] = await Promise.all([
    db.from('ai_log').select('kind, speaker_person_id, input, distress, created_at').eq('circle_id', circleId).gte('created_at', from).lt('created_at', to).limit(500),
    db.from('medications').select('id, times, active, created_at').eq('circle_id', circleId),
    db.from('medication_logs').select().eq('circle_id', circleId).gte('scheduled_for', new Date(win.start.getTime() - 86_400_000).toISOString()).lt('scheduled_for', to),
    since('pings'),
    since('moments'),
    since('messages'), // no such table yet: the error is ignored and the count stays 0
    db.from('digests').select('metrics').eq('circle_id', circleId).lt('day', win.day).gte('day', new Date(Date.parse(win.day) - 7 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  for (const r of [ai, meds, logs, pings, moments, prev]) if (r.error) return json({ error: r.error.message }, 500);

  const aiRows = (ai.data ?? []) as { kind: string; speaker_person_id: string | null; input: string | null; distress: boolean; created_at: string }[];
  // null speaker = the patient; digest rows are ours (also null speaker), not her activity
  const hers = aiRows.filter((r) => r.speaker_person_id === null && r.kind !== 'digest');
  const questions = hers.filter((r) => r.kind === 'assistant' && r.input?.trim()).map((r) => r.input!.trim());
  const momMoments = (moments.data ?? []).filter((m: { by_patient: boolean }) => m.by_patient);
  const answered = (logs.data ?? []).map((l: { answered_at: string }) => new Date(l.answered_at)).filter((d: Date) => d >= win.start && d < win.end);

  const metrics: Metrics = computeMetrics({
    questions,
    activityAt: [
      ...hers.map((r) => new Date(r.created_at)),
      ...momMoments.map((m: { created_at: string }) => new Date(m.created_at)),
      ...answered,
    ],
    tz,
    doses: doseCounts(meds.data ?? [], logs.data ?? [], win.start, win.end, now, tz),
    pings: (pings.data ?? []).length,
    moments: (moments.data ?? []).length,
    messages: messages.error ? 0 : (messages.data ?? []).length,
    distress: aiRows.filter((r) => r.distress).length,
  });

  const watch = watchLine(driftFlags(metrics, (prev.data ?? []).map((r: { metrics: Metrics }) => r.metrics)), name);

  const lines = rawLines([
    ...questions.map((q) => `asked: ${q}`),
    ...momMoments.map((m: { body: string | null }) => (m.body ? `posted: ${m.body}` : '')),
    ...(pings.data ?? []).map((p: { from_name: string | null; message: string }) => `${p.from_name ?? 'family'} sent: ${p.message}`),
  ]);

  let note = fallbackNote(name, metrics);
  if (!(await overDailyCap(db, circleId))) {
    try {
      const p = notePrompt(name, metrics, lines);
      const text = String(await chat([{ role: 'system', content: p.system }, { role: 'user', content: p.user }], { maxTokens: 300 })).trim();
      if (text) note = text.slice(0, 800);
    } catch (e) {
      console.error('digest note failed, using template', e instanceof Error ? e.message : e);
    }
  }

  const saved = await db
    .from('digests')
    .upsert({ circle_id: circleId, day: win.day, note, watch, metrics }, { onConflict: 'circle_id,day', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (saved.error) return json({ error: saved.error.message }, 500);

  await writeLog(db, {
    circle_id: circleId, kind: 'digest', speaker_person_id: null, input: `digest ${win.day}`,
    output: { note, watch, metrics },
  });

  return json({ digest: saved.data ?? { circle_id: circleId, day: win.day, note, watch, metrics }, cached: false });
});
