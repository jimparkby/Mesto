import { EMPTY_RATINGS } from '../../domain/people';
import type { Community, EventType, Level, PublicProfile, SportEvent, SportId } from '../../domain/types';

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
  eventType: EventType;
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
  /** Организатор — человек из DEMO_PEOPLE (тренер или игрок с профилем). */
  organizerId?: string;
  levels?: Level[];
}

const TEMPLATES: Template[] = [
  {
    title: 'Падел: тренировка в мини-группе',
    sport: 'padel', eventType: 'training', venue: V.minskArena, dayOffset: 1, hour: 10, durationMin: 90,
    level: 'amateur', levels: ['beginner', 'amateur'], price: 45, capacity: 4, registered: 2, organizer: 'Арсений Ковалёв',
    organizerId: 'person-c1',
    description: 'Ставим удар у стенки и подачу. Ракетки и мячи дам. Корт оплачен, цена за человека.',
  },
  {
    title: 'Теннис: индивидуальное занятие',
    sport: 'tennis', eventType: 'training', venue: V.dinamo, dayOffset: 2, hour: 8, durationMin: 60,
    level: 'intermediate', levels: ['amateur', 'intermediate'], price: 60, capacity: 2, registered: 1, organizer: 'Ольга Смирнова',
    organizerId: 'person-c2',
    description: 'Разбор техники с видеосъёмкой, работа над бэкхендом. Подойдёт уровню NTRP 3.0–3.5.',
  },
  {
    title: 'Функциональный тренинг в парке',
    sport: 'functional', eventType: 'training', venue: V.gorky, dayOffset: 0, hour: 19, minute: 30, durationMin: 60,
    level: 'any', price: 15, capacity: 12, registered: 7, organizer: 'Денис Орлов',
    organizerId: 'person-c3',
    description: 'Круговая тренировка с резинками и собственным весом. Нагрузку подберу под каждого.',
  },
  {
    title: 'Падел 2×2, ищу пару',
    sport: 'padel', eventType: 'game', venue: V.minskArena, dayOffset: 1, hour: 20, durationMin: 90,
    level: 'intermediate', levels: ['intermediate', 'advanced'], price: 30, capacity: 4, registered: 2, organizer: 'Мария Власова',
    organizerId: 'person-1',
    description: 'Ищу напарника на игру. Корт оплачен. Уровень уверенный средний, играю 2 года.',
  },
  {
    title: 'Утренняя пробежка 5 км',
    sport: 'running', eventType: 'training', venue: V.gorky, dayOffset: 0, hour: 7, minute: 30, durationMin: 50,
    level: 'any', price: 0, capacity: 30, registered: 12, organizer: 'Minsk Running Club',
    description: 'Спокойный темп 6:00–6:30 /км вдоль Свислочи. Сбор у колеса обозрения. Никого не бросаем!',
  },
  {
    title: 'Футбол 7×7 вечером',
    sport: 'football', eventType: 'game', venue: V.dinamo, dayOffset: 0, hour: 19, durationMin: 90,
    level: 'intermediate', price: 10, capacity: 14, registered: 11, organizer: 'Андрей К.',
    description: 'Искусственный газон, манишки есть. Нужны ещё 3 игрока в поле. Оплата на месте.',
  },
  {
    title: 'Йога на траве',
    sport: 'yoga', eventType: 'training', venue: V.pobedy, dayOffset: 0, hour: 18, minute: 30, durationMin: 60,
    level: 'beginner', price: 0, capacity: 20, registered: 8, organizer: 'Yoga Minsk',
    description: 'Хатха-йога для начинающих у Комсомольского озера. Возьмите коврик и воду.',
  },
  {
    title: 'Стритбол 3×3',
    sport: 'basketball', eventType: 'game', venue: V.chelyuskin, dayOffset: 1, hour: 18, durationMin: 120,
    level: 'any', price: 0, capacity: 12, registered: 5, organizer: 'Streetball BY',
    description: 'Играем на выбывание до 11 очков. Команды собираем на месте.',
  },
  {
    title: 'Пляжный волейбол',
    sport: 'volleyball', eventType: 'game', venue: V.drozdy, dayOffset: 1, hour: 17, durationMin: 120,
    level: 'intermediate', price: 5, capacity: 12, registered: 10, organizer: 'Beach Minsk',
    description: 'Две площадки у воды. Играем 4×4, ротация каждые 15 минут.',
  },
  {
    title: 'Велозаезд вокруг Цнянки',
    sport: 'cycling', eventType: 'training', venue: V.tsnyanka, dayOffset: 2, hour: 10, durationMin: 150,
    level: 'intermediate', price: 0, capacity: 25, registered: 9, organizer: 'Велосообщество Минска',
    description: '40 км, средняя скорость 22–25 км/ч. Шлем обязателен. Остановка на кофе.',
  },
  {
    title: 'Воркаут-тренировка',
    sport: 'workout', eventType: 'training', venue: V.sevastopol, dayOffset: 1, hour: 8, durationMin: 60,
    level: 'any', price: 0, capacity: 15, registered: 4, organizer: 'Workout Minsk',
    description: 'Круговая тренировка на турниках и брусьях, подберём нагрузку под каждого.',
  },
  {
    title: 'Любительский хоккей',
    sport: 'hockey', eventType: 'game', venue: V.chizhovka, dayOffset: 2, hour: 21, durationMin: 90,
    level: 'advanced', price: 25, capacity: 20, registered: 17, organizer: 'Хоккей после работы',
    description: 'Малая арена. Полная экипировка обязательна. Оплата льда делится поровну.',
  },
  {
    title: 'Теннис: спарринг-партнёр',
    sport: 'tennis', eventType: 'game', venue: V.minskArena, dayOffset: 3, hour: 9, durationMin: 90,
    level: 'intermediate', price: 20, capacity: 2, registered: 1, organizer: 'Ольга М.',
    description: 'Ищу партнёра уровня NTRP 3.5 на грунт. Корт забронирован.',
  },
  {
    title: 'Трейл в Лошице',
    sport: 'running', eventType: 'training', venue: V.loshitsa, dayOffset: 4, hour: 9, durationMin: 90,
    level: 'intermediate', price: 0, capacity: 25, registered: 14, organizer: 'Minsk Trail',
    description: '12 км по грунтовым тропам с набором высоты. Подойдут кроссовки с протектором.',
  },
  {
    title: 'Мини-футбол в зале',
    sport: 'football', eventType: 'game', venue: V.uruchye, dayOffset: 3, hour: 20, durationMin: 90,
    level: 'beginner', price: 8, capacity: 12, registered: 6, organizer: 'Футбол для всех',
    description: 'Игра для новичков и тех, кто давно не играл. Без жёсткого подката.',
  },
  {
    title: 'Семейная зарядка',
    sport: 'other', eventType: 'training', venue: V.kamenka, dayOffset: 5, hour: 10, durationMin: 45,
    level: 'any', price: 0, capacity: 40, registered: 7, organizer: 'Активный Фрунзенский',
    description: 'Зарядка для родителей с детьми на школьном стадионе. Подарки самым активным.',
  },
  {
    title: 'Открытая вода: заплыв',
    sport: 'swimming', eventType: 'training', venue: V.drozdy, dayOffset: 5, hour: 8, durationMin: 60,
    level: 'advanced', price: 0, capacity: 15, registered: 6, organizer: 'Open Water BY',
    description: 'Заплыв 1–2 км вдоль берега. Обязательны буй и яркая шапочка.',
  },
  {
    title: 'Йога на закате',
    sport: 'yoga', eventType: 'training', venue: V.tsnyanka, dayOffset: 6, hour: 19, durationMin: 60,
    level: 'any', price: 5, capacity: 20, registered: 3, organizer: 'Yoga Minsk',
    description: 'Мягкая практика и дыхательные упражнения у воды.',
  },
  {
    title: 'Волейбол в зале',
    sport: 'volleyball', eventType: 'game', venue: V.uruchye, dayOffset: 6, hour: 20, durationMin: 120,
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
    const person = t.organizerId ? DEMO_PEOPLE.find((p) => p.id === t.organizerId) : undefined;
    return {
      id: `seed-${i + 1}`,
      title: t.title,
      sport: t.sport,
      eventType: t.eventType,
      description: t.description,
      startsAt,
      durationMin: t.durationMin,
      venueName: t.venue.name,
      address: t.venue.address,
      city: 'Минск',
      lat: t.venue.lat,
      lng: t.venue.lng,
      level: t.level,
      levels: t.levels ?? (t.level !== 'any' ? [t.level] : []),
      price: t.price,
      capacity: t.capacity,
      reserved: 0,
      registeredCount: t.registered,
      organizerId: person?.id ?? `org-${i + 1}`,
      organizerName: t.organizer,
      organizerUsername: person?.username ?? null,
      organizerPhotoUrl: person?.photoUrl ?? null,
      organizerIsCoach: person?.isCoach ?? false,
      organizerPremium: person?.premium ?? false,
      organizerRating: person ? overall(person) : 4.5 + ((i * 7) % 6) / 10,
      status: 'published',
      createdAt: now.toISOString(),
    };
  });
}

