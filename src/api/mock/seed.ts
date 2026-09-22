import type { Level, SportEvent, SportId } from '../../domain/types';

interface Venue {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const V = {
  gorky: { name: 'Парк Горького', address: 'ул. Фрунзе, 2', lat: 53.9037, lng: 27.5702 },
  pobedy: { name: 'Парк Победы', address: 'пр-т Победителей, 3', lat: 53.9146, lng: 27.5347 },
  loshitsa: { name: 'Лошицкий парк', address: 'ул. Маяковского, 191', lat: 53.8497, lng: 27.5871 },
  chizhovka: { name: 'Чижовка-Арена', address: 'ул. Уборевича, 10', lat: 53.8605, lng: 27.6413 },
  minskArena: { name: 'Минск-Арена', address: 'пр-т Победителей, 111', lat: 53.9361, lng: 27.4836 },
  dinamo: { name: 'Стадион «Динамо»', address: 'ул. Кирова, 8', lat: 53.8999, lng: 27.5608 },
  drozdy: { name: 'Дрозды', address: 'Минское море, пляж «Дрозды»', lat: 53.9585, lng: 27.4553 },
  sevastopol: { name: 'Севастопольский парк', address: 'ул. Севастопольская, 1', lat: 53.8858, lng: 27.6226 },
  chelyuskin: { name: 'Парк Челюскинцев', address: 'пр-т Независимости, 84', lat: 53.9224, lng: 27.6138 },
  tsnyanka: { name: 'Цнянское водохранилище', address: 'ул. Нововиленская, набережная', lat: 53.9721, lng: 27.5864 },
  uruchye: { name: 'ФОК «Уручье»', address: 'ул. Ложинская, 4', lat: 53.9453, lng: 27.6868 },
  kamenka: { name: 'Каменная Горка, школа №203', address: 'ул. Лобанка, 8', lat: 53.9076, lng: 27.4337 },
} satisfies Record<string, Venue>;

interface Template {
  title: string;
  sport: SportId;
  venue: Venue;
  dayOffset: number;
  hour: number;
  minute?: number;
  durationMin: number;
  level: Level;
  price: number;
  capacity: number;
  registered: number;
  organizer: string;
  description: string;
}

const TEMPLATES: Template[] = [
  {
    title: 'Утренняя пробежка 5 км',
    sport: 'running', venue: V.gorky, dayOffset: 0, hour: 7, minute: 30, durationMin: 50,
    level: 'any', price: 0, capacity: 30, registered: 12, organizer: 'Minsk Running Club',
    description: 'Спокойный темп 6:00–6:30 /км вдоль Свислочи. Сбор у колеса обозрения. Никого не бросаем!',
  },
  {
    title: 'Футбол 7×7 вечером',
    sport: 'football', venue: V.dinamo, dayOffset: 0, hour: 19, durationMin: 90,
    level: 'intermediate', price: 10, capacity: 14, registered: 11, organizer: 'Андрей К.',
    description: 'Искусственный газон, манишки есть. Нужны ещё 3 игрока в поле. Оплата на месте.',
  },
  {
    title: 'Йога на траве',
    sport: 'yoga', venue: V.pobedy, dayOffset: 0, hour: 18, minute: 30, durationMin: 60,
    level: 'beginner', price: 0, capacity: 20, registered: 8, organizer: 'Yoga Minsk',
    description: 'Хатха-йога для начинающих у Комсомольского озера. Возьмите коврик и воду.',
  },
  {
    title: 'Стритбол 3×3',
    sport: 'basketball', venue: V.chelyuskin, dayOffset: 1, hour: 18, durationMin: 120,
    level: 'any', price: 0, capacity: 12, registered: 5, organizer: 'Streetball BY',
    description: 'Играем на выбывание до 11 очков. Команды собираем на месте.',
  },
  {
    title: 'Пляжный волейбол',
    sport: 'volleyball', venue: V.drozdy, dayOffset: 1, hour: 17, durationMin: 120,
    level: 'intermediate', price: 5, capacity: 12, registered: 10, organizer: 'Beach Minsk',
    description: 'Две площадки у воды. Играем 4×4, ротация каждые 15 минут.',
  },
  {
    title: 'Велозаезд вокруг Цнянки',
    sport: 'cycling', venue: V.tsnyanka, dayOffset: 2, hour: 10, durationMin: 150,
    level: 'intermediate', price: 0, capacity: 25, registered: 9, organizer: 'Велосообщество Минска',
    description: '40 км, средняя скорость 22–25 км/ч. Шлем обязателен. Остановка на кофе.',
  },
  {
    title: 'Воркаут-тренировка',
    sport: 'workout', venue: V.sevastopol, dayOffset: 1, hour: 8, durationMin: 60,
    level: 'any', price: 0, capacity: 15, registered: 4, organizer: 'Workout Minsk',
    description: 'Круговая тренировка на турниках и брусьях, подберём нагрузку под каждого.',
  },
  {
    title: 'Любительский хоккей',
    sport: 'hockey', venue: V.chizhovka, dayOffset: 2, hour: 21, durationMin: 90,
    level: 'advanced', price: 25, capacity: 20, registered: 17, organizer: 'Хоккей после работы',
    description: 'Малая арена. Полная экипировка обязательна. Оплата льда делится поровну.',
  },
  {
    title: 'Теннис: спарринг-партнёр',
    sport: 'tennis', venue: V.minskArena, dayOffset: 3, hour: 9, durationMin: 90,
    level: 'intermediate', price: 20, capacity: 2, registered: 1, organizer: 'Ольга М.',
    description: 'Ищу партнёра уровня NTRP 3.5 на грунт. Корт забронирован.',
  },
  {
    title: 'Трейл в Лошице',
    sport: 'running', venue: V.loshitsa, dayOffset: 4, hour: 9, durationMin: 90,
    level: 'intermediate', price: 0, capacity: 25, registered: 14, organizer: 'Minsk Trail',
    description: '12 км по грунтовым тропам с набором высоты. Подойдут кроссовки с протектором.',
  },
  {
    title: 'Мини-футбол в зале',
    sport: 'football', venue: V.uruchye, dayOffset: 3, hour: 20, durationMin: 90,
    level: 'beginner', price: 8, capacity: 12, registered: 6, organizer: 'Футбол для всех',
    description: 'Игра для новичков и тех, кто давно не играл. Без жёсткого подката.',
  },
  {
    title: 'Семейная зарядка',
    sport: 'other', venue: V.kamenka, dayOffset: 5, hour: 10, durationMin: 45,
    level: 'any', price: 0, capacity: 40, registered: 7, organizer: 'Активный Фрунзенский',
    description: 'Зарядка для родителей с детьми на школьном стадионе. Подарки самым активным.',
  },
  {
    title: 'Открытая вода: заплыв',
    sport: 'swimming', venue: V.drozdy, dayOffset: 5, hour: 8, durationMin: 60,
    level: 'advanced', price: 0, capacity: 15, registered: 6, organizer: 'Open Water BY',
    description: 'Заплыв 1–2 км вдоль берега. Обязательны буй и яркая шапочка.',
  },
  {
    title: 'Йога на закате',
    sport: 'yoga', venue: V.tsnyanka, dayOffset: 6, hour: 19, durationMin: 60,
    level: 'any', price: 5, capacity: 20, registered: 3, organizer: 'Yoga Minsk',
    description: 'Мягкая практика и дыхательные упражнения у воды.',
  },
  {
    title: 'Волейбол в зале',
    sport: 'volleyball', venue: V.uruchye, dayOffset: 6, hour: 20, durationMin: 120,
    level: 'intermediate', price: 7, capacity: 14, registered: 14, organizer: 'Волейбол Уручье',
    description: 'Классика 6×6. Состав на эту игру уже собран — можно записаться в резерв в следующий раз.',
  },
];

function atLocal(dayOffset: number, hour: number, minute = 0, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, minute);
  return d.toISOString();
}

