-- Демо-события в Минске на ближайшую неделю (время — Europe/Minsk).
-- Запуск: supabase db reset  (или вставить в SQL Editor).

with base as (
  select date_trunc('day', now() at time zone 'Europe/Minsk') as d
)
insert into public.events
  (title, sport, description, starts_at, duration_min, venue_name, address, lat, lng,
   level, price, capacity, registered_count, organizer_name)
select v.title, v.sport, v.description,
       ((select d from base) + v.at) at time zone 'Europe/Minsk',
       v.duration_min, v.venue_name, v.address, v.lat, v.lng,
       v.level, v.price, v.capacity, v.registered_count, v.organizer_name
from (values
  ('Утренняя пробежка 5 км', 'running', 'Спокойный темп 6:00–6:30 /км вдоль Свислочи. Сбор у колеса обозрения.',
    interval '1 day 7 hours 30 minutes', 50, 'Парк Горького', 'ул. Фрунзе, 2', 53.9037, 27.5702, 'any', 0, 30, 12, 'Minsk Running Club'),
  ('Футбол 7×7 вечером', 'football', 'Искусственный газон, манишки есть. Оплата на месте.',
    interval '1 day 19 hours', 90, 'Стадион «Динамо»', 'ул. Кирова, 8', 53.8999, 27.5608, 'intermediate', 10, 14, 11, 'Андрей К.'),
  ('Йога на траве', 'yoga', 'Хатха-йога для начинающих у Комсомольского озера.',
    interval '1 day 18 hours 30 minutes', 60, 'Парк Победы', 'пр-т Победителей, 3', 53.9146, 27.5347, 'beginner', 0, 20, 8, 'Yoga Minsk'),
  ('Стритбол 3×3', 'basketball', 'Играем на выбывание до 11 очков.',
    interval '2 days 18 hours', 120, 'Парк Челюскинцев', 'пр-т Независимости, 84', 53.9224, 27.6138, 'any', 0, 12, 5, 'Streetball BY'),
  ('Пляжный волейбол', 'volleyball', 'Две площадки у воды, играем 4×4.',
    interval '2 days 17 hours', 120, 'Дрозды', 'Минское море, пляж «Дрозды»', 53.9585, 27.4553, 'intermediate', 5, 12, 10, 'Beach Minsk'),
  ('Велозаезд вокруг Цнянки', 'cycling', '40 км, 22–25 км/ч. Шлем обязателен.',
    interval '3 days 10 hours', 150, 'Цнянское водохранилище', 'ул. Нововиленская, набережная', 53.9721, 27.5864, 'intermediate', 0, 25, 9, 'Велосообщество Минска'),
  ('Любительский хоккей', 'hockey', 'Полная экипировка обязательна.',
    interval '3 days 21 hours', 90, 'Чижовка-Арена', 'ул. Уборевича, 10', 53.8605, 27.6413, 'advanced', 25, 20, 17, 'Хоккей после работы'),
  ('Трейл в Лошице', 'running', '12 км по грунтовым тропам.',
    interval '5 days 9 hours', 90, 'Лошицкий парк', 'ул. Маяковского, 191', 53.8497, 27.5871, 'intermediate', 0, 25, 14, 'Minsk Trail'),
  ('Мини-футбол в зале', 'football', 'Игра для новичков, без жёсткого подката.',
    interval '4 days 20 hours', 90, 'ФОК «Уручье»', 'ул. Ложинская, 4', 53.9453, 27.6868, 'beginner', 8, 12, 6, 'Футбол для всех')
) as v(title, sport, description, at, duration_min, venue_name, address, lat, lng,
       level, price, capacity, registered_count, organizer_name);
