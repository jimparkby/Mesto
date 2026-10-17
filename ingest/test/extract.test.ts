import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractEvents } from '../../supabase/functions/ingest/extract.ts';
import type { SourcePost } from '../../supabase/functions/ingest/types.ts';

// Пост опубликован в пятницу 16.10.2026 в 12:00 по Минску.
function post(text: string): SourcePost {
  return {
    source: 'telegram',
    postId: 'test/1',
    url: 'https://t.me/test/1',
    postedAt: '2026-10-16T09:00:00+00:00',
    text,
    sourceName: 'Тестовый канал',
  };
}

test('спектакль из афиши — не событие', () => {
  const r = extractEvents(post('Вар\'ятка\n📅 18.10.2026 в 19:00\n\nНовы спектакль РТБД — гэта калі вельмі смешна.'));
  assert.deepEqual(r.events, []);
});

test('билеты на матч — не событие', () => {
  const r = extractEvents(post('Футбол! Матч Динамо — БАТЭ 25 октября в 18:00 на стадионе Динамо. Билеты уже в продаже, приходи болеть!'));
  assert.deepEqual(r.events, []);
});

test('анонс пробежки в формате афиши', () => {
  const r = extractEvents(post(
    'Утренняя пробежка 5 км 🏃\n📅 18.10.2026 в 9:30\n📍 Парк Горького, у колеса обозрения\n' +
    'Спокойный темп, никого не бросаем. Бесплатно, для новичков. Регистрация: https://example.com/run',
  ));
  assert.equal(r.events.length, 1);
  const e = r.events[0];
  assert.equal(e.title, 'Утренняя пробежка 5 км');
  assert.equal(e.sport, 'running');
  assert.equal(e.starts_at_local, '2026-10-18T09:30');
  assert.equal(e.venue_name, 'Парк Горького');
  assert.equal(e.lat, 53.9037);
  assert.equal(e.price_byn, 0);
  assert.equal(e.level, 'beginner');
  assert.equal(e.confident, true);
});

test('расписание футбола — несколько событий с диапазоном времени', () => {
  const r = extractEvents(post(
    'Футбол на неделе, записываемся в комментариях\n' +
    '19.10 понедельник 20.30—22.00 ФОЦ Машерова, пр-т Победителей, 23 (зал)\n' +
    '21.10 среда 20.00—21.30 СОК Олимпийский, ул. Сурганова, 2а\n' +
    'По 12 р, до 14 человек',
  ));
  assert.equal(r.events.length, 2);
  assert.equal(r.events[0].starts_at_local, '2026-10-19T20:30');
  assert.equal(r.events[0].duration_min, 90);
  assert.equal(r.events[0].title, 'Футбол — ФОЦ им. Машерова');
  assert.equal(r.events[0].venue_name, 'ФОЦ им. Машерова');
  assert.equal(r.events[0].address, 'пр-т Победителей, 23');
  assert.equal(r.events[1].starts_at_local, '2026-10-21T20:00');
  assert.equal(r.events[1].venue_name, 'СОК «Олимпийский»');
  assert.equal(r.events[1].address, 'ул. Сурганова, 2а');
  for (const e of r.events) {
    assert.equal(e.sport, 'football');
    assert.equal(e.price_byn, 12);
    assert.equal(e.capacity, 14);
  }
});

test('дата словами без года', () => {
  const r = extractEvents(post('Йога на траве 24 октября в 18:30, Парк Победы. Возьмите коврик, ждём всех!'));
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].starts_at_local, '2026-10-24T18:30');
  assert.equal(r.events[0].sport, 'yoga');
});

test('«в субботу» — событие есть, но на модерацию', () => {
  const r = extractEvents(post('Стритбол 3×3 в субботу в 12:00, Парк Челюскинцев. Приходи, команды соберём на месте.'));
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].starts_at_local, '2026-10-17T12:00');
  assert.equal(r.events[0].sport, 'basketball');
  assert.equal(r.events[0].title, 'Стритбол 3×3');
  assert.equal(r.events[0].confident, false);
});

test('без времени — пропускаем', () => {
  const r = extractEvents(post('Тренировка по волейболу 20.10 в Дроздах, приходите!'));
  assert.deepEqual(r.events, []);
  assert.equal(r.reason, 'нет времени');
});

test('мотивационный пост — пропускаем', () => {
  const r = extractEvents(post('Никогда не сдавайтесь! Бег — это жизнь 🫶🏻 Garmin посчитал, что средняя пробежка — 7,8 км.'));
  assert.deepEqual(r.events, []);
});

test('отмена тренировки — не событие', () => {
  const r = extractEvents(post('☔️ Отменяем тренировки на 10:00 👇\n📍Парк Павлова — табата, здоровая спина, йога'));
  assert.deepEqual(r.events, []);
});

test('«расписание откроется в 10:00» — не событие', () => {
  const r = extractEvents(post(
    'Друзья, рады поделиться с вами расписанием тренировок. Напоминаем, что расписание появляется поэтапно:\n' +
    '🕙 10:00 — Сквер у гостиницы «Беларусь»\n🕥 10:30 — Парк Павлова\nЗаходите на сайт и записывайтесь на тренировки!',
  ));
  assert.deepEqual(r.events, []);
});

test('новость о турнире сборных — не событие', () => {
  const r = extractEvents(post(
    '🏖️ В Минске стартует Кубок дружбы по пляжному футболу. С 16 по 18 октября в центре пляжных видов спорта ' +
    'сборная Беларуси сыграет с командами Омана и Казахстана. Начало матчей в 15:00.',
  ));
  assert.deepEqual(r.events, []);
});

