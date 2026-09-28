// Edge function `ping`: stores a ping and pushes it to every patient device in the circle.
// The only writer of `pings` (anon has SELECT only): the patient's phone speaks every row aloud, so
// the caller must hold the circle code and the circle is rate limited.
// Deploy: supabase functions deploy ping   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.)
import { cors, json, serviceClient } from '../_shared/aiGuard.ts';
import { allow, authCircle, readJson, str } from '../_shared/circleAuth.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PER_MINUTE = 5;
const PER_DAY = 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const input = await readJson(req);
  if (!input) return json({ error: 'Invalid JSON' }, 400);
  const message = str(input.message, 500);
  if (!message) return json({ error: 'message is required (max 500 chars)' }, 400);

  const db = serviceClient();
  const auth = await authCircle(db, req, input);
  if (!auth.ok) return json({ error: auth.denied.error }, auth.denied.status);
  const { circle, member, patient } = auth.caller;
  if (patient) return json({ error: 'pings are sent by family members' }, 403);

  const key = `ping:${circle.id}`;
  if (!(await allow(db, `${key}:m`, PER_MINUTE, '1 minute')) || !(await allow(db, `${key}:d`, PER_DAY, '1 day'))) {
    return json({ error: 'Too many pings, please wait a little.' }, 429);
  }

  // The spoken sender name is the claimed profile's name when the device has one.
  const fromName = member?.name ?? str(input.from_name, 80);
  const { data: ping, error } = await db
    .from('pings')
    .insert({ circle_id: circle.id, from_name: fromName, person_id: member?.id ?? null, message })
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);

  const { data: devices, error: devErr } = await db
    .from('devices')
    .select('push_token')
    .eq('circle_id', circle.id)
    .eq('role', 'patient');
  if (devErr) return json({ ping, pushed: 0, warning: devErr.message });

  const tokens = (devices ?? []).map((d) => d.push_token).filter((t): t is string => !!t);
  let pushed = 0;
  if (tokens.length > 0) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          sound: 'default',
          title: ping.from_name ? `${ping.from_name} says` : 'A message for you',
          body: message,
          data: ping, // the app reads id / from_name / message from here on tap
        })),
      ),
    });
    if (res.ok) pushed = tokens.length;
    else console.error('expo push failed', res.status, await res.text());
  }

  return json({ ping, pushed });
});
