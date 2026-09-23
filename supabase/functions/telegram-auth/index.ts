// Edge Function: вход через Telegram Mini App.
// Клиент присылает Telegram.WebApp.initData, мы проверяем подпись токеном бота
// и возвращаем обычную сессию Supabase для этого пользователя.
//
// Секреты: TELEGRAM_BOT_TOKEN, TG_AUTH_SECRET (любая длинная случайная строка).
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY задаются платформой автоматически.

import { BOT_TOKEN, cors, hmac, json, sessionForTelegramUser, timingSafeEqual, toHex, type TgUser } from '../_shared/telegram.ts';

const MAX_AGE_SEC = 24 * 60 * 60;
const enc = new TextEncoder();

/** https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app */
async function verifyInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('hash missing');
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = await hmac(enc.encode('WebAppData'), BOT_TOKEN);
  const computed = toHex(await hmac(secretKey, dataCheckString));
  if (!timingSafeEqual(computed, hash)) throw new Error('bad signature');

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) throw new Error('initData expired');

  const user = JSON.parse(params.get('user') ?? 'null');
  if (!user?.id) throw new Error('user missing');
  // В Mini App отсутствие фото — это «фото нет», а не «неизвестно».
  return { ...user, photo_url: user.photo_url ?? null } as TgUser;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let tgUser;
  try {
    const { initData } = await req.json();
    tgUser = await verifyInitData(String(initData ?? ''));
  } catch (e) {
    return json({ error: `invalid initData: ${(e as Error).message}` }, 401);
  }

  try {
    return json(await sessionForTelegramUser(tgUser));
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
