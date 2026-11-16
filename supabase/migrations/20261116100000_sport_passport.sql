-- Mesto 2.0: спортивный паспорт, 80+ видов спорта, уровни Novice → Pro, комментарии к событиям,
-- подтверждение игры и взаимные оценки, комьюнити (общение — в Telegram-чатах), уведомления,
-- статистика тренера, Premium и хранилище фото/видео профиля.

-- ============================================================
-- 1. Виды спорта и уровни
-- ============================================================
-- Каталог видов спорта живёт в приложении (domain/sports.ts); в БД проверяем только формат id.
alter table public.events drop constraint if exists events_sport_check;
alter table public.events add constraint events_sport_check check (sport ~ '^[a-z_]{2,32}$');
alter table public.profiles drop constraint if exists profiles_fav_sports_check;
alter table public.profiles drop constraint if exists profiles_coach_sports_check;

alter table public.events drop constraint if exists events_level_check;
alter table public.events add constraint events_level_check
  check (level in ('any', 'beginner', 'amateur', 'intermediate', 'advanced', 'pro'));
alter table public.profiles drop constraint if exists profiles_skill_level_check;
alter table public.profiles add constraint profiles_skill_level_check
  check (skill_level in ('any', 'beginner', 'amateur', 'intermediate', 'advanced', 'pro'));

create or replace function public.level_rank(l text)
returns int
language sql
immutable
as $$
  select case l
    when 'beginner' then 1 when 'amateur' then 2 when 'intermediate' then 3
    when 'advanced' then 4 when 'pro' then 5 else 0 end;
$$;

-- ============================================================
-- 2. Спортивный паспорт в profiles
-- ============================================================
alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check check (char_length(bio) <= 600);

alter table public.profiles
  add column if not exists gender      text check (gender in ('male', 'female')),
  add column if not exists birth_date  date check (birth_date >= date '1920-01-01'),
  add column if not exists city        text not null default 'Минск' check (char_length(city) between 1 and 60),
  add column if not exists languages   text[] not null default '{}' check (cardinality(languages) <= 10),
  -- [{ "sport": "padel", "level": "intermediate", "years": 3, "price": 30 }]; years/price — у тренера.
  add column if not exists skills      jsonb not null default '[]'
    check (jsonb_typeof(skills) = 'array' and jsonb_array_length(skills) <= 30),
  add column if not exists photos      text[] not null default '{}' check (cardinality(photos) <= 9),
  add column if not exists videos      text[] not null default '{}' check (cardinality(videos) <= 6),
  add column if not exists onboarded   boolean not null default false,
  add column if not exists premium_until timestamptz,
  add column if not exists last_seen_at  timestamptz,
  add column if not exists rating_vibe          numeric(3, 2),
  add column if not exists rating_level_fit     numeric(3, 2),
  add column if not exists rating_effectiveness numeric(3, 2),
  add column if not exists rating_count         int not null default 0;

create index if not exists profiles_city_idx on public.profiles (city);
create index if not exists profiles_fav_sports_idx on public.profiles using gin (fav_sports);

-- Старые поля (fav_sports, skill_level, coach_sports, coach_years) выводим из skills —
-- их читают бот и старые версии приложения.
create or replace function public.profiles_sync_skills()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.skills is distinct from old.skills or new.is_coach is distinct from old.is_coach then
    new.fav_sports := coalesce(array(select distinct s ->> 'sport' from jsonb_array_elements(new.skills) s
                                     where coalesce(s ->> 'sport', '') <> ''), '{}');
    new.skill_level := coalesce((select s ->> 'level' from jsonb_array_elements(new.skills) s
                                 where s ->> 'level' in ('beginner', 'amateur', 'intermediate', 'advanced', 'pro')
                                 order by public.level_rank(s ->> 'level') desc limit 1), 'any');
    if new.is_coach then
      new.coach_sports := new.fav_sports;
      new.coach_years := least(60, greatest(0, coalesce((select max((s ->> 'years')::numeric)::int
                                                         from jsonb_array_elements(new.skills) s
                                                         where jsonb_typeof(s -> 'years') = 'number'), new.coach_years, 0)));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_skills on public.profiles;
create trigger profiles_sync_skills
  before insert or update on public.profiles
  for each row execute function public.profiles_sync_skills();