function overall(p: PublicProfile): number | null {
  const xs = [p.ratings.vibe, p.ratings.levelFit, p.ratings.effectiveness].filter((x): x is number => x !== null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

type DemoPerson = Pick<PublicProfile, 'id' | 'name' | 'gender' | 'birthDate' | 'bio' | 'skills' | 'languages'> &
  Partial<PublicProfile> & { vibe?: number; fit?: number; eff?: number; votes?: number };

function person(p: DemoPerson): PublicProfile {
  const isCoach = p.isCoach ?? false;
  return {
    isCoach,
    username: null,
    photoUrl: null,
    city: 'Минск',
    photos: [],
    videos: [],
    onboarded: true,
    premium: false,
    lastSeenAt: new Date(Date.now() - (p.id.length % 3) * 40 * 60_000).toISOString(),
    createdAt: new Date(Date.now() - p.id.length * 86_400_000).toISOString(),
    ...p,
    ratings: p.votes
      ? { vibe: p.vibe ?? null, levelFit: p.fit ?? null, effectiveness: p.eff ?? null, count: p.votes }
      : EMPTY_RATINGS,
  };
}

/** Выдуманные люди для поиска в демо-режиме. */
export const DEMO_PEOPLE: PublicProfile[] = [
  person({
    id: 'person-1', name: 'Мария Власова', gender: 'female', birthDate: '2000-04-12', premium: true,
    bio: 'Играю в падел второй год. Ищу компанию на вечерние игры :)', languages: ['Русский', 'English'],
    skills: [{ sport: 'padel', level: 'intermediate' }, { sport: 'tennis', level: 'amateur' }],
    vibe: 5, fit: 4.8, votes: 14,
  }),
  person({
    id: 'person-2', name: 'Алексей Мартынов', gender: 'male', birthDate: '1994-09-03',
    bio: 'Футбол по выходным, теннис по будням. Могу собрать команду 7×7.', languages: ['Русский'],
    skills: [{ sport: 'football', level: 'advanced' }, { sport: 'tennis', level: 'intermediate' }],
    vibe: 4.9, fit: 4.7, votes: 22,
  }),
  person({
    id: 'person-3', name: 'Иван Кучеренко', gender: 'male', birthDate: '1998-01-20',
    bio: 'Падел и сквош. Ищу партнёров уровня выше среднего.', languages: ['Русский', 'Беларуская'],
    skills: [{ sport: 'padel', level: 'advanced' }, { sport: 'squash', level: 'intermediate' }],
    vibe: 4.8, fit: 4.6, votes: 9,
  }),
  person({
    id: 'person-4', name: 'Дарья Ковальчук', gender: 'female', birthDate: '1996-07-30',
    bio: 'Бегаю полумарафоны, по выходным — велопрогулки вокруг Минского моря.', languages: ['Русский', 'English', 'Polski'],
    skills: [{ sport: 'running', level: 'advanced' }, { sport: 'cycling', level: 'intermediate' }],
    vibe: 5, fit: 5, votes: 6,
  }),
  person({
    id: 'person-5', name: 'Никита Жуков', gender: 'male', birthDate: '2002-11-02',
    bio: 'Волейбол Д3–Д4, связующий. Пляжка летом.', languages: ['Русский'],
    skills: [{ sport: 'volleyball', level: 'intermediate' }, { sport: 'beach_volleyball', level: 'amateur' }],
  }),
  person({
    id: 'person-6', name: 'Алина Сидорович', gender: 'female', birthDate: '1999-03-15',
    bio: 'Начинаю в бадминтоне, ищу таких же новичков без давления :)', languages: ['Русский', 'Беларуская'],
    skills: [{ sport: 'badminton', level: 'beginner' }, { sport: 'yoga', level: 'amateur' }],
    vibe: 4.7, fit: 4.9, votes: 3,
  }),
  person({
    id: 'person-c1', name: 'Арсений Ковалёв', gender: 'male', birthDate: '1990-05-08', isCoach: true, premium: true,
    bio: 'Опыт игры — 8 лет, обучаю 3 года. Серебряный призёр чемпионата страны по паделу.', languages: ['Русский', 'English', 'Polski'],
    skills: [{ sport: 'padel', level: 'pro', years: 3, price: 45 }],
    vibe: 5, eff: 5, votes: 31,
  }),
  person({
    id: 'person-c2', name: 'Ольга Смирнова', gender: 'female', birthDate: '1988-12-01', isCoach: true,
    bio: 'КМС по теннису. Ставлю технику с нуля, готовлю к любительским турнирам.', languages: ['Русский', 'English'],
    skills: [{ sport: 'tennis', level: 'pro', years: 7, price: 60 }],
    vibe: 4.9, eff: 4.9, votes: 18,
  }),
  person({
    id: 'person-c3', name: 'Денис Орлов', gender: 'male', birthDate: '1993-02-17', isCoach: true,
    bio: 'Функциональный тренинг и ОФП для игровых видов спорта. Тренирую в парках и на площадках.', languages: ['Русский'],
    skills: [{ sport: 'functional', level: 'pro', years: 5, price: 15 }, { sport: 'workout', level: 'advanced', years: 5, price: 15 }],
    vibe: 4.8, eff: 4.7, votes: 12,
  }),
  person({
    id: 'person-c4', name: 'Олег Петренко', gender: 'male', birthDate: '1985-06-22', isCoach: true,
    bio: 'Тренер по футболу, работаю с взрослыми любителями и командами корпоративных лиг.', languages: ['Русский', 'Українська'],
    skills: [{ sport: 'football', level: 'pro', years: 7, price: 40 }],
    vibe: 4.9, eff: 4.8, votes: 25,
  }),
];

/** Демо-комьюнити. Ссылок на настоящие чаты нет — в демо кнопка чата только показывает подсказку. */
export const DEMO_COMMUNITIES: Community[] = [
  { id: 'com-1', title: 'Минский падел — общий сбор', description: 'Собираем игры на неделю, ищем пары и корты.', sport: 'padel', city: 'Минск', level: 'any', tgLink: '', createdBy: 'person-c1', membersCount: 169, createdAt: new Date().toISOString() },
  { id: 'com-2', title: 'Падел высокого уровня', description: 'Только Advanced и Pro: спарринги и турниры.', sport: 'padel', city: 'Минск', level: 'pro', tgLink: '', createdBy: 'person-3', membersCount: 53, createdAt: new Date().toISOString() },
  { id: 'com-3', title: 'Футбол по выходным', description: 'Мини-футбол и 7×7, собираем составы на субботу и воскресенье.', sport: 'football', city: 'Минск', level: 'amateur', tgLink: '', createdBy: 'person-2', membersCount: 214, createdAt: new Date().toISOString() },
  { id: 'com-4', title: 'Велопокатушки вокруг Минского моря', description: 'Спокойные заезды по 30–60 км, все уровни.', sport: 'cycling', city: 'Минск', level: 'any', tgLink: '', createdBy: 'person-4', membersCount: 88, createdAt: new Date().toISOString() },
  { id: 'com-5', title: 'Волейбол Д3–Д5', description: 'Залы и пляж, игры для средних и начинающих.', sport: 'volleyball', city: 'Минск', level: 'intermediate', tgLink: '', createdBy: 'person-5', membersCount: 121, createdAt: new Date().toISOString() },
  { id: 'com-6', title: 'Бег в Бресте', description: 'Утренние пробежки вдоль Мухавца.', sport: 'running', city: 'Брест', level: 'any', tgLink: '', createdBy: null, membersCount: 37, createdAt: new Date().toISOString() },
];

export const DEMO_PARTICIPANT_NAMES = [
  'Алексей', 'Мария', 'Дмитрий', 'Анна', 'Иван', 'Екатерина', 'Павел', 'Ольга', 'Никита',
  'Юлия', 'Сергей', 'Дарья', 'Максим', 'Алина', 'Артём', 'Виктория', 'Кирилл', 'Полина',
];
