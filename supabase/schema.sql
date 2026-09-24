-- Cercana schema. Apply with the Supabase SQL editor or `supabase db push`.
--
-- DEMO ONLY: anyone with the anon key can read everything.
-- There is no auth; the 6-character circle code is the only "secret" and it is not enforced by RLS.
-- Do not put real personal data here until per-circle access control is added.

create extension if not exists pgcrypto;

create table if not exists circles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  patient_name text not null,
  created_at timestamptz default now()
);

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  name text not null,
  relation text,
  phone text,
  photo_url text,
  birthday date, -- year < 1000 (e.g. 0004-03-05) means "year unknown"
  created_at timestamptz default now()
);

create table if not exists moments (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  person_id uuid references people on delete set null,
  author text,
  body text,
  photo_url text,
  audio_url text,
  created_at timestamptz default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  role text check (role in ('patient', 'family')),
  push_token text unique,
  platform text,
  created_at timestamptz default now()
);

create table if not exists pings (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  from_name text,
  person_id uuid references people on delete set null,
  message text not null,
  created_at timestamptz default now()
);

create index if not exists people_circle_idx on people (circle_id);
create index if not exists moments_circle_idx on moments (circle_id, created_at desc);
create index if not exists devices_circle_idx on devices (circle_id);
create index if not exists pings_circle_idx on pings (circle_id, created_at desc);

-- Calendar subscriptions (ICS feeds). Synced by the `sync-calendars` edge function.
create table if not exists calendars (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  label text not null,
  ics_url text not null, -- SECRET: read access to someone's whole calendar. Never selectable by anon (see below).
  url_hint text,         -- non-secret display hint, e.g. "basic.ics" or the host name
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz default now()
);

create table if not exists calendar_people (
  calendar_id uuid not null references calendars on delete cascade,
  person_id uuid not null references people on delete cascade,
  primary key (calendar_id, person_id)
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references calendars on delete cascade,
  circle_id uuid not null references circles on delete cascade,
  uid text not null,
  title text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false, -- all-day: starts_at = UTC midnight of the date, ends_at exclusive
  unique (calendar_id, uid, starts_at)
);

create index if not exists calendars_circle_idx on calendars (circle_id);
create index if not exists calendar_people_person_idx on calendar_people (person_id);
create index if not exists events_circle_idx on events (circle_id, starts_at);

-- DEMO ONLY: permissive anon policies.
do $$
declare t text;
begin
  foreach t in array array['circles', 'people', 'moments', 'devices', 'pings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "demo_all" on %I', t);
    execute format(
      'create policy "demo_all" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Realtime: patient app listens to pings; both apps refresh on people/moments changes.
do $$
declare t text;
begin
  foreach t in array array['pings', 'moments', 'people'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- Public storage bucket for photos and voice notes.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "demo_media_read" on storage.objects;
drop policy if exists "demo_media_insert" on storage.objects;
create policy "demo_media_read" on storage.objects for select to anon, authenticated using (bucket_id = 'media');
create policy "demo_media_insert" on storage.objects for insert to anon, authenticated with check (bucket_id = 'media');

-- ---------------------------------------------------------------------------------------------
-- Calendar access. The one privacy rule kept despite "demo, no privacy": the secret ICS URL is
-- insertable by anon but NEVER selectable. Clients list calendars through `calendars_public`;
-- only the edge function (service role) reads calendars.ics_url.
-- ---------------------------------------------------------------------------------------------
alter table calendars enable row level security;
alter table calendar_people enable row level security;
alter table events enable row level security;

revoke all on calendars from anon, authenticated;
grant insert on calendars to anon, authenticated;
grant delete on calendars to anon, authenticated;
grant select (id) on calendars to anon, authenticated; -- lets `delete ... where id = ...` work; ics_url stays unreadable

drop policy if exists "demo_calendars_insert" on calendars;
drop policy if exists "demo_calendars_delete" on calendars;
drop policy if exists "demo_calendars_select" on calendars;
create policy "demo_calendars_insert" on calendars for insert to anon, authenticated with check (true);
create policy "demo_calendars_delete" on calendars for delete to anon, authenticated using (true);
create policy "demo_calendars_select" on calendars for select to anon, authenticated using (true);

-- Owner-run view (security_invoker off) so it can read the base table on the client's behalf.
create or replace view calendars_public with (security_invoker = false) as
  select id, circle_id, label, url_hint, last_synced_at, last_error, created_at from calendars;
revoke all on calendars_public from anon, authenticated;
grant select on calendars_public to anon, authenticated;

drop policy if exists "demo_all" on calendar_people;
create policy "demo_all" on calendar_people for all to anon, authenticated using (true) with check (true);

-- Events are written only by the edge function (service role bypasses RLS); clients only read.
revoke all on events from anon, authenticated;
grant select on events to anon, authenticated;
drop policy if exists "demo_events_select" on events;
create policy "demo_events_select" on events for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------------------------
-- Schedule (helm enables this): sync every calendar every 30 minutes. Needs pg_cron + pg_net.
-- Replace <project-ref> and <key> (anon or service-role JWT) when running; never commit real values.
-- ---------------------------------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule(
--   'sync-calendars-30min',
--   '*/30 * * * *',
--   $$ select net.http_post(
--        url := 'https://<project-ref>.supabase.co/functions/v1/sync-calendars',
--        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <key>'),
--        body := '{}'::jsonb
--      ) $$
-- );
