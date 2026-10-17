// Один проход импорта: обойти источники (Telegram-каналы, календарь ПроБЕГ), в новых постах найти события
// (правила в extract.ts), геокодировать и добавить в ленту. Вызывается из Edge Function (index.ts)
// по расписанию pg_cron и локально из ingest/cli.ts.

import { config, type ChannelConfig } from './config.ts';
import { extractEvents } from './extract.ts';
import { geocode, type GeoSearch } from './geocode.ts';
import { listProbegCity, loadProbegEvent } from './sources/probeg.ts';
import { fetchTelegramChannel } from './sources/telegram.ts';
import type { EventRow, Store } from './store.ts';
import type { ExtractedEvent, SourcePost } from './types.ts';

const MINSK_OFFSET = '+03:00'; // в Беларуси нет перехода на летнее время

export interface RunOptions {
  /** Печатать разбор каждого поста (для dry run). */
  verbose?: boolean;
  /** Как геокодировать (по умолчанию — напрямую в Nominatim). */
  geoSearch?: GeoSearch;
}

/** Координаты ещё не пришли (геокодер через pg_net) — пост разберём в следующий проход. */
const PENDING = Symbol('pending');

export interface RunSummary {
  inserted: number;
  errors: number;
  log: string[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Распознанное событие → строка public.events, либо строка с причиной, почему не годится. */
async function toRow(post: SourcePost, e: ExtractedEvent, index: number, geoSearch?: GeoSearch): Promise<EventRow | string | typeof PENDING> {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e.starts_at_local)) return `непонятная дата «${e.starts_at_local}»`;
  const startsAt = new Date(`${e.starts_at_local}:00${MINSK_OFFSET}`);
  if (Number.isNaN(startsAt.getTime())) return `непонятная дата «${e.starts_at_local}»`;
  if (startsAt.getTime() < Date.now()) return `уже прошло (${e.starts_at_local})`;

  const point = e.lat !== undefined && e.lng !== undefined ? { lat: e.lat, lng: e.lng } : await geocode(e.venue_name, e.address, geoSearch);
  if (point === 'pending') return PENDING;
  if (!point) return `не нашли на карте «${e.venue_name}${e.address ? `, ${e.address}` : ''}»`;

  const title = e.title.trim().slice(0, 120);
  if (title.length < 3) return 'нет названия';

  return {
    title,
    sport: e.sport,
    description: e.description.trim(),
    starts_at: startsAt.toISOString(),
    duration_min: clamp(e.duration_min ?? 90, 15, 720),
    venue_name: e.venue_name.trim() || 'Минск',
    address: e.address.trim(),
    lat: point.lat,
    lng: point.lng,
    level: e.level,
    price: Math.max(0, e.price_byn ?? 0),
    capacity: clamp(e.capacity ?? config.defaultCapacity, 1, 1000),
    organizer_name: (e.organizer.trim() || post.sourceName).slice(0, 120),
    status: e.confident ? config.eventStatus : 'hidden',
    source: post.source,
    source_url: post.url,
    external_key: `${post.source}:${post.postId}#${index}`,
  };
}

export async function runOnce(store: Store, options: RunOptions = {}): Promise<RunSummary> {
  const summary: RunSummary = { inserted: 0, errors: 0, log: [] };
  const log = (...parts: unknown[]) => {
    const line = parts.map(String).join(' ');
    summary.log.push(line);
    console.log(line);
  };
  const fail = (where: string, err: unknown) => {
    summary.errors++;
    log(`${where}: ошибка —`, err instanceof Error ? err.message : JSON.stringify(err));
  };

  async function processPost(post: SourcePost): Promise<void> {
    const { events: extracted, reason } = post.events
      ? { events: post.events, reason: post.reason ?? null }
      : extractEvents(post);
    const rows: EventRow[] = [];
    const notes: string[] = [];
    let pending = false;
    for (const [i, e] of extracted.entries()) {
      const row = await toRow(post, e, i, options.geoSearch);
      if (row === PENDING) {
        pending = true;
        notes.push(`${e.title}: ждём координаты`);
      } else if (typeof row === 'string') notes.push(`${e.title}: ${row}`);
      else if (await store.isDuplicate(row)) notes.push(`${e.title}: уже есть в ленте`);
      else rows.push(row);
    }

    if (options.verbose) {
      if (reason) log('  ·', reason);
      for (const r of rows) {
        log('  +', r.status === 'hidden' ? '[скрыто]' : '', r.starts_at, r.sport, r.title, '@', r.venue_name, `(${r.lat}, ${r.lng})`);
      }
      for (const n of notes) log('  −', n);
    }

    const inserted = await store.insertEvents(rows);
    summary.inserted += inserted;
    if (inserted) log(`  ${post.url}: добавлено событий — ${inserted}`);
    if (post.retryLater || pending) return;
    await store.markProcessed(post, rows.length, reason ?? (notes.join('; ') || null));
  }

  async function ingestTelegram(channel: ChannelConfig): Promise<void> {
    const posts = await fetchTelegramChannel(channel, config.pagesPerChannel);
    const minDate = Date.now() - config.maxPostAgeDays * 86_400_000;
    const fresh = posts.filter((p) => !p.postedAt || new Date(p.postedAt).getTime() >= minDate);
    const done = await store.processedPostIds('telegram', fresh.map((p) => p.postId));
    const todo = fresh.filter((p) => !done.has(p.postId));
    log(`@${channel.name}: постов ${posts.length}, свежих ${fresh.length}, новых ${todo.length}`);

    for (const post of todo) {
      try {
        if (options.verbose) log(`- ${post.url}: ${post.text.slice(0, 80).replace(/\n/g, ' ')}…`);
        await processPost(post);
      } catch (err) {
        fail(`  ${post.url}`, err); // пост не помечен разобранным — попробуем в следующем проходе
      }
    }
  }

  async function ingestProbeg(cityId: number): Promise<void> {
    const items = await listProbegCity(cityId);
    const done = await store.processedPostIds('probeg', items.map((i) => i.postId));
    const todo = items.filter((i) => !done.has(i.postId));
    log(`probeg.org/races/city/${cityId}: будущих забегов ${items.length}, новых ${todo.length}`);

    for (const item of todo) {
      try {
        const post = await loadProbegEvent(item);
        if (options.verbose) log(`- ${post.url}: ${post.text.split('\n')[0]}`);
        await processPost(post);
      } catch (err) {
        fail(`  ${item.url}`, err);
      }
    }
  }

  for (const channel of config.telegramChannels) {
    try {
      await ingestTelegram(channel);
    } catch (err) {
      fail(`@${channel.name}`, err);
    }
  }
  for (const cityId of config.probegCityIds) {
    try {
      await ingestProbeg(cityId);
    } catch (err) {
      fail(`probeg ${cityId}`, err);
    }
  }
  return summary;
}
