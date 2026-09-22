-- Демо-данные «СпортРядом»: 15 событий в Минске на ближайшую неделю (время — Europe/Minsk)
-- и демо-участники, записанные на них. Совпадает с демо-режимом приложения (src/api/mock/seed.ts).
-- Запуск: supabase db reset  (или вставить в SQL Editor). Повторный запуск пересоздаёт данные.

-- ---------- Демо-пользователи (профили создаёт триггер handle_new_user) ----------
delete from auth.users where email like 'demo%@demo.sportryadom.by';

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       format('demo%s@demo.sportryadom.by', n),
       '{"provider":"demo","providers":["demo"]}'::jsonb,
       jsonb_build_object('name', name),
       now(), now()
from unnest(array[
  'Алексей', 'Мария', 'Дмитрий', 'Анна', 'Иван', 'Екатерина', 'Павел', 'Ольга', 'Никита',
  'Юлия', 'Сергей', 'Дарья', 'Максим', 'Алина', 'Артём', 'Виктория', 'Кирилл', 'Полина'
]) with ordinality as t(name, n);

-- ---------- События ----------
delete from public.events where organizer_id is null;

drop table if exists demo_events;
create temporary table demo_events as
select * from (values
  ('Утренняя пробежка 5 км', 'running', 'Спокойный темп 6:00–6:30 /км вдоль Свислочи. Сбор у колеса обозрения. Никого не бросаем!',
    interval '1 day 7 hours 30 minutes', 50, 'Парк Горького', 'ул. Фрунзе, 2', 53.9037, 27.5702, 'any', 0, 30, 12, 'Minsk Running Club'),
  ('Футбол 7×7 вечером', 'football', 'Искусственный газон, манишки есть. Нужны ещё 3 игрока в поле. Оплата на месте.',
    interval '1 day 19 hours', 90, 'Стадион «Динамо»', 'ул. Кирова, 8', 53.8999, 27.5608, 'intermediate', 10, 14, 11, 'Андрей К.'),
  ('Йога на траве', 'yoga', 'Хатха-йога для начинающих у Комсомольского озера. Возьмите коврик и воду.',
    interval '1 day 18 hours 30 minutes', 60, 'Парк Победы', 'пр-т Победителей, 3', 53.9146, 27.5347, 'beginner', 0, 20, 8, 'Yoga Minsk'),
  ('Стритбол 3×3', 'basketball', 'Играем на выбывание до 11 очков. Команды собираем на месте.',
    interval '1 day 18 hours', 120, 'Парк Челюскинцев', 'пр-т Независимости, 84', 53.9224, 27.6138, 'any', 0, 12, 5, 'Streetball BY'),
  ('Пляжный волейбол', 'volleyball', 'Две площадки у воды. Играем 4×4, ротация каждые 15 минут.',
    interval '1 day 17 hours', 120, 'Дрозды', 'Минское море, пляж «Дрозды»', 53.9585, 27.4553, 'intermediate', 5, 12, 10, 'Beach Minsk'),
  ('Велозаезд вокруг Цнянки', 'cycling', '40 км, средняя скорость 22–25 км/ч. Шлем обязателен. Остановка на кофе.',
    interval '2 days 10 hours', 150, 'Цнянское водохранилище', 'ул. Нововиленская, набережная', 53.9721, 27.5864, 'intermediate', 0, 25, 9, 'Велосообщество Минска'),
  ('Воркаут-тренировка', 'workout', 'Круговая тренировка на турниках и брусьях, подберём нагрузку под каждого.',
    interval '1 day 8 hours', 60, 'Севастопольский парк', 'ул. Севастопольская, 1', 53.8858, 27.6226, 'any', 0, 15, 4, 'Workout Minsk'),
  ('Любительский хоккей', 'hockey', 'Малая арена. Полная экипировка обязательна. Оплата льда делится поровну.',
    interval '2 days 21 hours', 90, 'Чижовка-Арена', 'ул. Уборевича, 10', 53.8605, 27.6413, 'advanced', 25, 20, 17, 'Хоккей после работы'),
  ('Теннис: спарринг-партнёр', 'tennis', 'Ищу партнёра уровня NTRP 3.5 на грунт. Корт забронирован.',
    interval '3 days 9 hours', 90, 'Минск-Арена', 'пр-т Победителей, 111', 53.9361, 27.4836, 'intermediate', 20, 2, 1, 'Ольга М.'),
  ('Трейл в Лошице', 'running', '12 км по грунтовым тропам с набором высоты. Подойдут кроссовки с протектором.',
    interval '4 days 9 hours', 90, 'Лошицкий парк', 'ул. Маяковского, 191', 53.8497, 27.5871, 'intermediate', 0, 25, 14, 'Minsk Trail'),
  ('Мини-футбол в зале', 'football', 'Игра для новичков и тех, кто давно не играл. Без жёсткого подката.',
    interval '3 days 20 hours', 90, 'ФОК «Уручье»', 'ул. Ложинская, 4', 53.9453, 27.6868, 'beginner', 8, 12, 6, 'Футбол для всех'),
  ('Семейная зарядка', 'other', 'Зарядка для родителей с детьми на школьном стадионе. Подарки самым активным.',
    interval '5 days 10 hours', 45, 'Каменная Горка, школа №203', 'ул. Лобанка, 8', 53.9076, 27.4337, 'any', 0, 40, 7, 'Активный Фрунзенский'),
  ('Открытая вода: заплыв', 'swimming', 'Заплыв 1–2 км вдоль берега. Обязательны буй и яркая шапочка.',
    interval '5 days 8 hours', 60, 'Дрозды', 'Минское море, пляж «Дрозды»', 53.9585, 27.4553, 'advanced', 0, 15, 6, 'Open Water BY'),
  ('Йога на закате', 'yoga', 'Мягкая практика и дыхательные упражнения у воды.',
    interval '6 days 19 hours', 60, 'Цнянское водохранилище', 'ул. Нововиленская, набережная', 53.9721, 27.5864, 'any', 5, 20, 3, 'Yoga Minsk'),
  ('Волейбол в зале', 'volleyball', 'Классика 6×6. Состав на эту игру уже собран.',
    interval '6 days 20 hours', 120, 'ФОК «Уручье»', 'ул. Ложинская, 4', 53.9453, 27.6868, 'intermediate', 7, 14, 14, 'Волейбол Уручье')
) as v(title, sport, description, at, duration_min, venue_name, address, lat, lng, level, price, capacity, participants, organizer_name);

insert into public.events
  (title, sport, description, starts_at, duration_min, venue_name, address, lat, lng,
   level, price, capacity, organizer_name)
select title, sport, description,
       (date_trunc('day', now() at time zone 'Europe/Minsk') + at) at time zone 'Europe/Minsk',
       duration_min, venue_name, address, lat, lng, level, price, capacity, organizer_name
from demo_events;

-- ---------- Записи демо-участников (счётчик registered_count ведут триггеры) ----------
insert into public.registrations (event_id, user_id)
select e.id, u.id
from demo_events d
join public.events e on e.title = d.title and e.organizer_id is null
join lateral (
  select p.id
  from public.profiles p
  join auth.users au on au.id = p.id
  where au.email like 'demo%@demo.sportryadom.by'
  order by md5(p.id::text || d.title)  -- у каждого события свой набор людей
  limit d.participants
) u on true;