test('одна дата дважды — одно событие, место из шапки', () => {
  const r = extractEvents(post(
    '🐾 Наш dog-friendly проект не мог оставить вас без особенного события!\n' +
    '15 ноября мы организуем «Лохматый марафон» — забег с собаками.\n' +
    '📍 Где: Парк имени 50-летия Великого Октября\n🗓 Когда: 15 ноября, начало регистрации — 10:00\n🏃 Дистанция: 1 км\n' +
    'Как присоединиться? Заполните форму участника.',
  ));
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].venue_name, 'Парк 50-летия Великого Октября');
  assert.equal(r.events[0].starts_at_local, '2026-11-15T10:00');
});

test('приветствие и вводные слова не попадают в заголовок', () => {
  const r = extractEvents(post('🌺 Уже в это воскресенье — ALOHA DAY!\n18 октября встречаемся в парке Тивали в 14:00 — йога и аэробика, приходите!'));
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].title, 'ALOHA DAY');
  const r2 = extractEvents(post('💜 Друзья, у нас новые тренировки по мини-футболу!\n25 октября в парке Тивали в 14:00. Записывайтесь!'));
  assert.equal(r2.events[0].title, 'У нас новые тренировки по мини-футболу');
});

test('розыгрыш — не событие', () => {
  const r = extractEvents(post('Сегодня на тренировках разыграем велосипеды! В 20:30 приходите к сцене, Парк Павлова, 18.10.'));
  assert.deepEqual(r.events, []);
});

// ---------- чаты вроде «Волейбол в Минске»: тематический канал, сообщения без заголовков ----------

function chat(text: string): SourcePost {
  return { ...post(text), defaultSport: 'volleyball' };
}

test('чат: день недели, адрес без «ул.», время «20.00-22.00», уровень и цена', () => {
  const r = extractEvents(chat(
    'Новое объявление в ВК:\nВоскресенье\nФилимонова 55/1,\nкрепкий д4,д3,\n20.00-22.00.\nЕсть место в связку,\n' +
    'в ЛС. Игра 4/2. 10р. 20+\n[#alias|t.me/someone|t.me/someone]\n\nАвтор: https://vk.com/id1\nТеги: #игра',
  ));
  assert.equal(r.events.length, 1);
  const e = r.events[0];
  assert.equal(e.starts_at_local, '2026-10-18T20:00');
  assert.equal(e.duration_min, 120);
  assert.equal(e.title, 'Волейбол, Д3–Д4 — Филимонова 55/1');
  assert.equal(e.address, 'Филимонова 55/1');
  assert.equal(e.level, 'intermediate');
  assert.equal(e.price_byn, 10);
  assert.equal(e.confident, true);
  assert.ok(!e.description.includes('Автор:'));
  assert.ok(e.description.includes('t.me/someone'));
});

test('чат: «21-23:00», адрес в строке с датой, «одно место»', () => {
  const r = extractEvents(chat('Сегодня (пт 16.10) на Солтыса 187/1 есть одно место в связку,\nмикс Д4, 4/2\n21-23:00, 11р'));
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].starts_at_local, '2026-10-16T21:00');
  assert.equal(r.events[0].duration_min, 120);
  assert.equal(r.events[0].address, 'Солтыса 187/1');
  assert.equal(r.events[0].capacity, 1);
});

test('чат: «в 18-45», «с 19 до 21», «Начало 19.30»', () => {
  assert.equal(extractEvents(chat('сегодня в 18-45 есть места в атаку, Тихая 20а, бесплатно')).events[0].starts_at_local, '2026-10-16T18:45');
  const fromTo = extractEvents(chat('Сегодня на Могилевской 37 с 19 до 21 есть 4 места. Бесплатно')).events[0];
  assert.equal(fromTo.starts_at_local, '2026-10-16T19:00');
  assert.equal(fromTo.capacity, 4);
  assert.equal(extractEvents(chat('Играем сегодня на Щербакова23. Два места. Цена 10 руб. Начало 19.30')).events[0].starts_at_local, '2026-10-16T19:30');
});

test('чат: название зала рядом с адресом', () => {
  const r = extractEvents(chat('Сегодня (16.10) ФОК Атлант, Сапёров 5. 20:30-22:00\n1 место в СВЯЗКУ\nД3-Д4, 13р'));
  assert.equal(r.events[0].venue_name, 'ФОК Атлант');
  assert.equal(r.events[0].address, 'Сапёров 5');
});

test('чат: «КОМПЛЕКТ» и «ищу где поиграть» — не события', () => {
  assert.equal(extractEvents(chat('КОМПЛЕКТ\nВоскресенье, 16.00-18.00\nФилимонова 55/1\nМикс, д4, 10 руб')).reason, 'набор закрыт');
  assert.equal(extractEvents(chat('Ищу где можно сегодня поиграть, район Сухарево, д4')).reason, 'ищут игру, а не зовут');
});

test('чат: «Игра 4/2», «Есть 2 места», «с тренером 15р» — не адреса', () => {
  const r = extractEvents(chat('Суббота 17.10\n15.00\nИгровая с тренером\n15р\nЕсть 2 места. Игра 4/2'));
  assert.equal(r.reason, 'нет места');
});

test('чат: опечатка в месяце («Суббота 10.09» в октябре) — берём день недели', () => {
  const r = extractEvents(chat('Суббота 10.09\nСШ 56, Каменногорская 70\n15:00-17:00, 20р'));
  assert.equal(r.events[0].starts_at_local, '2026-10-17T15:00');
});