-- Переносим старый раздел «О себе» и профиль тренера в паспорт.
update public.profiles p set
  skills = coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'sport', s,
             'level', case when p.skill_level = 'any' then 'amateur' else p.skill_level end,
             'years', case when p.is_coach and s = any (p.coach_sports) then p.coach_years end)))
    from unnest(array(select distinct x from unnest(p.fav_sports || p.coach_sports) x)) s
  ), '[]'::jsonb),
  onboarded = cardinality(p.fav_sports) > 0 or cardinality(p.coach_sports) > 0
where p.skills = '[]'::jsonb;

update public.profiles set bio = left(coach_bio, 600) where is_coach and bio = '' and coach_bio <> '';

revoke update on public.profiles from anon, authenticated;
grant update (name, photo_url, bio, fav_sports, skill_level, is_coach, coach_bio, coach_sports, coach_years,
              gender, birth_date, city, languages, skills, photos, videos, onboarded)
  on public.profiles to authenticated;

create or replace function public.is_premium(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = uid and premium_until > now());
$$;

-- «Онлайн / был недавно».
create or replace function public.touch_last_seen()
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles set last_seen_at = now()
   where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
$$;
grant execute on function public.touch_last_seen() to authenticated;

-- ============================================================
-- 3. События: несколько уровней, занятые места, город
-- ============================================================
alter table public.events
  add column if not exists levels   text[] not null default '{}'
    check (levels <@ array['beginner', 'amateur', 'intermediate', 'advanced', 'pro']::text[]),
  add column if not exists reserved int not null default 0,
  add column if not exists city     text not null default 'Минск' check (char_length(city) between 1 and 60);

alter table public.events drop constraint if exists events_reserved_check;
alter table public.events add constraint events_reserved_check check (reserved >= 0 and reserved < capacity);

create index if not exists events_city_idx on public.events (city);

revoke update on public.events from anon, authenticated;
grant update (title, sport, event_type, description, starts_at, duration_min, venue_name, address,
              lat, lng, level, levels, price, capacity, reserved, city, status)
  on public.events to authenticated;

-- Места: занятые вне приложения (reserved) тоже считаются.
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
  if ev.organizer_id is null or ev.organizer_id = new.user_id then
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

create or replace function public.registrations_before_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ev public.events;
begin
  if new.event_id <> old.event_id or new.user_id <> old.user_id then
    raise exception 'Нельзя менять заявку';
  end if;
  if new.status = old.status then
    return new;
  end if;
  select * into ev from public.events where id = new.event_id for update;
  if new.status = 'approved' then
    if ev.registered_count + ev.reserved >= ev.capacity then
      raise exception 'Мест больше нет';
    end if;
    update public.events set registered_count = registered_count + 1 where id = new.event_id;
  elsif old.status = 'approved' then
    update public.events set registered_count = greatest(registered_count - 1, 0) where id = new.event_id;
  end if;
  new.decided_at := now();
  return new;
end;
$$;

-- Подтверждение игры и оценка: когда участник подтвердил и когда закончил с оценками.
alter table public.registrations
  add column if not exists confirmed_at timestamptz,
  add column if not exists reviewed_at  timestamptz,
  add column if not exists reminded_at  timestamptz;

-- ============================================================
-- 4. Уведомления
-- ============================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null default '',
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select p_user, p_kind, p_title, left(coalesce(p_body, ''), 500), p_link
  where p_user is not null;
$$;
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- Приветствие от команды — первое уведомление каждого нового пользователя.
create or replace function public.profiles_welcome()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify(new.id, 'welcome', 'Привет от команды Mesto 👋',
    'Заполните спортивный паспорт, находите партнёров своего уровня и создавайте события. ' ||
    'Вопросы и идеи пишите нам в Telegram — читаем всё и отвечаем лично.', '/profile');
  return new;
end;
$$;
drop trigger if exists profiles_welcome on public.profiles;
create trigger profiles_welcome
  after insert on public.profiles
  for each row execute function public.profiles_welcome();

-- Заявки: организатору — о новой, участнику — о решении.
create or replace function public.registrations_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ev public.events;
  who text;
