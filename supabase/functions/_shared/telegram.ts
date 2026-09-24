// Общее для Edge Functions, связанных с Telegram:
// сессия Supabase для пользователя Telegram, коды входа, вызовы Bot API.

import { createClient } from 'npm:@supabase/supabase-js@2';

export const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const AUTH_SECRET = Deno.env.get('TG_AUTH_SECRET') ?? BOT_TOKEN;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Сколько живёт запрос на вход (от нажатия «Войти» до ввода кода). */
export const LOGIN_REQUEST_TTL_MS = 15 * 60_000;
/** Сколько живёт код из бота. */
export const LOGIN_CODE_TTL_MS = 5 * 60_000;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const enc = new TextEncoder();

export async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  /** undefined — фото неизвестно (бот его не получает), null — фото нет. */
  photo_url?: string | null;
}

export const adminClient = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export async function tgApi<T = unknown>(method: string, body: unknown): Promise<T | null> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    console.error(method, res.status, JSON.stringify(data));
    return null;
  }
  return data.result as T;
}

let botUsernameCache: string | null = null;
export async function botUsername(): Promise<string> {
  if (!botUsernameCache) {
    const me = await tgApi<{ username: string }>('getMe', {});
    if (!me?.username) throw new Error('getMe failed');
    botUsernameCache = me.username;
  }
  return botUsernameCache;
}

/** Случайный 4-значный код. */
export function newLoginCode(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 10_000).padStart(4, '0');
}

export async function loginCodeHash(token: string, code: string): Promise<string> {
  return toHex(await hmac(enc.encode(AUTH_SECRET), `login:${token}:${code}`));
}

/** Отправить код входа в чат с ботом. */
export async function sendLoginCode(chatId: number, code: string) {
  return tgApi('sendMessage', {
    chat_id: chatId,
    text:
      `Ваш код для входа в Mesto: <b>${code}</b>\n\n` +
      'Введите его в приложении. Код действует 5 минут.\n' +
      'Никому его не сообщайте. Если вы не входили в приложение, просто проигнорируйте это сообщение.',
    parse_mode: 'HTML',
  });
}

/**
 * Возвращает сессию Supabase для пользователя Telegram, при первом входе создаёт аккаунт.
 * Один и тот же пользователь Telegram всегда попадает в один аккаунт — из Mini App и из APK.
 */
export async function sessionForTelegramUser(tgUser: TgUser) {
  const admin = adminClient();
  const email = `tg${tgUser.id}@telegram.sportryadom.by`;
  // Пароль детерминированный и известен только серверу — пользователь его никогда не видит.
  const password = toHex(await hmac(enc.encode(AUTH_SECRET), `tg:${tgUser.id}`));
  const meta: Record<string, unknown> = {
    name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '),
    username: tgUser.username ?? null,
    telegram_id: tgUser.id,
  };
  // Боту Telegram не присылает фото — тогда оставляем то, что уже сохранено.
  if (tgUser.photo_url !== undefined) meta.photo_url = tgUser.photo_url;

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
    if (error && (error as { code?: string }).code !== 'email_exists') throw new Error(error.message);
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? 'no session');

  // Обновляем имя/фото/username из Telegram при каждом входе; профиль создаётся, если его нет.
  const userId = data.session.user.id;
  await admin.auth.admin.updateUserById(userId, { user_metadata: meta });
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: userId, ...meta, telegram_id: tgUser.id }, { onConflict: 'id' });
  if (profileError) throw new Error(profileError.message);

  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}
