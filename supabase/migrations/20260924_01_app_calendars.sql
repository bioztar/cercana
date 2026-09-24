-- In-app and device calendars (idempotent).
--   source 'ics'    — published feed, synced server-side by `sync-calendars` (unchanged)
--   source 'app'    — events created inside Cercana (Mom's "Tell the family", family screens)
--   source 'device' — events pushed from a family member's iPhone calendar (expo-calendar)
-- Clients may write events only on 'app'/'device' calendars; ICS events stay function-managed.
-- App events need their own `uid` (e.g. a random UUID) because of unique (calendar_id, uid, starts_at).
alter table calendars add column if not exists source text not null default 'ics';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'calendars_source_check') then
    alter table calendars add constraint calendars_source_check check (source in ('ics', 'device', 'app'));
  end if;
end $$;
alter table calendars alter column ics_url drop not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'calendars_ics_url_required') then
    alter table calendars add constraint calendars_ics_url_required check (source <> 'ics' or ics_url is not null);
  end if;
end $$;

alter table events add column if not exists created_by_person_id uuid references people on delete set null;
alter table events add column if not exists notes text;

grant insert, update, delete on events to anon, authenticated;
drop policy if exists "demo_events_insert" on events;
drop policy if exists "demo_events_update" on events;
drop policy if exists "demo_events_delete" on events;
create policy "demo_events_insert" on events for insert to anon, authenticated
  with check (exists (select 1 from calendars c where c.id = calendar_id and c.source in ('app', 'device')));
create policy "demo_events_update" on events for update to anon, authenticated
  using (exists (select 1 from calendars c where c.id = calendar_id and c.source in ('app', 'device')))
  with check (exists (select 1 from calendars c where c.id = calendar_id and c.source in ('app', 'device')));
create policy "demo_events_delete" on events for delete to anon, authenticated
  using (exists (select 1 from calendars c where c.id = calendar_id and c.source in ('app', 'device')));

-- Expose `source` to clients (appended column — `create or replace view` only allows adding at the end).
create or replace view calendars_public with (security_invoker = false) as
  select id, circle_id, label, url_hint, last_synced_at, last_error, created_at, source from calendars;
revoke all on calendars_public from anon, authenticated;
grant select on calendars_public to anon, authenticated;
