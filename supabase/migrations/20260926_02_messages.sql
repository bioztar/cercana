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

-- DEMO ONLY: permissive anon policy, same as the other tables.
alter table messages enable row level security;
drop policy if exists "demo_all" on messages;
create policy "demo_all" on messages for all to anon, authenticated using (true) with check (true);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;
