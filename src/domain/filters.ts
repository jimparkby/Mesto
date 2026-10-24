import { distanceKm } from './events';
import { divisionLevel, divisionTagsIn } from './levels';
import type { EventType, LatLng, Level, SportEvent, SportId } from './types';

export type DateRange = 'all' | 'today' | 'tomorrow' | 'weekend' | 'week';

/** Выбранное деление вида спорта: «Д3» в волейболе, «3.5» в теннисе. */
export interface DivisionFilter {
  sport: SportId;
  tag: string;
}

export interface EventFilters {
  query: string;
  /** Тип события: всё / только тренировки / только игры. */
  eventType: EventType | 'all';
  sports: SportId[];
  date: DateRange;
  level: Level | 'all';
  /** Деление вида спорта; задаётся вместе с level (общий уровень деления). */
  division: DivisionFilter | null;
  freeOnly: boolean;
  /** Макс. расстояние в км; учитывается только если известна геопозиция. */
  radiusKm: number | null;
}

export const DEFAULT_FILTERS: EventFilters = {
  query: '',
  eventType: 'all',
  sports: [],
  date: 'all',
  level: 'all',
  division: null,
  freeOnly: false,
  radiusKm: null,
};

export const DATE_RANGES: { id: DateRange; label: string }[] = [
  { id: 'all', label: 'Все даты' },
  { id: 'today', label: 'Сегодня' },
  { id: 'tomorrow', label: 'Завтра' },
  { id: 'weekend', label: 'Выходные' },
  { id: 'week', label: '7 дней' },
];

export const RADII = [1, 3, 5, 10];

function dayStart(d: Date, addDays = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays);
}

function inDateRange(iso: string, range: DateRange, now: Date): boolean {
  const t = new Date(iso).getTime();
  switch (range) {
    case 'all':
      return true;
    case 'today':
      return t >= dayStart(now).getTime() && t < dayStart(now, 1).getTime();
    case 'tomorrow':
      return t >= dayStart(now, 1).getTime() && t < dayStart(now, 2).getTime();
    case 'week':
      return t < dayStart(now, 7).getTime();
    case 'weekend': {
      const dow = now.getDay(); // 0 — воскресенье
      const sat = dayStart(now, dow === 0 ? -1 : 6 - dow);
      const mon = dayStart(sat, 2);
      return t >= sat.getTime() && t < mon.getTime();
    }
  }
}

export function countActiveFilters(f: EventFilters): number {
  return (
    (f.sports.length ? 1 : 0) +
    (f.eventType !== 'all' ? 1 : 0) +
    (f.date !== 'all' ? 1 : 0) +
    (f.level !== 'all' || f.division ? 1 : 0) +
    (f.freeOnly ? 1 : 0) +
    (f.radiusKm ? 1 : 0)
  );
}

export function applyFilters(
  events: SportEvent[],
  f: EventFilters,
  location: LatLng | null,
  now = new Date(),
): SportEvent[] {
  const q = f.query.trim().toLowerCase();
  return events.filter((e) => {
    if (f.eventType !== 'all' && e.eventType !== f.eventType) return false;
    if (f.sports.length && !f.sports.includes(e.sport)) return false;
    if (!inDateRange(e.startsAt, f.date, now)) return false;
    // Событие «для любого уровня» подходит под любой выбранный уровень.
    if (f.division) {
      // Деление работает только внутри своего вида спорта.
      if (e.sport !== f.division.sport) return false;
      const tags = divisionTagsIn(e.title, f.division.sport);
      if (tags.length) {
        // В заголовке есть метки дивизионов («Д3–Д4») — сверяемся с ними.
        if (!tags.includes(f.division.tag)) return false;
      } else {
        // Меток нет — откатываемся к общему уровню деления.
        const want = divisionLevel(f.division.sport, f.division.tag);
        if (e.level !== 'any' && want && e.level !== want) return false;
      }
    } else if (f.level !== 'all' && e.level !== 'any' && e.level !== f.level) return false;
    if (f.freeOnly && e.price > 0) return false;
    if (f.radiusKm && location && distanceKm(location, e) > f.radiusKm) return false;
    if (q) {
      const hay = `${e.title} ${e.venueName} ${e.address} ${e.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type SortMode = 'time' | 'distance';

export function sortEvents(events: SportEvent[], mode: SortMode, location: LatLng | null): SportEvent[] {
  const copy = [...events];
  if (mode === 'distance' && location) {
    copy.sort((a, b) => distanceKm(location, a) - distanceKm(location, b));
  } else {
    copy.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  return copy;
}