begin
  select * into ev from public.events where id = new.event_id;
  if not found or ev.organizer_id is null then
    return new;
  end if;
  if tg_op = 'INSERT' and new.status = 'pending' then
    select name into who from public.profiles where id = new.user_id;
    perform public.notify(ev.organizer_id, 'request_new', 'Новая заявка',
      coalesce(who, 'Участник') || ' хочет на «' || ev.title || '». Посмотрите профиль и подтвердите.',
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
drop trigger if exists registrations_notify on public.registrations;
create trigger registrations_notify
  after insert or update of status on public.registrations
  for each row execute function public.registrations_notify();

-- Организатор отменил событие — участникам.
create or replace function public.events_notify_cancel()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into public.notifications (user_id, kind, title, body, link)
    select r.user_id, 'event_cancelled', 'Событие отменено',
           'Организатор отменил «' || new.title || '».', '/event/' || new.id
      from public.registrations r
     where r.event_id = new.id and r.status = 'approved' and r.user_id is distinct from new.organizer_id;
  end if;
  return new;
end;
$$;
drop trigger if exists events_notify_cancel on public.events;
create trigger events_notify_cancel
  after update of status on public.events
  for each row execute function public.events_notify_cancel();

-- ============================================================
-- 5. Комментарии к событиям
-- ============================================================
create table if not exists public.event_comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  text       text not null check (char_length(btrim(text)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists event_comments_event_idx on public.event_comments (event_id, created_at);

alter table public.event_comments enable row level security;
drop policy if exists "comments are readable" on public.event_comments;
create policy "comments are readable" on public.event_comments for select using (true);
drop policy if exists "comment as yourself" on public.event_comments;
create policy "comment as yourself" on public.event_comments
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "delete own comment or as organizer" on public.event_comments;
create policy "delete own comment or as organizer" on public.event_comments
  for delete to authenticated using (
    user_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  );
revoke update on public.event_comments from anon, authenticated;

create or replace function public.event_comments_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ev public.events;
  who text;
begin
  select * into ev from public.events where id = new.event_id;
  if found and ev.organizer_id is not null and ev.organizer_id <> new.user_id then
    select name into who from public.profiles where id = new.user_id;
    perform public.notify(ev.organizer_id, 'comment', coalesce(who, 'Участник') || ' · «' || ev.title || '»',
      new.text, '/event/' || ev.id);
  end if;
  return new;
end;
$$;
drop trigger if exists event_comments_notify on public.event_comments;
create trigger event_comments_notify
  after insert on public.event_comments
  for each row execute function public.event_comments_notify();

-- ============================================================
-- 6. Подтверждение игры и взаимные оценки
-- ============================================================
create table if not exists public.ratings (
  event_id      uuid not null references public.events (id) on delete cascade,
  rater_id      uuid not null references public.profiles (id) on delete cascade,
  ratee_id      uuid not null references public.profiles (id) on delete cascade,
  vibe          smallint check (vibe between 1 and 5),
  level_fit     smallint check (level_fit between 1 and 5),
  effectiveness smallint check (effectiveness between 1 and 5),
  created_at    timestamptz not null default now(),
  primary key (event_id, rater_id, ratee_id),
  check (rater_id <> ratee_id),
  check (coalesce(vibe, level_fit, effectiveness) is not null)
);
create index if not exists ratings_ratee_idx on public.ratings (ratee_id);

-- Свои выставленные оценки видит только автор; другим — только средние в профиле.
alter table public.ratings enable row level security;
drop policy if exists "own given ratings" on public.ratings;
create policy "own given ratings" on public.ratings for select to authenticated using (rater_id = auth.uid());
revoke insert, update, delete on public.ratings from anon, authenticated;

create or replace function public.ratings_aggregate()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := coalesce(new.ratee_id, old.ratee_id);
begin
  update public.profiles p set
    rating_vibe = a.vibe, rating_level_fit = a.level_fit,
    rating_effectiveness = a.effectiveness, rating_count = a.cnt
  from (
    select round(avg(vibe)::numeric, 2) vibe, round(avg(level_fit)::numeric, 2) level_fit,
           round(avg(effectiveness)::numeric, 2) effectiveness, count(*)::int cnt
      from public.ratings where ratee_id = uid
  ) a
  where p.id = uid;
  return null;
end;
$$;
drop trigger if exists ratings_aggregate on public.ratings;
create trigger ratings_aggregate
  after insert or update or delete on public.ratings
  for each row execute function public.ratings_aggregate();

-- Прошедшие события, где я принятый участник и ещё не подтвердил игру (за последние 14 дней).
create or replace function public.pending_reviews()
returns setof uuid
language sql
stable
security definer set search_path = public
as $$
  select e.id
    from public.registrations r
    join public.events e on e.id = r.event_id
   where r.user_id = auth.uid()
     and r.status = 'approved'
     and r.reviewed_at is null
     and e.organizer_id is not null
     and e.status = 'published'
     and e.starts_at + make_interval(mins => e.duration_min) < now()
     and e.starts_at > now() - interval '14 days'
     and exists (select 1 from public.registrations o
                  where o.event_id = e.id and o.status = 'approved' and o.user_id <> auth.uid())
   order by e.starts_at desc;
$$;
grant execute on function public.pending_reviews() to authenticated;

-- Подтвердить игру и оценить партнёров: [{ "ratee": uuid, "vibe": 5, "level_fit": 4, "effectiveness": null }].
create or replace function public.submit_review(p_event uuid, p_happened boolean, p_ratings jsonb default '[]')
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  ev public.events;
  item jsonb;
  ratee uuid;
begin
  select * into ev from public.events where id = p_event;
  if not found then
    raise exception 'Событие не найдено';
  end if;
  if ev.starts_at + make_interval(mins => ev.duration_min) > now() then
    raise exception 'Оценить можно после окончания события';
  end if;
  if not exists (select 1 from public.registrations
                  where event_id = p_event and user_id = auth.uid() and status = 'approved') then
    raise exception 'Оценивать могут только участники события';
  end if;

  if p_happened then
    for item in select * from jsonb_array_elements(coalesce(p_ratings, '[]'::jsonb)) loop
      ratee := (item ->> 'ratee')::uuid;
      if ratee = auth.uid() then
        continue;
      end if;
      if not exists (select 1 from public.registrations
                      where event_id = p_event and user_id = ratee and status = 'approved') then
        continue;
      end if;
      if coalesce(item ->> 'vibe', item ->> 'level_fit', item ->> 'effectiveness') is null then
        continue;
      end if;
      insert into public.ratings (event_id, rater_id, ratee_id, vibe, level_fit, effectiveness)
      values (p_event, auth.uid(), ratee,
              nullif(item ->> 'vibe', '')::smallint,
              nullif(item ->> 'level_fit', '')::smallint,
              nullif(item ->> 'effectiveness', '')::smallint)
      on conflict (event_id, rater_id, ratee_id) do update
        set vibe = excluded.vibe, level_fit = excluded.level_fit,
            effectiveness = excluded.effectiveness, created_at = now();
    end loop;
  end if;

  update public.registrations
     set confirmed_at = case when p_happened then now() end,
         reviewed_at = now()
   where event_id = p_event and user_id = auth.uid();
end;
$$;
grant execute on function public.submit_review(uuid, boolean, jsonb) to authenticated;

-- Напоминание оценить игру — через час после окончания (pg_cron ниже).
create or replace function public.queue_rate_reminders()
returns void
language sql
security definer set search_path = public
as $$
  with due as (
    update public.registrations r
       set reminded_at = now()
      from public.events e
     where e.id = r.event_id
       and r.status = 'approved'
       and r.reminded_at is null
       and r.reviewed_at is null
       and e.organizer_id is not null
       and e.status = 'published'
       and e.starts_at + make_interval(mins => e.duration_min) between now() - interval '1 day' and now() - interval '1 hour'
       and exists (select 1 from public.registrations o
                    where o.event_id = e.id and o.status = 'approved' and o.user_id <> r.user_id)
    returning r.user_id, e.id, e.title, e.event_type
  )
  insert into public.notifications (user_id, kind, title, body, link)
  select user_id, 'rate_reminder',
         case when event_type = 'training' then 'Как прошла тренировка?' else 'Как прошла игра?' end,
         'Подтвердите «' || title || '» и оцените партнёров — это займёт 5 секунд и поможет подбирать игроков.',
         '/rate/' || id
    from due;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('rate-reminders') where exists (select 1 from cron.job where jobname = 'rate-reminders');
    perform cron.schedule('rate-reminders', '*/15 * * * *', 'select public.queue_rate_reminders()');
  end if;
end;
$$;

-- ============================================================
-- 7. Комьюнити: каталог тематических Telegram-чатов
-- ============================================================
create table if not exists public.communities (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(btrim(title)) between 3 and 80),
  description   text not null default '' check (char_length(description) <= 500),
  sport         text check (sport is null or sport ~ '^[a-z_]{2,32}$'),
  city          text not null default 'Минск' check (char_length(city) between 1 and 60),
  level         text not null default 'any'
    check (level in ('any', 'beginner', 'amateur', 'intermediate', 'advanced', 'pro')),
  tg_link       text not null check (tg_link ~ '^https://t\.me/[A-Za-z0-9_+/=-]{3,}$'),
  photo_url     text,
  created_by    uuid references public.profiles (id) on delete set null,
  members_count int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists communities_city_idx on public.communities (city);

create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_members_user_idx on public.community_members (user_id);

create or replace function public.community_members_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set members_count = members_count + 1 where id = new.community_id;
  else
    update public.communities set members_count = greatest(members_count - 1, 0) where id = old.community_id;
  end if;
  return null;
end;
$$;
drop trigger if exists community_members_count on public.community_members;
create trigger community_members_count
  after insert or delete on public.community_members
  for each row execute function public.community_members_count();

create or replace function public.communities_after_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.community_members (community_id, user_id) values (new.id, new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists communities_after_insert on public.communities;
create trigger communities_after_insert
  after insert on public.communities
  for each row execute function public.communities_after_insert();

alter table public.communities enable row level security;
alter table public.community_members enable row level security;

drop policy if exists "communities are readable" on public.communities;
create policy "communities are readable" on public.communities for select using (true);
-- Создавать комьюнити — привилегия Premium (и админа).
drop policy if exists "premium creates communities" on public.communities;
create policy "premium creates communities" on public.communities
  for insert to authenticated
  with check (created_by = auth.uid() and members_count = 0 and (public.is_premium() or public.is_admin()));
drop policy if exists "owner updates community" on public.communities;
create policy "owner updates community" on public.communities
  for update to authenticated using (created_by = auth.uid() or public.is_admin());
drop policy if exists "owner deletes community" on public.communities;
create policy "owner deletes community" on public.communities
  for delete to authenticated using (created_by = auth.uid() or public.is_admin());
revoke update on public.communities from anon, authenticated;
grant update (title, description, sport, city, level, tg_link, photo_url) on public.communities to authenticated;

drop policy if exists "members are readable" on public.community_members;
create policy "members are readable" on public.community_members for select using (true);
drop policy if exists "join yourself" on public.community_members;
create policy "join yourself" on public.community_members
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "leave yourself" on public.community_members;
create policy "leave yourself" on public.community_members
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- 8. Просмотры профиля и статистика тренера
-- ============================================================
create table if not exists public.profile_views (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id  uuid not null references public.profiles (id) on delete cascade,
  day        date not null default current_date,
  primary key (profile_id, viewer_id, day)
);
alter table public.profile_views enable row level security;

create or replace function public.track_profile_view(p_profile uuid)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.profile_views (profile_id, viewer_id)
  select p_profile, auth.uid()
   where auth.uid() is not null and auth.uid() <> p_profile
  on conflict do nothing;
$$;
grant execute on function public.track_profile_view(uuid) to authenticated;

-- Статистика тренера за последние p_days дней и такой же период до них:
-- доход и брони по дням, воронка «просмотры профиля → заявки → брони → проведено».
create or replace function public.coach_stats(p_days int default 7, p_sport text default null)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  d int := least(greatest(coalesce(p_days, 7), 1), 365);
  t1 timestamptz := now();
  t0 timestamptz := now() - make_interval(days => d);
  tp timestamptz := now() - make_interval(days => 2 * d);
  result jsonb;
begin
  if me is null then
    raise exception 'Нужно войти';
  end if;

  with ev as (
    select e.* from public.events e
     where e.organizer_id = me and (p_sport is null or e.sport = p_sport)
  ),
  regs as (
    select r.*, ev.price, ev.starts_at, ev.duration_min,
           ev.starts_at + make_interval(mins => ev.duration_min) as ends_at
      from public.registrations r join ev on ev.id = r.event_id
     where r.user_id <> me
  ),
  funnel as (
    select
      (select count(*) from public.profile_views v where v.profile_id = me and v.day >= t0::date) views,
      (select count(*) from regs where created_at >= t0) requests,
      (select count(*) from regs where status = 'approved' and created_at >= t0) bookings,
      (select count(*) from regs where status = 'approved' and ends_at between t0 and t1) held,
      (select coalesce(sum(price), 0) from regs where status = 'approved' and ends_at between t0 and t1) income
  ),
  prev as (
    select
      (select count(*) from public.profile_views v where v.profile_id = me and v.day >= tp::date and v.day < t0::date) views,
      (select count(*) from regs where created_at >= tp and created_at < t0) requests,
      (select count(*) from regs where status = 'approved' and created_at >= tp and created_at < t0) bookings,
      (select count(*) from regs where status = 'approved' and ends_at >= tp and ends_at < t0) held,
      (select coalesce(sum(price), 0) from regs where status = 'approved' and ends_at >= tp and ends_at < t0) income
  ),
  days as (
    select g::date as day
      from generate_series((t0::date + 1)::timestamp, t1::date::timestamp, interval '1 day') g
  ),
  series as (
    select jsonb_agg(jsonb_build_object(
             'date', days.day,
             'income', coalesce((select sum(price) from regs where status = 'approved' and ends_at::date = days.day and ends_at <= t1), 0),
             'bookings', (select count(*) from regs where status = 'approved' and created_at::date = days.day),
             'sessions', (select count(*) from ev where (ev.starts_at + make_interval(mins => ev.duration_min))::date = days.day
                                                   and ev.starts_at + make_interval(mins => ev.duration_min) <= t1
                                                   and ev.status = 'published'))
             order by days.day) s
      from days
  )
  select jsonb_build_object(
    'days', coalesce((select s from series), '[]'::jsonb),
    'funnel', (select jsonb_build_object('views', views, 'requests', requests, 'bookings', bookings, 'held', held) from funnel),
    'prevFunnel', (select jsonb_build_object('views', views, 'requests', requests, 'bookings', bookings, 'held', held) from prev),
    'income', (select income from funnel),
    'prevIncome', (select income from prev),
    'totalIncome', (select coalesce(sum(price), 0) from regs where status = 'approved' and ends_at <= t1)
  ) into result;
  return result;
end;
$$;
grant execute on function public.coach_stats(int, text) to authenticated;

-- ============================================================
-- 9. Premium (оплата Telegram Stars через бота)
-- ============================================================
create table if not exists public.premium_payments (
  charge_id  text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  stars      int not null,
  days       int not null,
  created_at timestamptz not null default now()
);
alter table public.premium_payments enable row level security;

-- Продлить Premium (бот после оплаты, сервисная роль). Повторный платёж с тем же charge_id не продлевает.
create or replace function public.grant_premium(p_user uuid, p_days int, p_charge text, p_stars int)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  until timestamptz;
begin
  insert into public.premium_payments (charge_id, user_id, stars, days)
  values (p_charge, p_user, p_stars, p_days)
  on conflict (charge_id) do nothing;
  if not found then
    select premium_until into until from public.profiles where id = p_user;
    return until;
  end if;
  update public.profiles
     set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => p_days)
   where id = p_user
  returning premium_until into until;
  perform public.notify(p_user, 'premium', 'Premium активен ⭐',
    'Ваши события выше в выдаче, профиль заметнее, можно создавать комьюнити. Спасибо за поддержку!', '/profile');
  return until;
end;
$$;
revoke execute on function public.grant_premium(uuid, int, text, int) from public, anon, authenticated;

-- Админ выдаёт Premium вручную (партнёрам, тренерам на пробу).
create or replace function public.admin_set_premium(p_user uuid, p_days int)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Только для админа';
  end if;
  update public.profiles
     set premium_until = case when p_days > 0
                              then greatest(coalesce(premium_until, now()), now()) + make_interval(days => p_days)
                         end
   where id = p_user;
end;
$$;
grant execute on function public.admin_set_premium(uuid, int) to authenticated;

-- ============================================================
-- 10. Хранилище фото и видео профиля
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
              'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media: upload to own folder" on storage.objects;
create policy "media: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media: delete own files" on storage.objects;
create policy "media: delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
