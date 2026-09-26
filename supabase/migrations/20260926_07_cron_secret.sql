-- digest / distress-alert authenticate the database by a shared CRON_SECRET (function secret +
-- Vault secret `cercana_cron_secret`), not by comparing the service key: on this project the key
-- functions see is a new-format secret key, not the legacy JWT the DB can hold.
-- helm, once per project (never commit the value): same random value in both places —
--   supabase secrets set CRON_SECRET=<value>
--   select vault.create_secret('<value>', 'cercana_cron_secret');
create or replace function cercana_call_fn(fn text, body jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare base text; key text; secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'cercana_functions_url';
  select decrypted_secret into key from vault.decrypted_secrets where name = 'cercana_service_key';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cercana_cron_secret';
  if base is null or key is null or secret is null then
    raise notice 'cercana_call_fn(%): vault secrets cercana_functions_url / cercana_service_key / cercana_cron_secret not set', fn;
    return;
  end if;
  perform net.http_post(
    url := base || '/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key,
                                  'x-cron-secret', secret),
    body := body
  );
end $$;
revoke all on function cercana_call_fn(text, jsonb) from public, anon, authenticated;
