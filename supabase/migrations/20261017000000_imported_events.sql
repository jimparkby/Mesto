-- События, импортированные из внешних источников (Telegram-каналы, календарь ПроБЕГ, позже Instagram).
-- Пишет их только воркер ingest/ через service role: organizer_id = null, organizer_name = название источника.

alter table public.events
  add column if not exists source       text,
  add column if not exists source_url   text,
  add column if not exists external_key text unique;

-- Демо-события тоже без организатора — переносим только их, импортированные пусть честно проходят.
create or replace function public.roll_demo_events()
returns void
language sql
security definer set search_path = public
as $$
  update public.events
     set starts_at = starts_at + interval '7 days' * ceil(
           extract(epoch from (now() - starts_at)) / extract(epoch from interval '7 days'))
   where organizer_id is null
     and source is null
     and starts_at + make_interval(mins => duration_min) < now();
$$;

-- Какие посты воркер уже разобрал — чтобы не разбирать их повторно.
-- Читает и пишет только воркер (service role), поэтому политик RLS нет.
create table if not exists public.ingest_posts (
  source       text not null,               -- 'telegram', 'probeg'
  post_id      text not null,               -- 'minskafisha/1234'
  url          text not null,
  posted_at    timestamptz,
  text         text not null default '',
  events_found int not null default 0,
  note         text,                        -- почему событие не добавлено (не спорт, не найден адрес…)
  processed_at timestamptz not null default now(),
  primary key (source, post_id)
);

alter table public.ingest_posts enable row level security;
