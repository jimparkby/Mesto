import type { LatLng, SportEvent } from './types';

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1).replace('.', ',')} км`;
}

export function spotsLeft(e: SportEvent): number {
  return Math.max(0, e.capacity - e.registeredCount);
}

export function isFull(e: SportEvent): boolean {
  return spotsLeft(e) === 0;
}

export function isPast(e: SportEvent, now = new Date()): boolean {
  return new Date(e.startsAt).getTime() + e.durationMin * 60_000 < now.getTime();
}

export function formatPrice(price: number): string {
  return price > 0 ? `${price} BYN` : 'Бесплатно';
}

const dayFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Завтра';
  return dayFmt.format(d);
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function formatWhen(e: SportEvent): string {
  const start = new Date(e.startsAt);
  const end = new Date(start.getTime() + e.durationMin * 60_000);
  return `${formatDay(e.startsAt)}, ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}

export function pluralPlaces(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} место`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} места`;
  return `${n} мест`;
}
