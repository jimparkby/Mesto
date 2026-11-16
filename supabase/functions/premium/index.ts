// Edge Function: счёт на Mesto Premium (Telegram Stars). Вызывается из приложения с JWT пользователя.
//  { action: 'invoice' } → { invoiceUrl, botUrl, stars, days }
// invoiceUrl открывается в Mini App через Telegram.WebApp.openInvoice; вне Telegram — ссылка на бота
// (/start premium), бот присылает счёт в чат. Зачисление — в функции bot (successful_payment).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createPremiumInvoiceLink, PREMIUM_DAYS, PREMIUM_STARS } from '../_shared/premium.ts';
import { botUsername, cors, json } from '../_shared/telegram.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ message: 'method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: me } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!me.user) return json({ message: 'Нужно войти' }, 401);

  const body = await req.json().catch(() => ({}));
  if (body.action !== 'invoice') return json({ message: 'unknown action' }, 400);

  const invoiceUrl = await createPremiumInvoiceLink(me.user.id);
  let botUrl: string | null = null;
  try {
    botUrl = `https://t.me/${await botUsername()}?start=premium`;
  } catch {
    botUrl = null;
  }
  if (!invoiceUrl && !botUrl) return json({ message: 'Оплата временно недоступна. Попробуйте позже.' }, 502);
  return json({ invoiceUrl, botUrl, stars: PREMIUM_STARS, days: PREMIUM_DAYS });
});
