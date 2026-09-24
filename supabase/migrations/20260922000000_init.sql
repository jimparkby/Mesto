-- Mesto: базовая схема MVP
-- profiles ← auth.users, events, registrations + RLS

create extension if not exists pgcrypto;

-- ============================================================
-- profiles
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default 'Спортсмен',
  username    text,
  photo_url   text,
  telegram_id bigint unique,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

-- Профиль создаётся автоматически при регистрации (Telegram, анонимный гость, email).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, username, photo_url, telegram_id)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), 'Спортсмен'),
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'photo_url',
    (new.raw_user_meta_data ->> 'telegram_id')::bigint
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============================================================
-- events
-- ============================================================
create table public.events (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 3 and 120),
  sport            text not null check (sport in (
                     'football','running','basketball','volleyball','tennis','yoga',
                     'cycling','workout','swimming','hockey','other')),
  description      text not null default '',
  starts_at        timestamptz not null,
  duration_min     int not null default 60 check (duration_min between 15 and 720),
  venue_name       text not null,
  address          text not null default '',
  lat              double precision not null,
  lng              double precision not null,
  level            text not null default 'any' check (level in ('any','beginner','intermediate','advanced')),
  price            numeric(8, 2) not null default 0 check (price >= 0),
  capacity         int not null check (capacity between 1 and 1000),
  registered_count int not null default 0,
  organizer_id     uuid references public.profiles (id) on delete set null,
  organizer_name   text not null default '',
  status           text not null default 'published' check (status in ('published','hidden','cancelled')),
  created_at       timestamptz not null default now()
);

create index events_starts_at_idx on public.events (starts_at);
create index events_status_idx on public.events (status);

-- Имя организатора денормализовано, чтобы список событий грузился одним запросом.
create or replace function public.events_fill_organizer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.organizer_id is not null and coalesce(new.organizer_name, '') = '' then
    select name into new.organizer_name from public.profiles where id = new.organizer_id;
  end if;
  return new;
end;
$$;

create trigger events_fill_organizer
  before insert on public.events
  for each row execute function public.events_fill_organizer();

-- ============================================================
-- registrations
-- ============================================================
create table public.registrations (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index registrations_user_idx on public.registrations (user_id);

-- Проверка мест и счётчик участников — атомарно, с блокировкой строки события.
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
  if ev.registered_count >= ev.capacity then
    raise exception 'Мест больше нет';
  end if;
  update public.events set registered_count = registered_count + 1 where id = new.event_id;
  return new;
end;
$$;

create trigger registrations_before_insert
  before insert on public.registrations
  for each row execute function public.registrations_before_insert();

create or replace function public.registrations_after_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.events
     set registered_count = greatest(registered_count - 1, 0)
   where id = old.event_id;
  return old;
end;
$$;

create trigger registrations_after_delete
  after delete on public.registrations
  for each row execute function public.registrations_after_delete();

-- Организатор автоматически становится первым участником.
create or replace function public.events_after_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.organizer_id is not null then
    insert into public.registrations (event_id, user_id) values (new.id, new.organizer_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger events_after_insert
  after insert on public.events
  for each row execute function public.events_after_insert();

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;

-- profiles: имена участников видны всем, менять можно только своё имя/фото.
create policy "profiles are readable" on public.profiles
  for select using (true);
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (name, photo_url) on public.profiles to authenticated;

-- events
create policy "published events are readable" on public.events
  for select using (status = 'published' or organizer_id = auth.uid() or public.is_admin());
create policy "authenticated users create events" on public.events
  for insert to authenticated
  with check (organizer_id = auth.uid() and status = 'published' and registered_count = 0);
create policy "organizer or admin updates event" on public.events
  for update to authenticated
  using (organizer_id = auth.uid() or public.is_admin());
revoke update on public.events from anon, authenticated;
grant update (title, sport, description, starts_at, duration_min, venue_name, address,
              lat, lng, level, price, capacity, status)
  on public.events to authenticated;

-- registrations
create policy "registrations are readable" on public.registrations
  for select using (true);
create policy "register yourself" on public.registrations
  for insert to authenticated with check (user_id = auth.uid());
create policy "unregister yourself" on public.registrations
  for delete to authenticated using (user_id = auth.uid());
