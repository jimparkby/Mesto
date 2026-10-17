// Место из анонса → координаты. Nominatim (OpenStreetMap): бесплатно, но не чаще 1 запроса в секунду
// и с честным User-Agent — https://operations.osmfoundation.org/policies/nominatim/
//
// Как ходить в Nominatim, решает точка входа:
//  - локально (ingest/cli.ts) — напрямую, nominatimSearch;
//  - в Edge Function — через базу (dbSearch): IP Edge Functions Nominatim отвечает 403, а запросы из Postgres
//    через pg_net проходят. Ответ приходит асинхронно, поэтому первый вызов вернёт 'pending', а событие
//    добавится в следующем проходе.

import type { Db } from './store.ts';

export type GeoPoint = { lat: number; lng: number };
/** null — такого места нет; 'pending' — запрос отправлен, ответ будет позже. */
export type GeoResult = GeoPoint | null | 'pending';
export type Params = Record<string, string>;
export type GeoSearch = (params: Params) => Promise<GeoResult>;

const UA = 'MestoIngest/0.1 (+https://github.com/jimparkby/Mesto)';
// Минск с окрестностями: left,top,right,bottom
const MINSK_VIEWBOX = '27.30,54.05,27.80,53.78';

/** Полный набор параметров запроса к /search. */
export function nominatimParams(params: Params): Params {
  return {
    ...params,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'by',
    // Для структурного запроса город уже задан, а viewbox+bounded там ломает поиск дома (проверено).
    ...(params.q ? { viewbox: MINSK_VIEWBOX, bounded: '1' } : {}),
    'accept-language': 'ru',
  };
}

const cache = new Map<string, GeoPoint | null>();
let lastRequestAt = 0;

export const nominatimSearch: GeoSearch = async (params) => {
  const key = JSON.stringify(params).toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const wait = lastRequestAt + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams(nominatimParams(params)).toString();
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Nominatim: HTTP ${res.status}`);
  const [hit] = (await res.json()) as { lat: string; lon: string }[];
  const point = hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  cache.set(key, point);
  return point;
};

/** Геокодирование через public.geocode_lookup (кэш в таблице geocode_cache + запрос через pg_net). */
export function dbSearch(sb: NonNullable<Db>): GeoSearch {
  return async (params) => {
    const { data, error } = await sb.rpc('geocode_lookup', {
      p_key: JSON.stringify(params).toLowerCase(),
      p_params: nominatimParams(params),
    });
    if (error) throw error;
    const r = data as { status: string; lat?: number; lng?: number };
    if (r.status === 'found') return { lat: r.lat!, lng: r.lng! };
    if (r.status === 'not_found') return null;
    return 'pending';
  };
}

/** Пробуем от точного к общему: адрес, затем название места. */
export async function geocode(venueName: string, address: string, search: GeoSearch = nominatimSearch): Promise<GeoResult> {
  // «проспект Победителей, 2» свободным текстом Nominatim путает с «Победителей, 98/2» — структурный запрос точнее.
  const house = address.match(/^(.+?),?\s+(?:д\.\s*)?(\d+[а-яА-Я]?(?:\/\d+)?)$/);
  const queries: Params[] = [
    ...(house ? [{ street: `${house[2]} ${house[1]}`, city: 'Минск' }] : []),
    ...(address ? [{ q: `${address}, Минск` }] : []),
    ...(venueName ? [{ q: `${venueName}, Минск` }, { q: venueName }] : []),
  ];
  for (const params of queries) {
    const point = await search(params);
    if (point) return point; // координаты или 'pending' — дальше не идём
  }
  return null;
}
