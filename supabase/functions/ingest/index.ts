// Edge Function: импорт спортивных событий из Telegram-каналов и календаря ПроБЕГ в ленту.
// Запускается pg_cron каждые 30 минут (см. миграцию *_ingest_cron.sql); один вызов — один проход.
// Правила разбора постов — extract.ts, локальный запуск и тесты — ingest/ в корне репозитория.
//
// Вызов защищён секретом из Vault: pg_cron передаёт его в заголовке x-ingest-secret,
// функция сверяет через rpc ingest_secret_matches (доступна только service role).
// Необязательные настройки: TG_CHANNELS, PROBEG_CITY_IDS, INGEST_PAGES, INGEST_MAX_POST_AGE_DAYS,
// INGEST_EVENT_STATUS — см. config.ts.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { config } from './config.ts';
import { dbSearch } from './geocode.ts';
import { runOnce } from './run.ts';
import { createStore } from './store.ts';

Deno.serve(async (req) => {
  const sb = createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false } });
  const secret = req.headers.get('x-ingest-secret') ?? '';
  const { data: allowed, error } = await sb.rpc('ingest_secret_matches', { secret });
  if (error || !allowed) return new Response('Forbidden', { status: 403 });

  const started = Date.now();
  const summary = await runOnce(createStore(sb), { geoSearch: dbSearch(sb) });
  return Response.json({
    inserted: summary.inserted,
    errors: summary.errors,
    seconds: Math.round((Date.now() - started) / 1000),
    log: summary.log,
  });
});
