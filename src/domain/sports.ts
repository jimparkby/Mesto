import type { Level, SportId } from './types';

export interface SportMeta {
  id: SportId;
  label: string;
  /** Только для текста (сообщение «Поделиться»); в интерфейсе — SportIcon. */
  emoji: string;
  color: string;
}

export const SPORTS: SportMeta[] = [
  { id: 'football', label: 'Футбол', emoji: '⚽', color: '#34c759' },
  { id: 'running', label: 'Бег', emoji: '🏃', color: '#ff9500' },
  { id: 'basketball', label: 'Баскетбол', emoji: '🏀', color: '#ff6a00' },
  { id: 'volleyball', label: 'Волейбол', emoji: '🏐', color: '#ffb300' },
  { id: 'tennis', label: 'Теннис', emoji: '🎾', color: '#9bc53d' },
  { id: 'yoga', label: 'Йога', emoji: '🧘', color: '#af52de' },
  { id: 'cycling', label: 'Велосипед', emoji: '🚴', color: '#007aff' },
  { id: 'workout', label: 'Воркаут', emoji: '💪', color: '#ff3b30' },
  { id: 'swimming', label: 'Плавание', emoji: '🏊', color: '#30b0c7' },
  { id: 'hockey', label: 'Хоккей', emoji: '🏒', color: '#5856d6' },
  { id: 'other', label: 'Другое', emoji: '🎯', color: '#8e8e93' },
];

const byId = new Map(SPORTS.map((s) => [s.id, s]));

export function sportMeta(id: SportId): SportMeta {
  return byId.get(id) ?? byId.get('other')!;
}

export const LEVELS: { id: Level; label: string }[] = [
  { id: 'any', label: 'Любой уровень' },
  { id: 'beginner', label: 'Новичок' },
  { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' },
];

export function levelLabel(level: Level): string {
  return LEVELS.find((l) => l.id === level)?.label ?? level;
}

/** Центр Минска — точка по умолчанию для карты и расстояний. */
export const MINSK_CENTER = { lat: 53.9023, lng: 27.5619 };
