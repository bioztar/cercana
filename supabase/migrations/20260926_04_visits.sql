-- Doctor-visit capture (idempotent). One row per recorded visit: the long recording, its transcript,
-- the plain summary for the family, a gentle one for the patient, and the AI's proposed changes.
-- `proposals` = { med_changes: [{ action, name, dose, times, status }], follow_ups: [{ title, starts_at, status }] }
-- where status is 'pending' | 'approved' | 'skipped'. Rows are written by the `visit` edge function
-- (service role); the app only updates `proposals` when a lead/admin approves or skips one.
create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  recorded_by_person_id uuid references people on delete set null, -- null = recorded on the patient's phone
  audio_url text,
  transcript text not null default '',
  summary text not null default '',
  patient_summary text not null default '',
  proposals jsonb not null default '{"med_changes": [], "follow_ups": []}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists visits_circle_idx on visits (circle_id, created_at desc);

-- DEMO ONLY: permissive anon policies, like the rest of the schema.
alter table visits enable row level security;
drop policy if exists "demo_all" on visits;
create policy "demo_all" on visits for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on visits to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visits'
  ) then
    alter publication supabase_realtime add table visits;
  end if;
end $$;
