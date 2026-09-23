// Edge Function: вход через Telegram Mini App.
// Клиент присылает Telegram.WebApp.initData, мы проверяем подпись токеном бота
// и возвращаем обычную сессию Supabase для этого пользователя.
//
// Секреты: TELEGRAM_BOT_TOKEN, TG_AUTH_SECRET (любая длинная случайная строка).
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY задаются платформой автоматически.

import { createClient } from 'npm:@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const AUTH_SECRET = Deno.env.get('TG_AUTH_SECRET') ?? BOT_TOKEN;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_AGE_SEC = 24 * 60 * 60;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

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
  return user as { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
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

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const email = `tg${tgUser.id}@telegram.sportryadom.by`;
  // Пароль детерминированный и известен только серверу — пользователь его никогда не видит.
  const password = toHex(await hmac(enc.encode(AUTH_SECRET), `tg:${tgUser.id}`));
  const meta = {
    name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '),
    username: tgUser.username ?? null,
    photo_url: tgUser.photo_url ?? null,
    telegram_id: tgUser.id,
  };

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('telegram_id', tgUser.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    });
    // Аккаунт мог остаться без строки в profiles (например, её удалили вручную) —
    // тогда просто входим ниже и восстанавливаем профиль.
    if (error && (error as { code?: string }).code !== 'email_exists') return json({ error: error.message }, 500);
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) return json({ error: error?.message ?? 'no session' }, 500);

  // Обновляем имя/фото/username из Telegram при каждом входе; профиль создаётся, если его нет.
  const userId = data.session.user.id;
  await admin.auth.admin.updateUserById(userId, { user_metadata: meta });
  const { error: profileError } = await admin.from('profiles').upsert(
    { id: userId, name: meta.name, username: meta.username, photo_url: meta.photo_url, telegram_id: tgUser.id },
    { onConflict: 'id' },
  );
  if (profileError) return json({ error: profileError.message }, 500);

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});
