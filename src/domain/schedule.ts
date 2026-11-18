import { spotsLeft } from './events';
import type { CoachSlot, SportEvent, Weekday } from './types';

/** Сколько дней вперёд открыта запись — столько же выставляет сервер (materialize_slot). */
export const BOOKING_HORIZON_DAYS = 28;

export const WEEKDAYS: { id: Weekday; short: string; label: string }[] = [
  { id: 1, short: 'Пн', label: 'Понедельник' },
  { id: 2, short: 'Вт', label: 'Вторник' },
  { id: 3, short: 'Ср', label: 'Среда' },
  { id: 4, short: 'Чт', label: 'Четверг' },
  { id: 5, short: 'Пт', label: 'Пятница' },
  { id: 6, short: 'Сб', label: 'Суббота' },
  { id: 7, short: 'Вс', label: 'Воскресенье' },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD в местном времени. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoWeekday(d: Date): Weekday {
  return (((d.getDay() + 6) % 7) + 1) as Weekday;
}

/** Ближайшие n дней начиная с сегодня. */
export function nextDays(n: number, from = new Date()): Date[] {
  return Array.from({ length: n }, (_, i) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + i));
}

export function groupByDay(events: SportEvent[]): Map<string, SportEvent[]> {
  const m = new Map<string, SportEvent[]>();
  for (const e of events) {
    const k = dayKey(new Date(e.startsAt));
    const list = m.get(k);
    if (list) list.push(e);
    else m.set(k, [e]);
  }
  for (const list of m.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return m;
}

export function addMinutes(time: string, min: number): string {
  const [h, m] = time.split(':').map(Number);
  const t = (((h * 60 + m + min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

export function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/** «Пн, Ср, Пт» или «Каждый день», «Будни», «Выходные». */
export function weekdaysLabel(days: Weekday[]): string {
  const s = [...days].sort((a, b) => a - b);
  if (s.length === 7) return 'Каждый день';
  if (s.join() === '1,2,3,4,5') return 'По будням';
  if (s.join() === '6,7') return 'По выходным';
  return s.map((d) => WEEKDAYS[d - 1].short).join(', ');
}

export function slotTimeLabel(s: Pick<CoachSlot, 'startTime' | 'durationMin'>): string {
  return `${s.startTime}–${addMinutes(s.startTime, s.durationMin)}`;
}

/** Мест для клиентов на занятии: тренер занимает одно место из capacity. */
export function clientSpots(e: SportEvent): number {
  return Math.max(0, e.capacity - 1);
}

export function clientsBooked(e: SportEvent): number {
  return Math.max(0, e.registeredCount + (e.reserved ?? 0) - 1);
}

export function freeSpotsLabel(e: SportEvent): string {
  const left = spotsLeft(e);
  if (left === 0) return 'Мест нет';
  return `Свободно ${left} из ${clientSpots(e)}`;
}

const dayTitleFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

export function dayTitle(d: Date, now = new Date()): string {
  const k = dayKey(d);
  if (k === dayKey(now)) return `Сегодня, ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (k === dayKey(tomorrow)) return `Завтра, ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
  const t = dayTitleFmt.format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
