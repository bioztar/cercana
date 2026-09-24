-- Important events with reminders and a "Did you go?" check-in (idempotent).
-- Reminders are stored on the event as jsonb [{kind: 'evening_before'|'on_day'|'check', at: <iso>}];
-- Mom's phone schedules local notifications from them. `checkins` holds her answer, one per event.
create table if not exists important_events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  for_person text not null default 'mom' check (for_person in ('mom')), -- Mom only for now
  created_by_person_id uuid references people on delete set null,
  reminders jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  important_event_id uuid not null references important_events on delete cascade unique,
  answer text not null check (answer in ('went', 'missed', 'rescheduled')),
  note_audio_url text,
  answered_at timestamptz not null default now()
);

create index if not exists important_events_circle_idx on important_events (circle_id, starts_at);
create index if not exists checkins_circle_idx on checkins (circle_id);

-- DEMO ONLY: permissive anon policies, like the rest of the schema.
do $$
declare t text;
begin
  foreach t in array array['important_events', 'checkins'] loop
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
