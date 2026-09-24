-- Comments (Thread) and Mom's own posts (idempotent).
--   comments.author_person_id null = Mom (the patient has no people row).
--   moments.by_patient marks moments Mom posted herself ("Tell the family").
--   moments.event_id links a photo moment to the calendar event it belongs to.
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references moments on delete cascade,
  circle_id uuid not null references circles on delete cascade,
  author_person_id uuid references people on delete set null,
  author_name text,
  body text,
  audio_url text,
  created_at timestamptz default now()
);
create index if not exists comments_moment_idx on comments (moment_id, created_at);
create index if not exists comments_circle_idx on comments (circle_id, created_at desc);

alter table moments add column if not exists by_patient boolean not null default false;
alter table moments add column if not exists event_id uuid references events on delete set null;

-- DEMO ONLY: permissive anon policy, same as the other tables.
alter table comments enable row level security;
drop policy if exists "demo_all" on comments;
create policy "demo_all" on comments for all to anon, authenticated using (true) with check (true);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table comments;
  end if;
end $$;
