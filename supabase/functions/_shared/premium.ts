// Premium за Telegram Stars: счёт (createInvoiceLink / sendInvoice) и зачисление после оплаты.
// Цена и срок — из секретов PREMIUM_STARS / PREMIUM_DAYS (по умолчанию 150 ⭐ за 30 дней).

import { adminClient, tgApi } from './telegram.ts';

export const PREMIUM_STARS = Math.max(1, Number(Deno.env.get('PREMIUM_STARS') ?? 150) || 150);
export const PREMIUM_DAYS = Math.max(1, Number(Deno.env.get('PREMIUM_DAYS') ?? 30) || 30);

/** payload счёта: premium:<uuid пользователя>:<дней>. */
export function premiumPayload(userId: string): string {
  return `premium:${userId}:${PREMIUM_DAYS}`;
}

export function parsePremiumPayload(payload: string): { userId: string; days: number } | null {
  const m = /^premium:([0-9a-f-]{36}):(\d{1,3})$/.exec(payload);
  return m ? { userId: m[1], days: Number(m[2]) } : null;
}

function invoiceFields(userId: string) {
  return {
    title: `Mesto Premium — ${PREMIUM_DAYS} дней`,
    description: 'События выше в выдаче, заметный профиль с короной и свои комьюнити. Без автопродления.',
    payload: premiumPayload(userId),
    currency: 'XTR',
    prices: [{ label: `Premium на ${PREMIUM_DAYS} дней`, amount: PREMIUM_STARS }],
  };
}

/** Ссылка на счёт для Telegram.WebApp.openInvoice. */
export async function createPremiumInvoiceLink(userId: string): Promise<string | null> {
  return tgApi<string>('createInvoiceLink', invoiceFields(userId));
}

/** Счёт прямо в чат с ботом (вход в Premium из APK / браузера через /start premium). */
export async function sendPremiumInvoice(chatId: number, userId: string) {
  return tgApi('sendInvoice', { chat_id: chatId, ...invoiceFields(userId) });
}

/** Платёж прошёл — продлеваем Premium (повтор того же платежа ничего не добавит). */
export async function applyPremiumPayment(payload: string, chargeId: string, stars: number): Promise<string | null> {
  const p = parsePremiumPayload(payload);
  if (!p) return null;
  const { data, error } = await adminClient().rpc('grant_premium', {
    p_user: p.userId,
    p_days: p.days,
    p_charge: chargeId,
    p_stars: stars,
  });
  if (error) {
    console.error('grant_premium', error.message);
    return null;
  }
  return data as string | null;
}
