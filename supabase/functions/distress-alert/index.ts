// Edge function `distress-alert`: pushes an immediate "please check in" to the family when the
// assistant flags distress. Called by the ai_log trigger (20260926_05_digest.sql), which already applied
// the one-alert-per-30-min rate limit. Service-role bearer only: the anon key is public.
// Devices do not record which person owns them yet, so the lead cannot be singled out: every family
// device in the circle is notified. The body carries no quote of what she said.
// Deploy: supabase functions deploy distress-alert
import { json, serviceClient } from '../_shared/aiGuard.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  // Only the database (pg_cron / the distress trigger) may call this: it sends CRON_SECRET from Vault.
  // The Authorization header only has to pass the gateway's JWT check; the anon key does that too.
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) return json({ error: 'missing setting CRON_SECRET' }, 500);
  if (req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403);

  let input: { circle_id?: string; ai_log_id?: string };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!input.circle_id || !UUID.test(input.circle_id)) return json({ error: 'circle_id required' }, 400);

  const db = serviceClient();
  const [circle, devices] = await Promise.all([
    db.from('circles').select('patient_name').eq('id', input.circle_id).single(),
    db.from('devices').select('push_token').eq('circle_id', input.circle_id).eq('role', 'family'),
  ]);
  if (circle.error || !circle.data) return json({ error: 'circle not found' }, 404);
  if (devices.error) return json({ error: devices.error.message }, 500);

  const tokens = (devices.data ?? []).map((d) => d.push_token).filter((t): t is string => !!t);
  if (tokens.length === 0) return json({ pushed: 0 });

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      tokens.map((to) => ({
        to,
        sound: 'default',
        title: `${circle.data.patient_name} may need you`,
        body: `The assistant noticed ${circle.data.patient_name} seemed upset. Please check in with a call or a message.`,
        data: { kind: 'distress', ai_log_id: input.ai_log_id ?? null },
      })),
    ),
  });
  if (!res.ok) {
    console.error('expo push failed', res.status, await res.text());
    return json({ pushed: 0, error: 'push failed' }, 502);
  }
  return json({ pushed: tokens.length });
});
