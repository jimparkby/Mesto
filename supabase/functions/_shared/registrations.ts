// Заявки на участие: сообщение организатору с профилем участника и кнопками «Принять / Отклонить»,
// ответ участнику о решении. Используют функции bot (нажатие кнопки) и registration-notify (приложение).

import { adminClient, tgApi } from './telegram.ts';

const MINI_APP_URL = (Deno.env.get('MINI_APP_URL') ?? '').trim();

const SPORT_LABELS: Record<string, string> = {
  football: 'Футбол',
  running: 'Бег',
  basketball: 'Баскетбол',
  volleyball: 'Волейбол',
  tennis: 'Теннис',
  yoga: 'Йога',
  cycling: 'Велосипед',
  workout: 'Воркаут',
  swimming: 'Плавание',
  hockey: 'Хоккей',
  other: 'Другое',
};
const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Новичок',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

export type RegStatus = 'pending' | 'approved' | 'rejected';

interface RegInfo {
  id: number;
  status: RegStatus;
  event: {
    id: string;
    title: string;
    starts_at: string;
    capacity: number;
    registered_count: number;
    organizer_id: string | null;
  };
  user: Profile;
  organizer: Profile | null;
}

interface Profile {
  id: string;
  name: string;
  username: string | null;
  telegram_id: number | null;
  bio?: string;
  fav_sports?: string[];
  skill_level?: string;
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Кнопка, открывающая Mini App на нужном экране (startapp=event_<id> / user_<id>). */
export function appButton(text: string, startParam: string) {
  if (!MINI_APP_URL) return null;
  const u = new URL(MINI_APP_URL);
  u.searchParams.set('startapp', startParam);
  return { text, web_app: { url: u.toString() } };
}

const when = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Minsk',
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

async function loadProfile(id: string | null): Promise<Profile | null> {
  if (!id) return null;
  const { data } = await adminClient().from('profiles').select('*').eq('id', id).maybeSingle<Profile>();
  return data;
}

/** Заявка по номеру или по паре событие + участник. */
export async function loadRegistration(
  key: { id: number } | { eventId: string; userId: string },
): Promise<RegInfo | null> {
  const admin = adminClient();
  let q = admin.from('registrations').select('id, status, event_id, user_id');
  q = 'id' in key ? q.eq('id', key.id) : q.eq('event_id', key.eventId).eq('user_id', key.userId);
  const { data: reg } = await q.maybeSingle<{ id: number; status: RegStatus; event_id: string; user_id: string }>();
  if (!reg) return null;
  const { data: event } = await admin
    .from('events')
    .select('id, title, starts_at, capacity, registered_count, organizer_id')
    .eq('id', reg.event_id)
    .maybeSingle<RegInfo['event']>();
  const user = await loadProfile(reg.user_id);
  if (!event || !user) return null;
  return { id: reg.id, status: reg.status, event, user, organizer: await loadProfile(event.organizer_id) };
}

function profileText(p: Profile): string {
  const lines = [`<b>${esc(p.name)}</b>${p.username ? ` @${esc(p.username)}` : ''}`];
  if (p.skill_level && LEVEL_LABELS[p.skill_level]) lines.push(`Уровень: ${LEVEL_LABELS[p.skill_level]}`);
  if (p.fav_sports?.length) lines.push(`Виды спорта: ${p.fav_sports.map((s) => SPORT_LABELS[s] ?? s).join(', ')}`);
  if (p.bio) lines.push(`О себе: ${esc(p.bio)}`);
  if (lines.length === 1) lines.push('<i>Профиль не заполнен</i>');
  return lines.join('\n');
}

function organizerText(r: RegInfo): string {
  const left = Math.max(0, r.event.capacity - r.event.registered_count);
  const head =
    r.status === 'pending'
      ? '🙋 <b>Новая заявка</b>'
      : r.status === 'approved'
        ? '✅ <b>Заявка принята</b>'
        : '❌ <b>Заявка отклонена</b>';
  return (
    `${head} на «${esc(r.event.title)}»\n${when.format(new Date(r.event.starts_at))}\n\n` +
    `${profileText(r.user)}\n\nСвободно мест: ${left} из ${r.event.capacity}`
  );
}

function organizerKeyboard(r: RegInfo) {
  const rows: unknown[][] = [];
  if (r.status === 'pending') {
    rows.push([
      { text: '✅ Принять', callback_data: `ra:${r.id}` },
      { text: '❌ Отклонить', callback_data: `rr:${r.id}` },
    ]);
  }
  const profile = appButton('👤 Профиль', `user_${r.user.id}`);
  const event = appButton('Событие', `event_${r.event.id}`);
  const links = [profile, event].filter(Boolean);
  if (links.length) rows.push(links);
  return { inline_keyboard: rows };
}

/** Новая заявка → сообщение организатору. false — организатору не написать (нет Telegram или он не запускал бота). */
export async function notifyOrganizer(r: RegInfo): Promise<boolean> {
  const chatId = r.organizer?.telegram_id;
  if (!chatId) return false;
  const sent = await tgApi('sendMessage', {
    chat_id: chatId,
    text: organizerText(r),
    parse_mode: 'HTML',
    reply_markup: organizerKeyboard(r),
  });
  return sent !== null;
}

/** После решения обновляем сообщение у организатора: убираем кнопки, пишем итог. */
export async function updateOrganizerMessage(chatId: number, messageId: number, r: RegInfo) {
  await tgApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: organizerText(r),
    parse_mode: 'HTML',
    reply_markup: organizerKeyboard(r),
  });
}

/** Решение организатора → сообщение участнику. */
export async function notifyParticipant(r: RegInfo) {
  const chatId = r.user.telegram_id;
  if (!chatId || r.status === 'pending') return;
  const date = when.format(new Date(r.event.starts_at));
  const open = appButton('Открыть событие', `event_${r.event.id}`);
  await tgApi('sendMessage', {
    chat_id: chatId,
    text:
      r.status === 'approved'
        ? `✅ Организатор принял вашу заявку на «${esc(r.event.title)}», ${date}. До встречи!`
        : `Организатор отклонил вашу заявку на «${esc(r.event.title)}». Посмотрите другие события в Mesto.`,
    parse_mode: 'HTML',
    ...(open ? { reply_markup: { inline_keyboard: [[open]] } } : {}),
  });
}

/** Решение по заявке от имени организатора (по его Telegram id). Возвращает текст для всплывающего ответа. */
export async function decideByTelegram(regId: number, approve: boolean, telegramId: number) {
  const r = await loadRegistration({ id: regId });
  if (!r) return { text: 'Заявка не найдена — участник мог её отменить.', info: null };
  if (!r.organizer || r.organizer.telegram_id !== telegramId) return { text: 'Решать может только организатор.', info: null };
  if (r.status !== 'pending') return { text: 'По этой заявке уже есть решение.', info: r };

  const { error } = await adminClient()
    .from('registrations')
    .update({ status: approve ? 'approved' : 'rejected' })
    .eq('id', regId);
  if (error) return { text: /Мест/.test(error.message) ? 'Мест больше нет.' : 'Не получилось, попробуйте ещё раз.', info: r };

  const fresh = (await loadRegistration({ id: regId })) ?? r;
  await notifyParticipant(fresh);
  return { text: approve ? 'Участник принят' : 'Заявка отклонена', info: fresh };
}
