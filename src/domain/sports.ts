import type { Level, SportId } from './types';

export interface SportMeta {
  id: SportId;
  label: string;
  emoji: string;
  color: string;
}

export const SPORTS: SportMeta[] = [
  { id: 'football', label: 'Футбол', emoji: '⚽', color: '#16a34a' },
  { id: 'running', label: 'Бег', emoji: '🏃', color: '#f97316' },
  { id: 'basketball', label: 'Баскетбол', emoji: '🏀', color: '#ea580c' },
  { id: 'volleyball', label: 'Волейбол', emoji: '🏐', color: '#eab308' },
  { id: 'tennis', label: 'Теннис', emoji: '🎾', color: '#84cc16' },
  { id: 'yoga', label: 'Йога', emoji: '🧘', color: '#a855f7' },
  { id: 'cycling', label: 'Велосипед', emoji: '🚴', color: '#0ea5e9' },
  { id: 'workout', label: 'Воркаут', emoji: '💪', color: '#ef4444' },
  { id: 'swimming', label: 'Плавание', emoji: '🏊', color: '#06b6d4' },
  { id: 'hockey', label: 'Хоккей', emoji: '🏒', color: '#3b82f6' },
  { id: 'other', label: 'Другое', emoji: '🎯', color: '#64748b' },
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
