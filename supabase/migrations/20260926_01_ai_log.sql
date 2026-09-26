-- ai_log: one row per AI call (assistant chat, dictation, who-is-this, letters, visit notes, digest).
-- Written by edge functions with the service role; also the per-circle daily cap counter (300/day).
create table if not exists ai_log (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  kind text not null check (kind in ('assistant', 'dictation', 'who', 'letter', 'visit', 'digest')),
  speaker_person_id uuid null, -- null = the patient
  input text,
  output jsonb,
  distress boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ai_log_circle_idx on ai_log (circle_id, created_at desc);

-- DEMO ONLY: permissive anon policies, like the rest of the schema.
do $$
begin
  alter table ai_log enable row level security;
  drop policy if exists "demo_all" on ai_log;
  create policy "demo_all" on ai_log for all to anon, authenticated using (true) with check (true);
  grant select, insert, update, delete on ai_log to anon, authenticated;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ai_log'
  ) then
    alter publication supabase_realtime add table ai_log;
  end if;
end $$;
