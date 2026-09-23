// Edge Function: вход через Telegram вне Mini App (APK, браузер) — по коду от бота.
//
//  { action: 'start' }               → { token, bot }  — APK открывает t.me/<bot>?start=login_<token>,
//                                                       бот (функция bot) присылает код в чат;
//  { action: 'resend', token }       → { ok }           — прислать новый код в тот же чат;
//  { action: 'verify', token, code } → { access_token, refresh_token }.
//
// Секреты: TELEGRAM_BOT_TOKEN, TG_AUTH_SECRET — те же, что у telegram-auth.

import {
  LOGIN_CODE_MAX_ATTEMPTS,
  LOGIN_CODE_TTL_MS,
  LOGIN_REQUEST_TTL_MS,
  adminClient,
  botUsername,
  cors,
  json,
  loginCodeHash,
  newLoginCode,
  sendLoginCode,
  sessionForTelegramUser,
  timingSafeEqual,
  toHex,
  type TgUser,
} from '../_shared/telegram.ts';

const RESEND_COOLDOWN_MS = 30_000;

interface LoginRequest {
  token: string;
  created_at: string;
  chat_id: number | null;
  tg_user: TgUser | null;
  code_hash: string | null;
  code_sent_at: string | null;
  attempts: number;
}

const age = (iso: string) => Date.now() - new Date(iso).getTime();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const admin = adminClient();

  if (body.action === 'start') {
    // Заодно чистим старые запросы, чтобы таблица не росла.
    await admin
      .from('tg_login_requests')
      .delete()
      .lt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());

    const token = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    const { error } = await admin.from('tg_login_requests').insert({ token });
    if (error) return json({ error: error.message }, 500);
    try {
      return json({ token, bot: await botUsername() });
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }
  }

  const token = String(body.token ?? '');
  const { data: row } = await admin
    .from('tg_login_requests')
    .select('*')
    .eq('token', token)
    .maybeSingle<LoginRequest>();
  if (!row || age(row.created_at) > LOGIN_REQUEST_TTL_MS) {
    return json({ error: 'expired', message: 'Запрос устарел. Начните вход заново.' }, 410);
  }

  if (body.action === 'resend') {
    if (!row.chat_id) return json({ error: 'not_started', message: 'Сначала откройте бота и нажмите «Старт».' }, 409);
    if (row.code_sent_at && age(row.code_sent_at) < RESEND_COOLDOWN_MS) {
      return json({ error: 'too_soon', message: 'Код уже отправлен. Подождите полминуты.' }, 429);
    }
    const code = newLoginCode();
    await admin
      .from('tg_login_requests')
      .update({ code_hash: await loginCodeHash(token, code), code_sent_at: new Date().toISOString(), attempts: 0 })
      .eq('token', token);
    if (!(await sendLoginCode(row.chat_id, code))) return json({ error: 'send_failed', message: 'Бот не смог отправить код.' }, 502);
    return json({ ok: true });
  }

  if (body.action === 'verify') {
    if (!row.code_hash || !row.code_sent_at || !row.tg_user) {
      return json({ error: 'not_started', message: 'Сначала откройте бота и нажмите «Старт» — он пришлёт код.' }, 409);
    }
    if (age(row.code_sent_at) > LOGIN_CODE_TTL_MS) {
      return json({ error: 'code_expired', message: 'Код устарел. Запросите новый.' }, 410);
    }
    if (row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
      return json({ error: 'too_many_attempts', message: 'Слишком много попыток. Запросите новый код.' }, 429);
    }
    const code = String(body.code ?? '').trim();
    if (!timingSafeEqual(await loginCodeHash(token, code), row.code_hash)) {
      await admin.from('tg_login_requests').update({ attempts: row.attempts + 1 }).eq('token', token);
      return json({ error: 'bad_code', message: 'Неверный код.' }, 401);
    }

    // Код одноразовый.
    await admin.from('tg_login_requests').delete().eq('token', token);
    try {
      return json(await sessionForTelegramUser(row.tg_user));
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }
  }

  return json({ error: 'unknown action' }, 400);
});
