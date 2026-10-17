// Локальный запуск импорта (тот же код, что в Edge Function supabase/functions/ingest).
//   npm run dry    — один проход без записи в базу: посмотреть, что распознаётся
//   npm run once   — один проход с записью (нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env)

import { createClient } from '@supabase/supabase-js';
import { config } from '../supabase/functions/ingest/config.ts';
import { runOnce } from '../supabase/functions/ingest/run.ts';
import { createStore } from '../supabase/functions/ingest/store.ts';

const dryRun = process.argv.includes('--dry-run');
if (!dryRun && (!config.supabaseUrl || !config.supabaseServiceKey)) {
  console.error('Нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (или запустите с --dry-run)');
  process.exit(1);
}

const sb = dryRun ? null : createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false } });
const summary = await runOnce(createStore(sb), { verbose: dryRun });
console.log(`Итого: добавлено ${summary.inserted}, ошибок ${summary.errors}${dryRun ? ' (dry run)' : ''}`);
