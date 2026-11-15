import type { LatLng } from './types';

// Адрес ↔ точка на карте для формы создания события. Nominatim (OpenStreetMap) из браузера:
// бесплатно, без ключа; запросы редкие (по кнопке/после ввода), так что лимит 1 запрос/с не мешает.
// https://operations.osmfoundation.org/policies/nominatim/

const BASE = 'https://nominatim.openstreetmap.org';
// Минск с окрестностями: left,top,right,bottom
const MINSK_VIEWBOX = '27.30,54.05,27.80,53.78';

/** Насколько точка и адрес могут расходиться, чтобы считаться одним местом. */
export const SAME_PLACE_M = 400;

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: Record<string, string>;
}

function hasCity(q: string): boolean {
  return /минск|minsk|район|обл|деревн|аг\.|д\.\s/i.test(q);
}

/** Адрес → координаты. null — такого адреса не нашли. */
export async function geocodeAddress(address: string, signal?: AbortSignal): Promise<LatLng | null> {
  const q = hasCity(address) ? address : `${address}, Минск`;
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'by',
    viewbox: MINSK_VIEWBOX,
    'accept-language': 'ru',
  });
  const res = await fetch(`${BASE}/search?${params}`, { signal });
  if (!res.ok) throw new Error('Не удалось найти адрес. Проверьте интернет.');
  const [hit] = (await res.json()) as NominatimHit[];
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
}

/** Координаты → короткий адрес «улица, дом» (или название места). */
export async function reverseGeocode(p: LatLng, signal?: AbortSignal): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(p.lat),
    lon: String(p.lng),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'ru',
  });
  const res = await fetch(`${BASE}/reverse?${params}`, { signal });
  if (!res.ok) return null;
  const hit = (await res.json()) as NominatimHit & { error?: string };
  if (hit.error) return null;
  const a = hit.address ?? {};
  const street = a.road ?? a.pedestrian ?? a.footway ?? a.path ?? a.square;
  const short = street ? [street, a.house_number].filter(Boolean).join(', ') : hit.name || a.park || a.leisure;
  return short || hit.display_name?.split(',').slice(0, 2).join(',').trim() || null;
}
