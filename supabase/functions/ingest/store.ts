// Запись в Supabase через service role (RLS не применяется).
// Клиент создаёт точка входа: в Edge Function — из npm:@supabase/supabase-js, локально — из node_modules.
// null — dry run: ничего не читаем и не пишем.

import type { SourcePost } from './types.ts';

// Тип клиента не импортируем: спецификаторы пакета в Deno и Node разные, а нам нужны только .from() и .rpc().
// deno-lint-ignore no-explicit-any
export type Db = { from(table: string): any; rpc(fn: string, args?: object): any } | null;

export interface EventRow {
  title: string;
  sport: string;
  description: string;
  starts_at: string;
  duration_min: number;
  venue_name: string;
  address: string;
  lat: number;
  lng: number;
  level: string;
  price: number;
  capacity: number;
  organizer_name: string;
  status: string;
  source: string;
  source_url: string;
  external_key: string;
}

/** Расстояние в километрах (равнопромежуточная проекция — для пары километров по Минску достаточно). */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const x = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const y = b.lat - a.lat;
  return Math.sqrt(x * x + y * y) * 111.32;
}

export function createStore(sb: Db) {
  return {
    /** Какие из постов уже разобраны раньше. */
    async processedPostIds(source: string, postIds: string[]): Promise<Set<string>> {
      if (!sb || postIds.length === 0) return new Set();
      const { data, error } = await sb.from('ingest_posts').select('post_id').eq('source', source).in('post_id', postIds);
      if (error) throw error;
      return new Set((data as { post_id: string }[]).map((r) => r.post_id));
    },

    async markProcessed(post: SourcePost, eventsFound: number, note: string | null): Promise<void> {
      if (!sb) return;
      const { error } = await sb.from('ingest_posts').upsert({
        source: post.source,
        post_id: post.postId,
        url: post.url,
        posted_at: post.postedAt,
        text: post.text,
        events_found: eventsFound,
        note,
      });
      if (error) throw error;
    },

    /**
     * То же событие уже есть в ленте: тот же спорт, то же время, рядом (≤500 м). Ловит повторные анонсы
     * в одном канале и одно событие из разных источников.
     */
    async isDuplicate(row: EventRow): Promise<boolean> {
      if (!sb) return false;
      const { data, error } = await sb
        .from('events')
        .select('lat, lng, external_key')
        .eq('sport', row.sport)
        .eq('starts_at', row.starts_at);
      if (error) throw error;
      return (data as { lat: number; lng: number; external_key: string | null }[]).some(
        (e) => e.external_key !== row.external_key && distanceKm(row, e) <= 0.5,
      );
    },

    /** Повторный импорт того же события не перезаписывает правки админа (скрытие, исправления). */
    async insertEvents(rows: EventRow[]): Promise<number> {
      if (!sb || rows.length === 0) return 0;
      const { data, error } = await sb
        .from('events')
        .upsert(rows, { onConflict: 'external_key', ignoreDuplicates: true })
        .select('id');
      if (error) throw error;
      return (data as unknown[]).length;
    },
  };
}

export type Store = ReturnType<typeof createStore>;
