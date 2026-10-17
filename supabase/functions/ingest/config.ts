// Настройки импорта — из переменных окружения. Код работает и в Edge Function (Deno.env),
// и локально в Node (process.env) — см. ingest/cli.ts.

import { SPORTS, type SportId } from './types.ts';

// deno-lint-ignore no-explicit-any
const g = globalThis as any;
function env(name: string): string | undefined {
  return g.Deno?.env.get(name) ?? g.process?.env?.[name];
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().replace(/^@/, ''))
    .filter(Boolean);
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && value !== '' && value !== undefined ? n : fallback;
}

export interface ChannelConfig {
  name: string;
  /** Тематический канал («только футбол») — посты не обязаны называть вид спорта. */
  sport?: SportId;
}

/** 'football_minsk:football, minskafisha' → [{name, sport}, {name}] */
function channels(value: string): ChannelConfig[] {
  return list(value).map((item) => {
    const [name, sport] = item.split(':').map((s) => s.trim());
    if (sport && !(SPORTS as readonly string[]).includes(sport)) {
      throw new Error(`TG_CHANNELS: неизвестный вид спорта «${sport}» у @${name}. Допустимо: ${SPORTS.join(', ')}`);
    }
    return { name, sport: sport as SportId | undefined };
  });
}

export const config = {
  supabaseUrl: env('SUPABASE_URL') ?? '',
  supabaseServiceKey: env('SUPABASE_SERVICE_ROLE_KEY') ?? '',

  /** Публичные Telegram-каналы без @, через запятую; ':sport' — для тематических каналов. */
  telegramChannels: channels(env('TG_CHANNELS') || 'sportdlyavseh_bel,olympicteamby,mst_gov_by,minskafisha'),
  /** Календари городов на probeg.org (1581 — Минск); пусто — не опрашивать. */
  probegCityIds: list(env('PROBEG_CITY_IDS') ?? '1581').map(Number).filter(Number.isFinite),

  /** Сколько страниц истории (≈20 постов) смотреть в канале за один проход. */
  pagesPerChannel: num(env('INGEST_PAGES'), 2),
  /** Посты старше этого возраста не разбираем. */
  maxPostAgeDays: num(env('INGEST_MAX_POST_AGE_DAYS'), 21),
  /** Вместимость, если в анонсе она не указана. */
  defaultCapacity: num(env('INGEST_DEFAULT_CAPACITY'), 100),
  /** 'published' — сразу в ленту, 'hidden' — сначала на модерацию в админке. */
  eventStatus: env('INGEST_EVENT_STATUS') === 'hidden' ? 'hidden' : 'published',
};
