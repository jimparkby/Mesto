-- Импорт событий из внешних источников: Edge Function `ingest` раз в 30 минут.
--
-- Функция развёрнута с verify_jwt = false, поэтому вызов защищён секретом: pg_cron передаёт его
-- в заголовке x-ingest-secret, а функция сверяет через ingest_secret_matches(). Секрет генерируется
-- здесь же и живёт только в Vault — ни в репозитории, ни в секретах Edge Functions его нет.
create extension if not exists pg_net;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'ingest_secret')
where not exists (select 1 from vault.secrets where name = 'ingest_secret');

create or replace function public.ingest_secret_matches(secret text)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    -- $1, а не secret: у vault.decrypted_secrets есть своя колонка secret (шифротекст), и она перекрыла бы параметр
    select 1 from vault.decrypted_secrets where name = 'ingest_secret' and decrypted_secret = $1
  );
$$;

revoke all on function public.ingest_secret_matches(text) from public, anon, authenticated;
grant execute on function public.ingest_secret_matches(text) to service_role;

select cron.unschedule('ingest-events') where exists (select 1 from cron.job where jobname = 'ingest-events');
select cron.schedule(
  'ingest-events',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://tztrfetnjlvjebdrrydd.supabase.co/functions/v1/ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ingest_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