/** Генерирует демо-события относительно сегодняшней даты, чтобы демо всегда выглядело «живым». */
export function generateSeedEvents(now = new Date()): SportEvent[] {
  return TEMPLATES.map((t, i) => {
    let startsAt = atLocal(t.dayOffset, t.hour, t.minute, now);
    // Если «сегодняшнее» событие уже прошло — переносим его на неделю вперёд.
    if (new Date(startsAt).getTime() + t.durationMin * 60_000 < now.getTime()) {
      startsAt = atLocal(t.dayOffset + 7, t.hour, t.minute, now);
    }
    return {
      id: `seed-${i + 1}`,
      title: t.title,
      sport: t.sport,
      description: t.description,
      startsAt,
      durationMin: t.durationMin,
      venueName: t.venue.name,
      address: t.venue.address,
      lat: t.venue.lat,
      lng: t.venue.lng,
      level: t.level,
      price: t.price,
      capacity: t.capacity,
      registeredCount: t.registered,
      organizerId: `org-${i + 1}`,
      organizerName: t.organizer,
      status: 'published',
      createdAt: now.toISOString(),
    };
  });
}

export const DEMO_PARTICIPANT_NAMES = [
  'Алексей', 'Мария', 'Дмитрий', 'Анна', 'Иван', 'Екатерина', 'Павел', 'Ольга', 'Никита',
  'Юлия', 'Сергей', 'Дарья', 'Максим', 'Алина', 'Артём', 'Виктория', 'Кирилл', 'Полина',
];
