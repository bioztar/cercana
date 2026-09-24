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
