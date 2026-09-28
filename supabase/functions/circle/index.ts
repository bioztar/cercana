// Edge function `circle`: the only way to create a circle, look one up by code, or register a push
// token (anon has no INSERT on circles / devices and can never read circles.code).
//   {action:'create', patient_name, lead?:{name, relation}}   → {circle:{id, code, patient_name}, lead_id}
//   {action:'lookup', code}                                    → {circle:{id, code, patient_name}}
//   {action:'register_device', circle_id, code, role, push_token, platform}
// Creation is throttled per IP and globally per day so minting circles cannot be used to bypass the
// per-circle AI cap. Deploy: supabase functions deploy circle
import { cors, json, serviceClient } from '../_shared/aiGuard.ts';
import { allow, authCircle, clientIp, normalizeCode, CODE, readJson, str } from '../_shared/circleAuth.ts';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // = src/lib/util.ts CODE_ALPHABET
const CREATE_PER_IP_PER_HOUR = 5;
const CREATE_PER_DAY = 100;
const LOOKUP_PER_IP_PER_MINUTE = 20;

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const body = await readJson(req);
  if (!body) return json({ error: 'Invalid JSON' }, 400);
  const db = serviceClient();
  const ip = clientIp(req);

  if (body.action === 'create') {
    const patientName = str(body.patient_name, 80);
    if (!patientName) return json({ error: 'patient_name is required' }, 400);
    const leadIn = body.lead && typeof body.lead === 'object' ? (body.lead as Record<string, unknown>) : null;
    const leadName = leadIn ? str(leadIn.name, 80) : null;
    if (leadIn && !leadName) return json({ error: 'lead.name is required' }, 400);
    if (!(await allow(db, `circle:create:ip:${ip}`, CREATE_PER_IP_PER_HOUR, '1 hour')) || !(await allow(db, 'circle:create:all', CREATE_PER_DAY, '1 day'))) {
      return json({ error: 'Too many new circles right now, please try again later.' }, 429);
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const made = await db.from('circles').insert({ code: generateCode(), patient_name: patientName }).select('id, code, patient_name').single();
      if (made.error) {
        if (made.error.code === '23505') continue;
        return json({ error: made.error.message }, 500);
      }
      const circle = made.data;
      if (!leadName) return json({ circle, lead_id: null });
      const lead = await db
        .from('people')
        .insert({ circle_id: circle.id, name: leadName, relation: str(leadIn?.relation, 80), role: 'lead', claimed: true })
        .select('id')
        .single();
      if (lead.error) {
        await db.from('circles').delete().eq('id', circle.id); // do not leave a circle without its lead
        return json({ error: lead.error.message }, 500);
      }
      return json({ circle, lead_id: lead.data.id });
    }
    return json({ error: 'Could not create a unique circle code, try again' }, 500);
  }

  if (body.action === 'lookup') {
    const code = normalizeCode(body.code);
    if (!CODE.test(code)) return json({ circle: null });
    if (!(await allow(db, `circle:lookup:ip:${ip}`, LOOKUP_PER_IP_PER_MINUTE, '1 minute'))) {
      return json({ error: 'Too many attempts, try again in a minute.' }, 429);
    }
    const res = await db.from('circles').select('id, code, patient_name').eq('code', code).maybeSingle();
    if (res.error) return json({ error: res.error.message }, 500);
    return json({ circle: res.data ?? null });
  }

  if (body.action === 'register_device') {
    const auth = await authCircle(db, req, body);
    if (!auth.ok) return json({ error: auth.denied.error }, auth.denied.status);
    const role = body.role === 'patient' || body.role === 'family' ? body.role : null;
    const token = str(body.push_token, 200);
    if (!role || !token) return json({ error: 'role and push_token are required' }, 400);
    const res = await db
      .from('devices')
      .upsert({ circle_id: auth.caller.circle.id, role, push_token: token, platform: str(body.platform, 20) }, { onConflict: 'push_token' });
    if (res.error) return json({ error: res.error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: 'unknown action' }, 400);
});
