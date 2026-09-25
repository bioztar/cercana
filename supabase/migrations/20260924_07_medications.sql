-- Daily medicines for Mom + a "Did you take it?" log per scheduled dose (idempotent).
-- `times` is 'HH:MM' local Europe/Madrid; src/lib/meds.ts expands today's doses from it.
-- `medication_logs` holds one row per (medicine, scheduled dose) she has answered.
create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  name text not null,
  dose text not null,
  times text[] not null default '{}',
  active boolean not null default true,
  created_by_person_id uuid references people on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists medication_logs (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  medication_id uuid not null references medications on delete cascade,
  scheduled_for timestamptz not null,
  status text not null check (status in ('taken', 'skipped')),
  answered_at timestamptz not null default now(),
  unique (medication_id, scheduled_for)
);

create index if not exists medications_circle_idx on medications (circle_id);
create index if not exists medication_logs_circle_idx on medication_logs (circle_id);

-- DEMO ONLY: permissive anon policies, like the rest of the schema.
do $$
declare t text;
begin
  foreach t in array array['medications', 'medication_logs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "demo_all" on %I', t);
    execute format(
      'create policy "demo_all" on %I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on %I to anon, authenticated', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
