-- pgTAP: what the anon key can and cannot do after 20260928_02_rls_lockdown.sql.
-- Run by supabase/tests/run.sh (`supabase test db`) against the local stack, never the project.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- The seed (seed_legacy.sql) was converted: URLs became paths, legacy paths are remembered per circle.
select is(
  (select photo_url from people where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'photo/legacy-lucia.jpg', 'legacy people.photo_url is now a storage path');
select is(
  (select audio_url from moments where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  'audio/legacy-lunch.m4a', 'legacy moments.audio_url is now a storage path');
select is(
  (select circle_id from legacy_media where path = 'photo/legacy-lunch.jpg'),
  '11111111-1111-4111-8111-111111111111'::uuid, 'legacy object remembered with its circle');
select is((select public from storage.buckets where id = 'media'), false, 'media bucket is private');
select is(
  (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'demo_media%'),
  0, 'no anon storage policies left');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and policyname = 'demo_all' and tablename in ('pings', 'people', 'circles', 'devices')),
  0, 'demo_all is gone from pings / people / circles / devices');

-- Ownership helper (service role only): own prefix, own legacy object, nothing else.
select ok(media_path_in_circle('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111/photo/x.jpg'), 'own prefix allowed');
select ok(media_path_in_circle('11111111-1111-4111-8111-111111111111', 'photo/legacy-lunch.jpg'), 'own legacy object allowed');
select ok(not media_path_in_circle('22222222-2222-4222-8222-222222222222', 'photo/legacy-lunch.jpg'), 'another circle''s legacy object refused');
select ok(not media_path_in_circle('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111/photo/x.jpg'), 'another circle''s prefix refused');
select ok(not media_path_in_circle('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111/../photo/x.jpg'), 'path traversal refused');

-- Rate limiter: counts within the window, third hit over a limit of 2 is refused.
select ok(rate_limit_hit('t:1', 2, '1 minute'), 'hit 1 allowed');
select ok(rate_limit_hit('t:1', 2, '1 minute'), 'hit 2 allowed');
select ok(not rate_limit_hit('t:1', 2, '1 minute'), 'hit 3 refused');

-- ------------------------------------------------------------------------------------------
-- Now as the anon key (PostgREST sets this role for unauthenticated requests).
-- ------------------------------------------------------------------------------------------
set local role anon;

select throws_like(
  $$insert into pings (circle_id, from_name, message) values ('11111111-1111-4111-8111-111111111111', 'Evil', 'boo')$$,
  '%permission denied%', 'anon cannot INSERT pings');
select throws_like(
  $$update people set phone = '+34999999999' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '%permission denied%', 'anon cannot UPDATE people (phone hijack)');
select throws_like(
  $$insert into people (circle_id, name) values ('11111111-1111-4111-8111-111111111111', 'Evil')$$,
  '%permission denied%', 'anon cannot INSERT people');
select throws_like(
  $$delete from people where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '%permission denied%', 'anon cannot DELETE people');
select throws_like(
  $$insert into circles (code, patient_name) values ('ZZZZZZ', 'Minted')$$,
  '%permission denied%', 'anon cannot INSERT circles');
select throws_like($$select code from circles$$, '%permission denied%', 'anon cannot read circle codes');
select throws_like($$select * from devices$$, '%permission denied%', 'anon cannot read push tokens');
select throws_like($$select rate_limit_hit('t:2', 1, '1 minute')$$, '%permission denied%', 'anon cannot call rate_limit_hit');

-- Reads the app still needs.
select is((select count(*)::int from people where circle_id = '11111111-1111-4111-8111-111111111111'), 2, 'anon can still read people');
select lives_ok($$select id, circle_id, from_name, message, created_at from pings$$, 'anon can still read pings (realtime)');

select * from finish();
rollback;
