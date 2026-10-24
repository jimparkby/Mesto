-- Mesto: тип события — тренировка или игра
-- Существующие события по умолчанию считаем играми.

alter table public.events
  add column if not exists event_type text not null default 'game'
    check (event_type in ('training', 'game'));

-- Явно расширяем список обновляемых колонок (RLS-грант со списком колонок).
grant update (title, sport, event_type, description, starts_at, duration_min, venue_name, address,
              lat, lng, level, price, capacity, status)
  on public.events to authenticated;
