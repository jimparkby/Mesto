-- Расписание тренера (как в YClients): тренер задаёт недельный шаблон занятий — дни недели, время,
-- длительность, место, цену и число мест. Сервер сам выставляет занятия на 4 недели вперёд
-- и каждую ночь добавляет следующие дни. Клиенты записываются в один тап: если у слота
-- включена «моментальная запись», заявка сразу принята, иначе ждёт подтверждения тренера.
--
-- Правила синхронизации шаблона и занятий:
--  - изменили слот → будущие занятия без записей обновляются (или удаляются, если день/время
--    больше не подходят), занятия с записями не трогаем — у клиентов остаётся то, на что записались;
--  - тренер отменил одно занятие (status = cancelled) — это исключение, заново на эту дату оно не создаётся;
--  - удалили слот → будущие занятия без записей удаляются, с записями остаются.

-- ============================================================
-- 1. Шаблон: еженедельные слоты
-- ============================================================
create table if not exists public.coach_slots (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Дни недели ISO: 1 — понедельник … 7 — воскресенье.
  weekdays      smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  start_time    time not null,
  duration_min  int not null default 60 check (duration_min between 15 and 720),
  sport         text not null check (sport ~ '^[a-z_]{2,32}$'),
  title         text not null check (char_length(title) between 3 and 120),
  description   text not null default '' check (char_length(description) <= 2000),
  venue_name    text not null default '',
  address       text not null default '',
  city          text not null default 'Минск',
  lat           double precision not null,
  lng           double precision not null,
  levels        text[] not null default '{}',
  price         numeric(8, 2) not null default 0 check (price >= 0),
  -- Мест для клиентов (тренер не считается).
  spots         int not null check (spots between 1 and 200),
  -- Моментальная запись без подтверждения тренера.
  auto_approve  boolean not null default true,
  active        boolean not null default true,
  valid_from    date not null default (now() at time zone 'Europe/Minsk')::date,
  valid_until   date check (valid_until is null or valid_until >= valid_from),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists coach_slots_coach_idx on public.coach_slots (coach_id);

alter table public.coach_slots enable row level security;
drop policy if exists "slots are readable" on public.coach_slots;
create policy "slots are readable" on public.coach_slots for select using (true);
drop policy if exists "coach manages own slots" on public.coach_slots;
create policy "coach manages own slots" on public.coach_slots
  for all to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- ============================================================
-- 2. Занятия из шаблона — обычные события с привязкой к слоту
-- ============================================================
alter table public.events
  add column if not exists slot_id      uuid references public.coach_slots (id) on delete set null,
  add column if not exists auto_approve boolean not null default false;
create unique index if not exists events_slot_start_key on public.events (slot_id, starts_at);
create index if not exists events_organizer_start_idx on public.events (organizer_id, starts_at);

-- На занятия с моментальной записью заявка принимается сразу.
create or replace function public.registrations_before_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ev public.events;
begin
  select * into ev from public.events where id = new.event_id for update;
  if not found then
    raise exception 'Событие не найдено';
  end if;
  if ev.status <> 'published' then
    raise exception 'Запись на событие закрыта';
  end if;
  if ev.starts_at + make_interval(mins => ev.duration_min) < now() then
    raise exception 'Событие уже прошло';
  end if;
  if ev.registered_count + ev.reserved >= ev.capacity then
    raise exception 'Мест больше нет';
  end if;
  if ev.organizer_id is null or ev.organizer_id = new.user_id or ev.auto_approve then
    new.status := 'approved';
    new.decided_at := now();
    update public.events set registered_count = registered_count + 1 where id = new.event_id;
  else
    new.status := 'pending';
    new.decided_at := null;
  end if;
  return new;
end;
$$;

-- Уведомления: тренеру — о моментальной записи, остальное как раньше.
create or replace function public.registrations_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ev public.events;
  who text;
  at_text text;
begin
  select * into ev from public.events where id = new.event_id;
  if not found or ev.organizer_id is null then
    return new;
  end if;
  at_text := to_char(ev.starts_at at time zone 'Europe/Minsk', 'DD.MM HH24:MI');
  if tg_op = 'INSERT' and new.status = 'pending' then
    select name into who from public.profiles where id = new.user_id;
    perform public.notify(ev.organizer_id, 'request_new', 'Новая заявка',
      coalesce(who, 'Участник') || ' хочет на «' || ev.title || '». Посмотрите профиль и подтвердите.',
      '/event/' || ev.id);
  elsif tg_op = 'INSERT' and new.status = 'approved' and new.user_id <> ev.organizer_id then
    select name into who from public.profiles where id = new.user_id;
    perform public.notify(ev.organizer_id, 'booking_new', 'Новая запись',
      coalesce(who, 'Клиент') || ' записался на «' || ev.title || '», ' || at_text || '.',
      '/event/' || ev.id);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.user_id <> ev.organizer_id then
    if new.status = 'approved' then
      perform public.notify(new.user_id, 'request_approved', 'Заявка принята',
        'Вы записаны на «' || ev.title || '». До встречи!', '/event/' || ev.id);
    elsif new.status = 'rejected' then
      perform public.notify(new.user_id, 'request_rejected', 'Заявка отклонена',
        'Организатор «' || ev.title || '» не подтвердил заявку. Посмотрите другие события.', '/event/' || ev.id);
    end if;
  end if;
  return new;
end;
$$;

-- Клиент отменил запись на будущее занятие из расписания — тренеру.
create or replace function public.registrations_notify_cancel()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ev public.events;
  who text;
begin
  if old.status <> 'approved' then
    return old;
  end if;
  select * into ev from public.events where id = old.event_id;
  if not found or ev.organizer_id is null or ev.slot_id is null
     or old.user_id = ev.organizer_id or ev.starts_at < now() or ev.status <> 'published' then
    return old;
  end if;
  select name into who from public.profiles where id = old.user_id;
  perform public.notify(ev.organizer_id, 'booking_cancelled', 'Запись отменена',
    coalesce(who, 'Клиент') || ' отменил запись на «' || ev.title || '», ' ||
    to_char(ev.starts_at at time zone 'Europe/Minsk', 'DD.MM HH24:MI') || '. Место снова свободно.',
    '/event/' || ev.id);
  return old;
end;
$$;
drop trigger if exists registrations_notify_cancel on public.registrations;
create trigger registrations_notify_cancel
  after delete on public.registrations
  for each row execute function public.registrations_notify_cancel();

-- ============================================================
-- 3. Генерация занятий по шаблону
-- ============================================================
-- Есть ли на занятии клиенты (заявки или записи кроме самого тренера).
create or replace function public.event_has_clients(p_event uuid, p_organizer uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.registrations r
                  where r.event_id = p_event and r.user_id is distinct from p_organizer
                    and r.status in ('pending', 'approved'));
$$;

-- Привести будущие занятия слота в соответствие с шаблоном и выставить их на 4 недели вперёд.
create or replace function public.materialize_slot(p_slot uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  s public.coach_slots;
  tz constant text := 'Europe/Minsk';
  today date := (now() at time zone 'Europe/Minsk')::date;
  horizon date := (now() at time zone 'Europe/Minsk')::date + 27;
  lvl text;
begin
  select * into s from public.coach_slots where id = p_slot;
  if not found then
    return;
  end if;
  lvl := coalesce((select l from unnest(s.levels) l order by public.level_rank(l) limit 1), 'any');

  -- Свободные занятия, которые больше не подходят под шаблон, убираем.
  delete from public.events e
   where e.slot_id = s.id
     and e.starts_at > now()
     and e.status = 'published'
     and not public.event_has_clients(e.id, e.organizer_id)
     and (not s.active
          or extract(isodow from e.starts_at at time zone tz)::smallint <> all (s.weekdays)
          or (e.starts_at at time zone tz)::time <> s.start_time
          or (e.starts_at at time zone tz)::date < s.valid_from
          or (s.valid_until is not null and (e.starts_at at time zone tz)::date > s.valid_until));

  if not s.active then
    return;
  end if;

  -- Остальные свободные занятия обновляем по шаблону.
  update public.events e
     set title = s.title, sport = s.sport, description = s.description, duration_min = s.duration_min,
         venue_name = s.venue_name, address = s.address, city = s.city, lat = s.lat, lng = s.lng,
         level = lvl, levels = s.levels, price = s.price, capacity = s.spots + 1, reserved = 0,
         auto_approve = s.auto_approve
   where e.slot_id = s.id
     and e.starts_at > now()
     and e.status = 'published'
     and not public.event_has_clients(e.id, e.organizer_id);

  -- Недостающие даты в горизонте.
  insert into public.events (title, sport, event_type, description, starts_at, duration_min, venue_name, address,
                             city, lat, lng, level, levels, price, capacity, reserved, organizer_id, slot_id, auto_approve)
  select s.title, s.sport, 'training', s.description, (d::date + s.start_time) at time zone tz, s.duration_min,
         coalesce(nullif(s.venue_name, ''), nullif(s.address, ''), 'Точка на карте'), s.address,
         s.city, s.lat, s.lng, lvl, s.levels, s.price, s.spots + 1, 0, s.coach_id, s.id, s.auto_approve
    from generate_series(greatest(today, s.valid_from)::timestamp,
                         least(horizon, coalesce(s.valid_until, horizon))::timestamp,
                         interval '1 day') d
   where extract(isodow from d)::smallint = any (s.weekdays)
     and (d::date + s.start_time) at time zone tz > now()
  on conflict (slot_id, starts_at) do nothing;
end;
$$;
revoke execute on function public.materialize_slot(uuid) from public, anon, authenticated;

create or replace function public.coach_slots_after_write()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.materialize_slot(new.id);
  return new;
end;
$$;
drop trigger if exists coach_slots_after_write on public.coach_slots;
create trigger coach_slots_after_write
  after insert or update on public.coach_slots
  for each row execute function public.coach_slots_after_write();

create or replace function public.coach_slots_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.coach_id := old.coach_id;
  return new;
end;
$$;
drop trigger if exists coach_slots_touch on public.coach_slots;
create trigger coach_slots_touch
  before update on public.coach_slots
  for each row execute function public.coach_slots_touch();

-- Слот удалили: свободные будущие занятия убираем, занятия с записями остаются.
create or replace function public.coach_slots_before_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.events e
   where e.slot_id = old.id
     and e.starts_at > now()
     and e.status = 'published'
     and not public.event_has_clients(e.id, e.organizer_id);
  return old;
end;
$$;
drop trigger if exists coach_slots_before_delete on public.coach_slots;
create trigger coach_slots_before_delete
  before delete on public.coach_slots
  for each row execute function public.coach_slots_before_delete();

-- Каждую ночь выставляем следующий день по всем активным шаблонам.
create or replace function public.materialize_all_slots()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  sid uuid;
begin
  for sid in select id from public.coach_slots where active loop
    perform public.materialize_slot(sid);
  end loop;
end;
$$;
revoke execute on function public.materialize_all_slots() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('coach-schedule') where exists (select 1 from cron.job where jobname = 'coach-schedule');
    perform cron.schedule('coach-schedule', '5 0 * * *', 'select public.materialize_all_slots()');
  end if;
end;
$$;

notify pgrst, 'reload schema';
