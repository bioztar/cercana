-- Scheduled morning brief settings, per circle (idempotent).
alter table circles add column if not exists brief_time time not null default '09:00';
alter table circles add column if not exists brief_enabled boolean not null default true;

-- Clients may update only these two columns (see permissions.ts 'editBrief': Mom, or lead/admin).
grant update (brief_time, brief_enabled) on circles to anon, authenticated;

-- Realtime, so a brief_time/brief_enabled change made on one device is picked up on the other.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'circles'
  ) then
    alter publication supabase_realtime add table circles;
  end if;
end $$;
