-- 1:1 chats between Mom and each family member (idempotent).
--   person_id = the family side of the pair; from_patient says who wrote it.
--   transcript is filled by the `transcribe` edge function for voice notes; null = none (yet).
--   read_at = when the receiving side opened the thread.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  person_id uuid not null references people on delete cascade,
  from_patient boolean not null,
  body text,
  audio_url text,
  transcript text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_thread_idx on messages (circle_id, person_id, created_at);

-- DEMO ONLY: no login yet, so anon may read and write — but messages are never deletable, and the
-- only column an update may touch is read_at (the transcript is written with the insert, client side).
alter table messages enable row level security;
drop policy if exists "demo_all" on messages;
drop policy if exists "demo_select" on messages;
drop policy if exists "demo_insert" on messages;
drop policy if exists "demo_update" on messages;
create policy "demo_select" on messages for select to anon, authenticated using (true);
create policy "demo_insert" on messages for insert to anon, authenticated with check (true);
create policy "demo_update" on messages for update to anon, authenticated using (true) with check (true);

revoke all on messages from anon, authenticated;
grant select, insert on messages to anon, authenticated;
grant update (read_at) on messages to anon, authenticated;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;
