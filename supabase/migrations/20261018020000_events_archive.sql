-- Архив снятых с ленты событий и записей на них (так 18.10.2026 убрали демо-события из seed
-- и прошедшие тестовые — в ленте остались только настоящие). Вернуть событие (счётчик участников
-- обнулить: триггер снова увеличит его при возврате записей):
--   insert into public.events
--   select (jsonb_populate_record(null::public.events, to_jsonb(a) || '{"registered_count": 0}')).*
--   from public.events_archive a where a.id = '<id>';
--   insert into public.registrations select * from public.registrations_archive where event_id = '<id>';
-- Таблицы служебные: доступа у клиентов нет, политик RLS нет.
create table if not exists public.events_archive (like public.events including defaults);
alter table public.events_archive add column if not exists archived_at timestamptz not null default now();
create table if not exists public.registrations_archive (like public.registrations including defaults);

alter table public.events_archive enable row level security;
alter table public.registrations_archive enable row level security;
