-- Evening digest + distress alerts (idempotent). Needs 20260926_01_ai_log.sql applied first.
--
-- helm, once per project (never commit the values): create two Vault secrets the DB uses to call
-- the edge functions:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'cercana_functions_url');
--   select vault.create_secret('<service-role key>', 'cercana_service_key');
-- Without them the cron tick and the distress trigger do nothing but raise a notice.

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table circles add column if not exists tz text not null default 'Europe/Madrid';

-- One digest per circle per local day: the family feed card + the trend bars read this table.
-- Written only by the `digest` edge function (service role).
create table if not exists digests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  day date not null,
  note text not null,
  watch text,
  metrics jsonb not null,
  created_at timestamptz not null default now(),
  unique (circle_id, day)
);
create index if not exists digests_circle_idx on digests (circle_id, day desc);

alter table digests enable row level security;
revoke all on digests from anon, authenticated;
grant select on digests to anon, authenticated;
drop policy if exists "demo_digests_select" on digests;
create policy "demo_digests_select" on digests for select to anon, authenticated using (true);

-- One row per alert sent: the 30-minute rate limit reads it. Service/trigger only.
create table if not exists distress_alerts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles on delete cascade,
  ai_log_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists distress_alerts_circle_idx on distress_alerts (circle_id, created_at desc);
alter table distress_alerts enable row level security;
revoke all on distress_alerts from anon, authenticated;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'digests'
  ) then
    alter publication supabase_realtime add table digests;
  end if;
end $$;

-- POST to an edge function with the service key from Vault. Quiet no-op when Vault is not set up.
create or replace function cercana_call_fn(fn text, body jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare base text; key text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'cercana_functions_url';
  select decrypted_secret into key from vault.decrypted_secrets where name = 'cercana_service_key';
  if base is null or key is null then
    raise notice 'cercana_call_fn(%): vault secrets cercana_functions_url / cercana_service_key not set', fn;
    return;
  end if;
  perform net.http_post(
    url := base || '/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key),
    body := body
  );
end $$;
revoke all on function cercana_call_fn(text, jsonb) from public, anon, authenticated;

-- Hourly tick: a circle's digest runs when its own clock says 20:xx (per-circle tz, DST-safe).
-- The function is idempotent per circle/day, so a repeat call is harmless.
create or replace function cercana_digest_tick() returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  for c in select id from circles where extract(hour from now() at time zone tz) = 20 loop
    perform cercana_call_fn('digest', jsonb_build_object('circle_id', c.id));
  end loop;
end $$;
revoke all on function cercana_digest_tick() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('cercana-digest-hourly') where exists (select 1 from cron.job where jobname = 'cercana-digest-hourly');
  perform cron.schedule('cercana-digest-hourly', '0 * * * *', 'select cercana_digest_tick()');
end $$;

-- Distress: an ai_log row with distress = true alerts the family at once, at most once per 30 min per circle.
create or replace function cercana_distress_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare fresh uuid;
begin
  perform pg_advisory_xact_lock(hashtext(new.circle_id::text)); -- two flags at once still send one alert
  insert into distress_alerts (circle_id, ai_log_id)
    select new.circle_id, new.id
    where not exists (
      select 1 from distress_alerts where circle_id = new.circle_id and created_at > now() - interval '30 minutes')
    returning id into fresh;
  if fresh is not null then
    perform cercana_call_fn('distress-alert', jsonb_build_object('circle_id', new.circle_id, 'ai_log_id', new.id));
  end if;
  return new;
end $$;
revoke all on function cercana_distress_notify() from public, anon, authenticated;

do $$ begin
  if to_regclass('public.ai_log') is null then
    raise exception 'ai_log missing: apply 20260926_01_ai_log.sql before this migration';
  end if;
  drop trigger if exists ai_log_distress on ai_log;
  create trigger ai_log_distress after insert on ai_log
    for each row when (new.distress) execute function cercana_distress_notify();
end $$;
