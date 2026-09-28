-- Lockdown of the demo "demo_all" policies (idempotent). See docs/security.md for the identity model.
--
-- The anon key is public and there is no login, so the database can only tell "someone with the
-- anon key" from "an edge function (service role)". After this migration:
--   pings     anon: SELECT only (realtime for the patient's phone). Writes: `ping` function.
--   people    anon: SELECT only. Writes: `people` function (checks the circle code + roles).
--   circles   anon: SELECT of non-secret columns (never `code`), UPDATE of the brief settings.
--             INSERT / lookup by code: `circle` function (throttled).
--   devices   anon: nothing. Push tokens are registered by the `circle` function.
--   media     bucket private, no anon storage policies. Uploads and reads use signed URLs
--             minted by the `media` function under per-circle paths `<circle_id>/<kind>/<file>`.
-- Needs 20260928_01_lockdown_groundwork.sql, the functions (circle, people, ping, media, AI) and the
-- web app deployed first: old clients' direct writes stop working the moment this is applied.

-- ---------------------------------------------------------------------------------------------
-- pings: anon may only read (realtime). Inserts come from the `ping` function.
-- ---------------------------------------------------------------------------------------------
drop policy if exists "demo_all" on pings;
drop policy if exists "pings_select" on pings;
revoke all on pings from anon, authenticated;
grant select on pings to anon, authenticated;
create policy "pings_select" on pings for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------------------------
-- people: anon may only read. All writes go through the `people` function.
-- ---------------------------------------------------------------------------------------------
drop policy if exists "demo_all" on people;
drop policy if exists "people_select" on people;
revoke all on people from anon, authenticated;
grant select on people to anon, authenticated;
create policy "people_select" on people for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------------------------
-- circles: the code is the circle's credential from now on, so anon can never read it.
-- Creation and lookup-by-code happen in the `circle` function.
-- ---------------------------------------------------------------------------------------------
drop policy if exists "demo_all" on circles;
drop policy if exists "circles_select" on circles;
drop policy if exists "circles_update_brief" on circles;
revoke all on circles from anon, authenticated;
grant select (id, patient_name, created_at) on circles to anon, authenticated;
do $$
declare c text;
begin
  foreach c in array array['brief_time', 'brief_enabled', 'tz'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'circles' and column_name = c) then
      execute format('grant select (%I) on circles to anon, authenticated', c);
    end if;
  end loop;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'circles' and column_name = 'brief_time') then
    grant update (brief_time, brief_enabled) on circles to anon, authenticated; -- see 20260924_04_brief.sql
  end if;
end $$;
create policy "circles_select" on circles for select to anon, authenticated using (true);
create policy "circles_update_brief" on circles for update to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------------------------
-- devices: push tokens are not readable or writable by anon (a token lets anyone push to that phone).
-- ---------------------------------------------------------------------------------------------
drop policy if exists "demo_all" on devices;
revoke all on devices from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- media bucket: private. Objects live under `<circle_id>/<photo|audio>/<file>`; the `media`
-- function signs uploads and reads. Rows keep the storage path (not a URL) from now on.
-- ---------------------------------------------------------------------------------------------
drop policy if exists "demo_media_read" on storage.objects;
drop policy if exists "demo_media_insert" on storage.objects;

-- Existing rows hold public URLs of objects uploaded at the bucket root (`photo/...`, `audio/...`).
-- Keep only the path, and remember once which circle each legacy object belonged to at this moment
-- (rows in anon-writable tables could later claim any path, so the snapshot is the source of truth).
do $$
declare
  t text; c text;
  cols text[][] := array[
    ['people', 'photo_url'], ['moments', 'photo_url'], ['moments', 'audio_url'], ['comments', 'audio_url'],
    ['messages', 'audio_url'], ['checkins', 'note_audio_url'], ['visits', 'audio_url']
  ];
  i integer;
begin
  -- Runs once: only while the bucket is still public (i.e. before this migration ever completed).
  if not exists (select 1 from storage.buckets where id = 'media' and public) then return; end if;
  for i in 1 .. array_length(cols, 1) loop
    t := cols[i][1]; c := cols[i][2];
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = c) then
      execute format(
        $q$update %I set %I = regexp_replace(%I, '^https?://[^/]+/storage/v1/object/public/media/', '')
           where %I like '%%/storage/v1/object/public/media/%%'$q$, t, c, c, c);
      execute format(
        $q$insert into legacy_media (path, circle_id)
           select %I, circle_id from %I where %I is not null and %I !~ '^[0-9a-f-]{36}/' and %I !~ '^[a-z]+:'
           on conflict (path) do nothing$q$, c, t, c, c, c);
    end if;
  end loop;
  update storage.buckets set public = false where id = 'media';
end $$;
