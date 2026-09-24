// Edge function `ping`: stores a ping and pushes it to every patient device in the circle.
// Deploy: supabase functions deploy ping   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let input: { circle_id?: string; from_name?: string; person_id?: string | null; message?: string };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const message = input.message?.trim();
  if (!input.circle_id || !message) return json({ error: 'circle_id and message are required' }, 400);
  if (message.length > 500) return json({ error: 'message too long' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: ping, error } = await db
    .from('pings')
    .insert({
      circle_id: input.circle_id,
      from_name: input.from_name?.trim() || null,
      person_id: input.person_id ?? null,
      message,
    })
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);

  const { data: devices, error: devErr } = await db
    .from('devices')
    .select('push_token')
    .eq('circle_id', input.circle_id)
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
