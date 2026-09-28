-- Groundwork for the RLS lockdown (idempotent, additive: nothing old clients do stops working).
-- Apply this, then deploy the edge functions (circle, people, ping, media, assistant, see,
-- transcribe, visit) and the web app, then 20260928_02_rls_lockdown.sql. See docs/security.md.

-- ---------------------------------------------------------------------------------------------
-- Rate limits (fixed windows), consumed by the edge functions through the service role.
-- ---------------------------------------------------------------------------------------------
create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table rate_limits enable row level security;
revoke all on rate_limits from public, anon, authenticated;

-- True = allowed (and counted); false = over `p_limit` hits in the current `p_window`.
create or replace function rate_limit_hit(p_key text, p_limit integer, p_window interval) returns boolean
language plpgsql security definer set search_path = public as $$
declare r rate_limits;
begin
  insert into rate_limits (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when rate_limits.window_start + p_window <= now() then 1 else rate_limits.hits + 1 end,
    window_start = case when rate_limits.window_start + p_window <= now() then now() else rate_limits.window_start end
  returning * into r;
  return r.hits <= p_limit;
end $$;
revoke all on function rate_limit_hit(text, integer, interval) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, integer, interval) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Media ownership. New objects live under `<circle_id>/<photo|audio>/<file>`; objects uploaded
-- before the lockdown (`photo/...`, `audio/...`) are recorded here with their circle by _02.
-- ---------------------------------------------------------------------------------------------
create table if not exists legacy_media (
  path text primary key,
  circle_id uuid not null references circles on delete cascade
);
alter table legacy_media enable row level security;
revoke all on legacy_media from public, anon, authenticated;

-- May the `media` function sign `p_path` for `p_circle`? Own prefix, or a legacy object of that circle.
create or replace function media_path_in_circle(p_circle uuid, p_path text) returns boolean
language sql security definer stable set search_path = public as $$
  select p_path is not null and p_path <> '' and p_path not like '%..%'
     and (p_path like p_circle::text || '/%'
          or exists (select 1 from legacy_media where path = p_path and circle_id = p_circle));
$$;
revoke all on function media_path_in_circle(uuid, text) from public, anon, authenticated;
grant execute on function media_path_in_circle(uuid, text) to service_role;
