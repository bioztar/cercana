// Edge function `people`: every write to the `people` table (anon has SELECT only).
// Body: {circle_id, code, member_id?, action, ...}. Who may do what mirrors src/lib/permissions.ts:
//   join          {person}             anyone holding the code: creates their own claimed 'member' profile
//   claim         {person_id}          anyone holding the code: takes an unclaimed profile
//   unclaim       {person_id}          the device that claimed it (member_id = person_id)
//   create        {person}             lead/admin: adds an unclaimed profile
//   update        {person_id, person}  the profile's own device, or lead/admin
//   delete        {person_id}          lead, never the lead profile
//   set_role      {person_id, role}    lead, for others, 'admin' | 'member'
//   transfer_lead {person_id}          lead → a claimed non-lead profile
// `person` = {name, relation, phone, photo_url, birthday}; role / claimed / circle_id are never taken from it.
// Deploy: supabase functions deploy people
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { cors, json, serviceClient } from '../_shared/aiGuard.ts';
import { allow, authCircle, isLead, isStaff, readJson, str, UUID, type Caller, type Member } from '../_shared/circleAuth.ts';

const JOINS_PER_CIRCLE_PER_HOUR = 20;
const SELECT = 'id, circle_id, name, relation, phone, photo_url, birthday, role, claimed';

type Fields = { name: string; relation: string | null; phone: string | null; photo_url: string | null; birthday: string | null };

async function fields(db: SupabaseClient, v: unknown, circleId: string): Promise<Fields | string> {
  const p = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const name = str(p.name, 80);
  if (!name) return 'name is required';
  const phone = str(p.phone, 32);
  if (phone && !/^\+?[0-9 ()-]{5,32}$/.test(phone)) return 'phone must be digits (international format)';
  const photo = str(p.photo_url, 300);
  if (photo) {
    const own = await db.rpc('media_path_in_circle', { p_circle: circleId, p_path: photo });
    if (own.error || own.data !== true) return 'photo_url must be a photo uploaded for this circle';
  }
  const birthday = str(p.birthday, 10);
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return 'birthday must be YYYY-MM-DD';
  return { name, relation: str(p.relation, 80), phone, photo_url: photo, birthday };
}

async function target(db: SupabaseClient, caller: Caller, id: unknown): Promise<Member | null> {
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  const res = await db.from('people').select('id, circle_id, role, claimed, name').eq('id', id).eq('circle_id', caller.circle.id).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data as Member | null) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const body = await readJson(req);
  if (!body) return json({ error: 'Invalid JSON' }, 400);

  const db = serviceClient();
  const auth = await authCircle(db, req, body);
  if (!auth.ok) return json({ error: auth.denied.error }, auth.denied.status);
  const caller = auth.caller;
  const circleId = caller.circle.id;
  const people = () => db.from('people');

  try {
    switch (body.action) {
      case 'join': {
        const f = await fields(db, body.person, circleId);
        if (typeof f === 'string') return json({ error: f }, 400);
        if (!(await allow(db, `people:join:${circleId}`, JOINS_PER_CIRCLE_PER_HOUR, '1 hour'))) {
          return json({ error: 'Too many new profiles for this circle right now.' }, 429);
        }
        const res = await people().insert({ ...f, circle_id: circleId, role: 'member', claimed: true }).select(SELECT).single();
        if (res.error) return json({ error: res.error.message }, 400);
        return json({ person: res.data });
      }
      case 'claim': {
        const t = await target(db, caller, body.person_id);
        if (!t) return json({ error: 'no such profile' }, 404);
        const res = await people().update({ claimed: true }).eq('id', t.id).eq('claimed', false).select(SELECT).maybeSingle();
        if (res.error) return json({ error: res.error.message }, 400);
        if (!res.data) return json({ error: 'Someone already picked that profile. Please choose again.' }, 409);
        return json({ person: res.data });
      }
      case 'unclaim': {
        const t = await target(db, caller, body.person_id);
        if (!t) return json({ error: 'no such profile' }, 404);
        if (caller.member?.id !== t.id) return json({ error: 'only the device that claimed a profile can release it' }, 403);
        const res = await people().update({ claimed: false }).eq('id', t.id);
        if (res.error) return json({ error: res.error.message }, 400);
        return json({ ok: true });
      }
      case 'create': {
        if (!isStaff(caller)) return json({ error: 'only the lead or an admin can add people' }, 403);
        const f = await fields(db, body.person, circleId);
        if (typeof f === 'string') return json({ error: f }, 400);
        const res = await people().insert({ ...f, circle_id: circleId, role: 'member', claimed: false }).select(SELECT).single();
        if (res.error) return json({ error: res.error.message }, 400);
        return json({ person: res.data });
      }
      case 'update': {
        const t = await target(db, caller, body.person_id);
        if (!t) return json({ error: 'no such profile' }, 404);
        if (caller.member?.id !== t.id && !isStaff(caller)) return json({ error: 'you can only edit your own profile' }, 403);
        const f = await fields(db, body.person, circleId);
        if (typeof f === 'string') return json({ error: f }, 400);
        const res = await people().update(f).eq('id', t.id).select(SELECT).single();
        if (res.error) return json({ error: res.error.message }, 400);
        return json({ person: res.data });
      }
      case 'delete': {
        const t = await target(db, caller, body.person_id);
        if (!t) return json({ error: 'no such profile' }, 404);
        if (!isLead(caller) || t.role === 'lead') return json({ error: 'only the lead can remove people, and never the lead profile' }, 403);
        const res = await people().delete().eq('id', t.id);
        if (res.error) return json({ error: res.error.message }, 400);
        return json({ ok: true });
      }
      case 'set_role': {
        const t = await target(db, caller, body.person_id);
        if (!t) return json({ error: 'no such profile' }, 404);
        const role = body.role === 'admin' || body.role === 'member' ? body.role : null;
        if (!role) return json({ error: 'role must be admin or member' }, 400);
        if (!isLead(caller) || t.role === 'lead' || t.id === caller.member?.id) return json({ error: 'only the lead can change roles of others' }, 403);
        const res = await people().update({ role }).eq('id', t.id);
        if (res.error) return json({ error: res.error.message }, 400);
        return json({ ok: true });
      }
      case 'transfer_lead': {
        const t = await target(db, caller, body.person_id);
        if (!t) return json({ error: 'no such profile' }, 404);
        const me = caller.member;
        if (!me || !isLead(caller) || t.id === me.id || t.role === 'lead' || !t.claimed) {
          return json({ error: 'the lead can hand over only to another claimed member' }, 403);
        }
        const demoted = await people().update({ role: 'admin' }).eq('id', me.id).eq('role', 'lead');
        if (demoted.error) return json({ error: demoted.error.message }, 400);
        const promoted = await people().update({ role: 'lead' }).eq('id', t.id);
        if (promoted.error) {
          await people().update({ role: 'lead' }).eq('id', me.id);
          return json({ error: promoted.error.message }, 400);
        }
        return json({ ok: true });
      }
      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
