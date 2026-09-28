// The app's flows through the edge functions, and the direct writes they replaced being refused.
// Runs with the anon key against the LOCAL stack (supabase/tests/functions.sh); never the project.
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const anon = createClient(URL, ANON);

async function fn<T = Record<string, unknown>>(name: string, body: unknown): Promise<{ status: number; json: T }> {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON}`, apikey: ANON },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as T };
}

type Circle = { id: string; code: string; patient_name: string };
type Person = { id: string; circle_id: string; name: string; phone: string | null; photo_url: string | null; role: string; claimed: boolean };

// One circle for the whole file, created the way the app does (CreateCircle screen → circle fn).
const created = await fn<{ circle: Circle; lead_id: string }>('circle', { action: 'create', patient_name: 'Carmen', lead: { name: 'Lucia', relation: 'daughter' } });
assertEquals(created.status, 200, JSON.stringify(created.json));
const circle = created.json.circle;
const leadId = created.json.lead_id;
const creds = { circle_id: circle.id, code: circle.code, member_id: leadId };

const other = await fn<{ circle: Circle; lead_id: string }>('circle', { action: 'create', patient_name: 'Other', lead: { name: 'Stranger' } });
assertEquals(other.status, 200);

Deno.test('circle: code is never readable by anon, lookup goes through the function', async () => {
  const direct = await anon.from('circles').select('code').eq('id', circle.id);
  assert(direct.error, 'anon must not read circles.code');
  const found = await fn<{ circle: Circle | null }>('circle', { action: 'lookup', code: circle.code.toLowerCase() });
  assertEquals(found.json.circle?.id, circle.id);
  const missing = await fn<{ circle: Circle | null }>('circle', { action: 'lookup', code: 'ZZZZZZ' });
  assertEquals(missing.json.circle, null);
});

Deno.test('pings: direct anon INSERT refused, function insert works and is readable (realtime)', async () => {
  const direct = await anon.from('pings').insert({ circle_id: circle.id, from_name: 'Evil', message: 'boo' });
  assertEquals(direct.error?.code, '42501');

  const sent = await fn<{ ping: { id: string; from_name: string; message: string } }>('ping', { ...creds, message: 'Thinking of you' });
  assertEquals(sent.status, 200, JSON.stringify(sent.json));
  assertEquals(sent.json.ping.from_name, 'Lucia');

  const wrong = await fn('ping', { ...creds, code: 'ZZZZZZ', message: 'boo' });
  assertEquals(wrong.status, 404);
  const patient = await fn('ping', { circle_id: circle.id, code: circle.code, role: 'patient', message: 'boo' });
  assertEquals(patient.status, 403);

  const rows = await anon.from('pings').select('id, message').eq('circle_id', circle.id);
  assertEquals(rows.error, null);
  assertEquals(rows.data?.map((r) => r.message), ['Thinking of you']);
});

Deno.test('pings: per-circle rate limit', async () => {
  let last = 200;
  for (let i = 0; i < 6 && last === 200; i++) last = (await fn('ping', { ...creds, message: `spam ${i}` })).status;
  assertEquals(last, 429);
});

Deno.test('people: direct anon writes refused, edit contact through the function', async () => {
  const hijack = await anon.from('people').update({ phone: '+34999999999' }).eq('id', leadId).select();
  assertEquals(hijack.error?.code, '42501');
  const insert = await anon.from('people').insert({ circle_id: circle.id, name: 'Evil' });
  assertEquals(insert.error?.code, '42501');

  const edited = await fn<{ person: Person }>('people', {
    ...creds,
    action: 'update',
    person_id: leadId,
    person: { name: 'Lucia', relation: 'daughter', phone: '+34 600 000 001' },
  });
  assertEquals(edited.status, 200, JSON.stringify(edited.json));
  assertEquals(edited.json.person.phone, '+34 600 000 001');

  const visible = await anon.from('people').select('phone').eq('id', leadId).single();
  assertEquals(visible.data?.phone, '+34 600 000 001');

  // A stranger who knows the circle id but not the code, or claims a profile from another circle.
  const noCode = await fn('people', { circle_id: circle.id, code: other.json.circle.code, action: 'update', person_id: leadId, person: { name: 'X' } });
  assertEquals(noCode.status, 404);
  const foreign = await fn('people', { circle_id: circle.id, code: circle.code, member_id: other.json.lead_id, action: 'update', person_id: leadId, person: { name: 'X' } });
  assertEquals(foreign.status, 403);
});

Deno.test('people: join / create / roles follow permissions', async () => {
  const joined = await fn<{ person: Person }>('people', { circle_id: circle.id, code: circle.code, action: 'join', person: { name: 'Pablo', relation: 'son' } });
  assertEquals(joined.status, 200, JSON.stringify(joined.json));
  assertEquals([joined.json.person.role, joined.json.person.claimed], ['member', true]);
  const pablo = { circle_id: circle.id, code: circle.code, member_id: joined.json.person.id };

  const notStaff = await fn('people', { ...pablo, action: 'create', person: { name: 'Nurse' } });
  assertEquals(notStaff.status, 403);
  const notOwn = await fn('people', { ...pablo, action: 'update', person_id: leadId, person: { name: 'X' } });
  assertEquals(notOwn.status, 403);
  const staff = await fn<{ person: Person }>('people', { ...creds, action: 'create', person: { name: 'Nurse' } });
  assertEquals(staff.status, 200);
  assertEquals(staff.json.person.claimed, false);
  const promoted = await fn('people', { ...creds, action: 'set_role', person_id: pablo.member_id, role: 'admin' });
  assertEquals(promoted.status, 200);
  const deleteLead = await fn('people', { ...creds, action: 'delete', person_id: leadId });
  assertEquals(deleteLead.status, 403);
});

Deno.test('media: private bucket, upload + read only through signed URLs of the own circle', async () => {
  const ticket = await fn<{ path: string; token: string }>('media', { ...creds, action: 'upload', kind: 'photo', content_type: 'image/png' });
  assertEquals(ticket.status, 200, JSON.stringify(ticket.json));
  assertMatch(ticket.json.path, new RegExp(`^${circle.id}/photo/.+\\.png$`));

  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const up = await anon.storage.from('media').uploadToSignedUrl(ticket.json.path, ticket.json.token, png, { contentType: 'image/png' });
  assertEquals(up.error, null, up.error?.message);

  const directUp = await anon.storage.from('media').upload(`${circle.id}/photo/direct.png`, png, { contentType: 'image/png' });
  assert(directUp.error, 'anon must not upload without a ticket');
  const directDown = await anon.storage.from('media').download(ticket.json.path);
  assert(directDown.error, 'anon must not read the private bucket');
  const publicUrl = await fetch(`${URL}/storage/v1/object/public/media/${ticket.json.path}`);
  await publicUrl.body?.cancel();
  assert(publicUrl.status >= 400, 'public URL must not serve the object');

  const signed = await fn<{ urls: Record<string, string> }>('media', { ...creds, action: 'sign', paths: [ticket.json.path, 'nope/x.png'] });
  assertEquals(signed.status, 200);
  assertEquals(Object.keys(signed.json.urls), [ticket.json.path]);
  // Locally the functions see the stack as http://kong:8000; on the project SUPABASE_URL is public.
  const got = await fetch(signed.json.urls[ticket.json.path].replace(/^https?:\/\/[^/]+/, URL));
  assertEquals(got.status, 200);
  assertEquals(new Uint8Array(await got.arrayBuffer()), png);

  const stranger = await fn<{ urls: Record<string, string> }>('media', { circle_id: other.json.circle.id, code: other.json.circle.code, action: 'sign', paths: [ticket.json.path] });
  assertEquals(stranger.json.urls, {});

  // The path can be stored as a profile photo; a path of another circle cannot.
  const photo = await fn<{ person: Person }>('people', { ...creds, action: 'update', person_id: leadId, person: { name: 'Lucia', photo_url: ticket.json.path } });
  assertEquals(photo.status, 200, JSON.stringify(photo.json));
  const stolen = await fn('people', { circle_id: other.json.circle.id, code: other.json.circle.code, member_id: other.json.lead_id, action: 'update', person_id: other.json.lead_id, person: { name: 'S', photo_url: ticket.json.path } });
  assertEquals(stolen.status, 400);
});

Deno.test('devices: direct anon writes refused, register through the function', async () => {
  const direct = await anon.from('devices').insert({ circle_id: circle.id, role: 'patient', push_token: 'ExponentPushToken[evil]' });
  assertEquals(direct.error?.code, '42501');
  const reg = await fn('circle', { circle_id: circle.id, code: circle.code, action: 'register_device', role: 'patient', push_token: 'ExponentPushToken[test]', platform: 'ios' });
  assertEquals(reg.status, 200, JSON.stringify(reg.json));
});
