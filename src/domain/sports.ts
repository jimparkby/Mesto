import {
  Barbell,
  Baseball,
  Basketball,
  Boat,
  BowlingBall,
  BoxingGlove,
  Car,
  Compass,
  CourtBasketball,
  Disc,
  Football,
  GameController,
  Golf,
  HandFist,
  Handshake,
  Hockey,
  Horse,
  Lightning,
  Medal,
  Mountains,
  MusicNotes,
  PersonArmsSpread,
  PersonSimpleBike,
  PersonSimpleHike,
  PersonSimpleRun,
  PersonSimpleSki,
  PersonSimpleSnowboard,
  PersonSimpleTaiChi,
  PersonSimpleThrow,
  PersonSimpleWalk,
  PingPong,
  Racquet,
  Sailboat,
  SneakerMove,
  Snowflake,
  SoccerBall,
  SpinnerBall,
  Strategy,
  SwimmingPool,
  Sword,
  Target,
  Volleyball,
  Waves,
  Wind,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import type { EventType, Level, SportId } from './types';

export type SportGroup = 'ball' | 'racket' | 'endurance' | 'water' | 'winter' | 'fitness' | 'combat' | 'other';

export interface SportMeta {
  id: SportId;
  label: string;
  /** Только для текста (сообщение «Поделиться», бот); в интерфейсе — SportIcon. */
  emoji: string;
  color: string;
  group: SportGroup;
  /** Глиф Phosphor для видов спорта без собственной пиктограммы в sportPaths. */
  glyph?: PhosphorIcon;
}

export const SPORT_GROUPS: { id: SportGroup; label: string }[] = [
  { id: 'ball', label: 'Игры с мячом' },
  { id: 'racket', label: 'Ракетки' },
  { id: 'endurance', label: 'Бег, вело, туризм' },
  { id: 'water', label: 'На воде' },
  { id: 'winter', label: 'Зимние и роллер' },
  { id: 'fitness', label: 'Фитнес и гимнастика' },
  { id: 'combat', label: 'Единоборства' },
  { id: 'other', label: 'Другое' },
];

const C = {
  ball: '#34c759',
  racket: '#9bc53d',
  endurance: '#ff9500',
  water: '#30b0c7',
  winter: '#5ac8fa',
  fitness: '#af52de',
  combat: '#ff3b30',
  other: '#8e8e93',
};

/**
 * Каталог видов спорта. Первые одиннадцать — исторические (под них есть пиктограммы в sportPaths
 * и шкалы уровней в levels.ts); остальные рисуются глифами Phosphor и используют общую шкалу.
 * id хранится в БД — не переименовывать.
 */
export const SPORTS: SportMeta[] = [
  { id: 'football', label: 'Футбол', emoji: '⚽', color: '#34c759', group: 'ball' },
  { id: 'running', label: 'Бег', emoji: '🏃', color: '#ff9500', group: 'endurance' },
  { id: 'basketball', label: 'Баскетбол', emoji: '🏀', color: '#ff6a00', group: 'ball' },
  { id: 'volleyball', label: 'Волейбол', emoji: '🏐', color: '#ffb300', group: 'ball' },
  { id: 'tennis', label: 'Теннис', emoji: '🎾', color: '#9bc53d', group: 'racket' },
  { id: 'yoga', label: 'Йога', emoji: '🧘', color: '#af52de', group: 'fitness' },
  { id: 'cycling', label: 'Велосипед', emoji: '🚴', color: '#007aff', group: 'endurance' },
  { id: 'workout', label: 'Воркаут', emoji: '💪', color: '#ff3b30', group: 'fitness' },
  { id: 'swimming', label: 'Плавание', emoji: '🏊', color: '#30b0c7', group: 'water' },
  { id: 'hockey', label: 'Хоккей', emoji: '🏒', color: '#5856d6', group: 'winter' },

  // Игры с мячом
  { id: 'futsal', label: 'Мини-футбол', emoji: '⚽', color: C.ball, group: 'ball', glyph: SoccerBall },
  { id: 'beach_soccer', label: 'Пляжный футбол', emoji: '⚽', color: C.ball, group: 'ball', glyph: SoccerBall },
  { id: 'streetball', label: 'Стритбол 3×3', emoji: '🏀', color: '#ff6a00', group: 'ball', glyph: CourtBasketball },
  { id: 'beach_volleyball', label: 'Пляжный волейбол', emoji: '🏐', color: '#ffb300', group: 'ball', glyph: Volleyball },
  { id: 'handball', label: 'Гандбол', emoji: '🤾', color: C.ball, group: 'ball', glyph: PersonSimpleThrow },
  { id: 'floorball', label: 'Флорбол', emoji: '🏑', color: C.ball, group: 'ball', glyph: Hockey },
  { id: 'rugby', label: 'Регби', emoji: '🏉', color: C.ball, group: 'ball', glyph: Football },
  { id: 'american_football', label: 'Американский футбол', emoji: '🏈', color: C.ball, group: 'ball', glyph: Football },
  { id: 'baseball', label: 'Бейсбол', emoji: '⚾', color: C.ball, group: 'ball', glyph: Baseball },
  { id: 'frisbee', label: 'Алтимат фрисби', emoji: '🥏', color: C.ball, group: 'ball', glyph: Disc },
  { id: 'water_polo', label: 'Водное поло', emoji: '🤽', color: C.water, group: 'water', glyph: SwimmingPool },
  { id: 'netball', label: 'Нетбол', emoji: '🏀', color: '#ff6a00', group: 'ball', glyph: Basketball },

  // Ракетки
  { id: 'padel', label: 'Падел', emoji: '🎾', color: C.racket, group: 'racket', glyph: Racquet },
  { id: 'squash', label: 'Сквош', emoji: '🎾', color: C.racket, group: 'racket', glyph: Racquet },
  { id: 'badminton', label: 'Бадминтон', emoji: '🏸', color: C.racket, group: 'racket', glyph: Racquet },
  { id: 'table_tennis', label: 'Настольный теннис', emoji: '🏓', color: C.racket, group: 'racket', glyph: PingPong },
  { id: 'pickleball', label: 'Пиклбол', emoji: '🏓', color: C.racket, group: 'racket', glyph: PingPong },
  { id: 'beach_tennis', label: 'Пляжный теннис', emoji: '🎾', color: C.racket, group: 'racket', glyph: Racquet },

  // Бег, вело, туризм
  { id: 'trail_running', label: 'Трейлраннинг', emoji: '🏃', color: C.endurance, group: 'endurance', glyph: PersonSimpleRun },
  { id: 'nordic_walking', label: 'Скандинавская ходьба', emoji: '🚶', color: C.endurance, group: 'endurance', glyph: PersonSimpleWalk },
  { id: 'walking', label: 'Прогулки', emoji: '🚶', color: C.endurance, group: 'endurance', glyph: PersonSimpleWalk },
  { id: 'hiking', label: 'Походы', emoji: '🥾', color: C.endurance, group: 'endurance', glyph: PersonSimpleHike },
  { id: 'mtb', label: 'Маунтинбайк', emoji: '🚵', color: '#007aff', group: 'endurance', glyph: PersonSimpleBike },
  { id: 'road_cycling', label: 'Шоссейный велоспорт', emoji: '🚴', color: '#007aff', group: 'endurance', glyph: PersonSimpleBike },
  { id: 'triathlon', label: 'Триатлон', emoji: '🏅', color: C.endurance, group: 'endurance', glyph: Medal },
  { id: 'orienteering', label: 'Ориентирование', emoji: '🧭', color: C.endurance, group: 'endurance', glyph: Compass },
  { id: 'climbing', label: 'Скалолазание', emoji: '🧗', color: C.endurance, group: 'endurance', glyph: Mountains },
  { id: 'bouldering', label: 'Боулдеринг', emoji: '🧗', color: C.endurance, group: 'endurance', glyph: Mountains },
  { id: 'parkour', label: 'Паркур', emoji: '🤸', color: C.endurance, group: 'endurance', glyph: PersonSimpleRun },

  // На воде
  { id: 'open_water', label: 'Открытая вода', emoji: '🌊', color: C.water, group: 'water', glyph: Waves },
  { id: 'rowing', label: 'Гребля', emoji: '🚣', color: C.water, group: 'water', glyph: Boat },
  { id: 'kayaking', label: 'Каякинг', emoji: '🛶', color: C.water, group: 'water', glyph: Boat },
  { id: 'sup', label: 'SUP-бординг', emoji: '🏄', color: C.water, group: 'water', glyph: Waves },
  { id: 'sailing', label: 'Парусный спорт', emoji: '⛵', color: C.water, group: 'water', glyph: Sailboat },
  { id: 'wakeboarding', label: 'Вейкбординг', emoji: '🏄', color: C.water, group: 'water', glyph: Waves },
  { id: 'kitesurfing', label: 'Кайтсёрфинг', emoji: '🪁', color: C.water, group: 'water', glyph: Wind },
  { id: 'diving', label: 'Дайвинг', emoji: '🤿', color: C.water, group: 'water', glyph: Waves },

  // Зимние и роллер
  { id: 'cross_country_skiing', label: 'Беговые лыжи', emoji: '⛷️', color: C.winter, group: 'winter', glyph: PersonSimpleSki },
  { id: 'alpine_skiing', label: 'Горные лыжи', emoji: '⛷️', color: C.winter, group: 'winter', glyph: PersonSimpleSki },
  { id: 'snowboard', label: 'Сноуборд', emoji: '🏂', color: C.winter, group: 'winter', glyph: PersonSimpleSnowboard },
  { id: 'skating', label: 'Коньки', emoji: '⛸️', color: C.winter, group: 'winter', glyph: Snowflake },
  { id: 'figure_skating', label: 'Фигурное катание', emoji: '⛸️', color: C.winter, group: 'winter', glyph: Snowflake },
  { id: 'curling', label: 'Кёрлинг', emoji: '🥌', color: C.winter, group: 'winter', glyph: Snowflake },
  { id: 'roller_skating', label: 'Ролики', emoji: '🛼', color: C.winter, group: 'winter', glyph: SneakerMove },
  { id: 'skateboarding', label: 'Скейтбординг', emoji: '🛹', color: C.winter, group: 'winter', glyph: SneakerMove },

  // Фитнес и гимнастика
  { id: 'gym', label: 'Тренажёрный зал', emoji: '🏋️', color: C.fitness, group: 'fitness', glyph: Barbell },
  { id: 'crossfit', label: 'Кроссфит', emoji: '🏋️', color: C.fitness, group: 'fitness', glyph: Barbell },
  { id: 'powerlifting', label: 'Пауэрлифтинг', emoji: '🏋️', color: C.fitness, group: 'fitness', glyph: Barbell },
  { id: 'functional', label: 'Функциональный тренинг', emoji: '⚡', color: C.fitness, group: 'fitness', glyph: Lightning },
  { id: 'pilates', label: 'Пилатес', emoji: '🧘', color: C.fitness, group: 'fitness', glyph: PersonSimpleTaiChi },
  { id: 'stretching', label: 'Стретчинг', emoji: '🤸', color: C.fitness, group: 'fitness', glyph: PersonArmsSpread },
  { id: 'dance', label: 'Танцы', emoji: '💃', color: C.fitness, group: 'fitness', glyph: MusicNotes },
  { id: 'gymnastics', label: 'Гимнастика', emoji: '🤸', color: C.fitness, group: 'fitness', glyph: PersonArmsSpread },
  { id: 'trampoline', label: 'Батут', emoji: '🤸', color: C.fitness, group: 'fitness', glyph: PersonArmsSpread },
  { id: 'qigong', label: 'Цигун и тайцзи', emoji: '🧘', color: C.fitness, group: 'fitness', glyph: PersonSimpleTaiChi },

  // Единоборства
  { id: 'boxing', label: 'Бокс', emoji: '🥊', color: C.combat, group: 'combat', glyph: BoxingGlove },
  { id: 'kickboxing', label: 'Кикбоксинг', emoji: '🥊', color: C.combat, group: 'combat', glyph: BoxingGlove },
  { id: 'muay_thai', label: 'Тайский бокс', emoji: '🥊', color: C.combat, group: 'combat', glyph: BoxingGlove },
  { id: 'mma', label: 'ММА', emoji: '🥋', color: C.combat, group: 'combat', glyph: HandFist },
  { id: 'judo', label: 'Дзюдо', emoji: '🥋', color: C.combat, group: 'combat', glyph: Handshake },
  { id: 'bjj', label: 'Джиу-джитсу', emoji: '🥋', color: C.combat, group: 'combat', glyph: Handshake },
  { id: 'wrestling', label: 'Борьба', emoji: '🤼', color: C.combat, group: 'combat', glyph: Handshake },
  { id: 'sambo', label: 'Самбо', emoji: '🥋', color: C.combat, group: 'combat', glyph: Handshake },
  { id: 'karate', label: 'Карате', emoji: '🥋', color: C.combat, group: 'combat', glyph: HandFist },
  { id: 'taekwondo', label: 'Тхэквондо', emoji: '🥋', color: C.combat, group: 'combat', glyph: HandFist },
  { id: 'fencing', label: 'Фехтование', emoji: '🤺', color: C.combat, group: 'combat', glyph: Sword },

  // Другое
  { id: 'golf', label: 'Гольф', emoji: '⛳', color: C.other, group: 'other', glyph: Golf },
  { id: 'bowling', label: 'Боулинг', emoji: '🎳', color: C.other, group: 'other', glyph: BowlingBall },
  { id: 'billiards', label: 'Бильярд', emoji: '🎱', color: C.other, group: 'other', glyph: SpinnerBall },
  { id: 'darts', label: 'Дартс', emoji: '🎯', color: C.other, group: 'other', glyph: Target },
  { id: 'archery', label: 'Стрельба из лука', emoji: '🏹', color: C.other, group: 'other', glyph: Target },
  { id: 'paintball', label: 'Пейнтбол', emoji: '🎯', color: C.other, group: 'other', glyph: Target },
  { id: 'chess', label: 'Шахматы', emoji: '♟️', color: C.other, group: 'other', glyph: Strategy },
  { id: 'horse_riding', label: 'Конный спорт', emoji: '🏇', color: C.other, group: 'other', glyph: Horse },
  { id: 'karting', label: 'Картинг', emoji: '🏎️', color: C.other, group: 'other', glyph: Car },
  { id: 'esports', label: 'Киберспорт', emoji: '🎮', color: C.other, group: 'other', glyph: GameController },
  { id: 'other', label: 'Другое', emoji: '🎯', color: '#8e8e93', group: 'other' },
];

const byId = new Map(SPORTS.map((s) => [s.id, s]));

export function sportMeta(id: SportId): SportMeta {
  return byId.get(id) ?? byId.get('other')!;
}

export function isKnownSport(id: string): boolean {
  return byId.has(id);
}

/** Самые частые виды спорта — их показываем первыми в чипах и выборе. */
export const POPULAR_SPORTS: SportId[] = [
  'football',
  'volleyball',
  'basketball',
  'tennis',
  'padel',
  'running',
  'cycling',
  'table_tennis',
  'badminton',
  'swimming',
  'yoga',
  'workout',
  'gym',
  'hockey',
  'boxing',
  'squash',
];

/**
 * Шкала уровней как у спортивного паспорта: Novice → Pro.
 * 'any' — «не важно / любой» (у события) или «не указан» (у человека).
 */
export const LEVELS: { id: Level; label: string; short: string }[] = [
  { id: 'any', label: 'Любой уровень', short: 'Любой' },
  { id: 'beginner', label: 'Новичок', short: 'Novice' },
  { id: 'amateur', label: 'Любитель', short: 'Amateur' },
  { id: 'intermediate', label: 'Средний', short: 'Intermediate' },
  { id: 'advanced', label: 'Продвинутый', short: 'Advanced' },
  { id: 'pro', label: 'Профи', short: 'Pro' },
];

export const SKILL_LEVELS = LEVELS.filter((l) => l.id !== 'any');

export const EVENT_TYPES: { id: EventType; label: string; plural: string }[] = [
  { id: 'training', label: 'Тренировка', plural: 'Тренировки' },
  { id: 'game', label: 'Игра', plural: 'Игры' },
];

export function eventTypeLabel(t: EventType): string {
  return EVENT_TYPES.find((x) => x.id === t)?.label ?? t;
}

export function levelLabel(level: Level): string {
  return LEVELS.find((l) => l.id === level)?.label ?? level;
}

/** Порядковый номер уровня — для сортировки и «от … до …». */
export function levelRank(level: Level): number {
  return Math.max(0, LEVELS.findIndex((l) => l.id === level));
}

/** «Средний, Профи» / «Любой уровень» — подпись набора уровней события. */
export function levelsLabel(levels: Level[]): string {
  const real = levels.filter((l) => l !== 'any').sort((a, b) => levelRank(a) - levelRank(b));
  if (real.length === 0) return 'Любой уровень';
  return real.map(levelLabel).join(', ');
}

/** Центр Минска — точка по умолчанию для карты и расстояний. */
export const MINSK_CENTER = { lat: 53.9023, lng: 27.5619 };
