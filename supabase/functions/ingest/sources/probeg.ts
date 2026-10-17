// Календарь забегов «ПроБЕГ» (probeg.org). Сайт структурированный, поэтому текстовые правила не нужны:
// со страницы города берём список будущих забегов, со страницы забега — время, место старта и дистанции.

import { KNOWN_PLACES } from '../places.ts';
import type { ExtractedEvent, SourcePost } from '../types.ts';

const BASE = 'https://probeg.org';
const UA = 'Mozilla/5.0 (compatible; MestoIngest/0.1; +https://github.com/jimparkby/Mesto)';

async function get(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } });
  if (!res.ok) throw new Error(`probeg.org${path}: HTTP ${res.status}`);
  return res.text();
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ProbegListItem {
  postId: string; // id забега на probeg.org
  url: string;
  date: string; // 'YYYY-MM-DD'
}

/** Будущие забеги из календаря города (например, 1581 — Минск). */
export async function listProbegCity(cityId: number): Promise<ProbegListItem[]> {
  const html = await get(`/races/city/${cityId}/`);
  const today = new Date().toISOString().slice(0, 10);
  const items = new Map<string, ProbegListItem>();
  for (const m of html.matchAll(/<a href="\/event\/(\d+)\/">(\d{2})\.(\d{2})\.(\d{4})<\/a>/g)) {
    const date = `${m[4]}-${m[3]}-${m[2]}`;
    if (date >= today) items.set(m[1], { postId: m[1], url: `${BASE}/event/${m[1]}/`, date });
  }
  return [...items.values()];
}

/** Страница забега → пост с готовым событием (или с причиной, почему события нет). */
export async function loadProbegEvent(item: ProbegListItem): Promise<SourcePost> {
  const html = await get(`/event/${item.postId}/`);
  const field = (cls: string) => text(html.match(new RegExp(`<var class="${cls}">([\\s\\S]*?)</var>`))?.[1] ?? '');

  const title = field('atc_title');
  const start = field('atc_date_start'); // '2026-11-14 11:00' или просто дата, если время неизвестно
  const end = field('atc_date_end');
  const place = text(html.match(/<p>Место старта:([\s\S]*?)<\/p>/)?.[1] ?? '');
  const distances = [...html.matchAll(/<span>([^<]*(?:км|м|марафон)[^<]*)<\/span>/g)].map((m) => text(m[1]));
  const site = html.match(/<a href="([^"]+)">Официальный сайт<\/a>/)?.[1] ?? '';
  const rules = html.match(/<a href="([^"]+)">Положение/)?.[1] ?? '';
  const series = text(html.match(/Серия забегов:\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '');

  const description = [
    distances.length ? `Дистанции: ${distances.join(', ')}.` : '',
    place ? `Старт: ${place}.` : '',
    site ? `Регистрация и подробности: ${site}` : '',
    rules ? `Положение: ${rules}` : '',
    'Стоимость участия — в положении.',
  ].filter(Boolean).join('\n');

  const post: SourcePost = {
    source: 'probeg',
    postId: item.postId,
    url: item.url,
    postedAt: null,
    text: [title, start, place, description].join('\n'),
    sourceName: series || 'ПроБЕГ',
    events: [],
  };

  const time = start.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})/);
  if (!title) return { ...post, reason: 'не удалось разобрать страницу' };
  // Время старта часто появляется ближе к забегу — тогда разберём страницу ещё раз в следующий проход.
  if (!time) return { ...post, reason: 'время старта пока не указано', retryLater: true };
  if (!place) return { ...post, reason: 'место старта пока не указано', retryLater: true };

  const endTime = end.match(/^\d{4}-\d{2}-\d{2} (\d{2}):(\d{2})/);
  const startMin = Number(time[2]) * 60 + Number(time[3]);
  const endMin = endTime ? Number(endTime[1]) * 60 + Number(endTime[2]) : null;

  // «Чижовка-Арена» → место; «велодорожка, проспект Победителей, 2» → место — вся строка (описание, а не название),
  // адрес — «проспект Победителей, 2» (по нему геокодер найдёт точку).
  const [first, ...addressParts] = place.split(/,\s*/);
  const venueName = first[0] === first[0].toLowerCase() ? place : first;
  const known = KNOWN_PLACES.find((p) => p.aliases.some((a) => place.toLowerCase().includes(a)));
  const event: ExtractedEvent = {
    title: title.slice(0, 120),
    sport: /триатлон|дуатлон|акватлон/i.test(title) ? 'other' : 'running',
    description,
    starts_at_local: `${time[1]}T${time[2]}:${time[3]}`,
    duration_min: endMin && endMin > startMin ? endMin - startMin : 180,
    venue_name: (addressParts.length && /\d/.test(addressParts.join(' ')) ? venueName : place).slice(0, 120),
    address: addressParts.length && /\d/.test(addressParts.join(' ')) ? addressParts.join(', ') : '',
    level: 'any',
    price_byn: null,
    capacity: null,
    organizer: series,
    ...(known ? { venue_name: known.name, address: known.address, lat: known.lat, lng: known.lng } : {}),
    confident: true,
  };
  return { ...post, events: [event] };
}
