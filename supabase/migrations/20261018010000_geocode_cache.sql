-- Геокодирование для Edge Function `ingest` через базу: IP Edge Functions Nominatim отвечает 403,
-- а запросы из Postgres через pg_net проходят. pg_net асинхронный, поэтому:
--   1-й вызов geocode_lookup — отправляет запрос, возвращает {"status": "pending"};
--   следующий (через проход, ~30 мин) — забирает ответ из net._http_response и кэширует навсегда.
-- Таблицу читает и пишет только geocode_lookup (security definer), политик RLS нет.

create table if not exists public.geocode_cache (
  key        text primary key,          -- нормализованные параметры запроса
  params     jsonb not null,            -- параметры Nominatim /search
  request_id bigint,                    -- id запроса pg_net, пока ждём ответ
  status     text not null default 'pending' check (status in ('pending', 'found', 'not_found', 'error')),
  lat        double precision,
  lng        double precision,
  updated_at timestamptz not null default now()
);

alter table public.geocode_cache enable row level security;

create or replace function public.geocode_lookup(p_key text, p_params jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  c public.geocode_cache;
  cached boolean;
  resp record;
  hits jsonb;
begin
  select * into c from public.geocode_cache where key = p_key;
  cached := found; -- found перезапишется следующими запросами, запоминаем

  -- Ждём ответ — может, он уже пришёл.
  if cached and c.status = 'pending' and c.request_id is not null then
    select status_code, content into resp from net._http_response where id = c.request_id;
    if found then
      hits := case when resp.status_code = 200 then resp.content::jsonb end;
      update public.geocode_cache set
        status = case
          when hits is null then 'error'
          when jsonb_array_length(hits) = 0 then 'not_found'
          else 'found' end,
        lat = (hits -> 0 ->> 'lat')::double precision,
        lng = (hits -> 0 ->> 'lon')::double precision,
        request_id = null,
        updated_at = now()
      where key = p_key
      returning * into c;
    end if;
  end if;

  if cached and c.status in ('found', 'not_found') then
    return jsonb_build_object('status', c.status, 'lat', c.lat, 'lng', c.lng);
  end if;
  -- Запрос ещё в пути (pg_net хранит ответы 6 часов — если ответа так и нет, спросим заново).
  if cached and c.status = 'pending' and c.updated_at > now() - interval '1 hour' then
    return jsonb_build_object('status', 'pending');
  end if;

  -- Нет в кэше, ошибка или ответ потерялся — отправляем запрос.
  insert into public.geocode_cache (key, params, request_id, status, updated_at)
  values (
    p_key,
    p_params,
    net.http_get(
      url := 'https://nominatim.openstreetmap.org/search',
      params := p_params,
      headers := jsonb_build_object('User-Agent', 'MestoIngest/0.1 (+https://github.com/jimparkby/Mesto)'),
      timeout_milliseconds := 10000
    ),
    'pending',
    now()
  )
  on conflict (key) do update set
    params = excluded.params, request_id = excluded.request_id, status = 'pending',
    lat = null, lng = null, updated_at = now();
  return jsonb_build_object('status', 'pending');
end;
$$;

revoke all on function public.geocode_lookup(text, jsonb) from public, anon, authenticated;
grant execute on function public.geocode_lookup(text, jsonb) to service_role;
