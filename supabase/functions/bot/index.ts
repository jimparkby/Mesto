// Edge Function: webhook Telegram-бота «Mesto».
// /start → приветствие и кнопка, открывающая Mini App.
// /start event_<id> → сразу открывает карточку события.
// /start login_<token> → код для входа в APK (см. telegram-code-auth).
//
// Сообщения из групп-источников (INGEST_GROUPS, см. ingest/config.ts) → импорт событий в ленту.
//
// Секреты: TELEGRAM_BOT_TOKEN, MINI_APP_URL (https-адрес собранного фронтенда),
//          TELEGRAM_WEBHOOK_SECRET (тот же, что передан в setWebhook secret_token).

import {
  LOGIN_REQUEST_TTL_MS,
  adminClient,
  loginCodeHash,
  newLoginCode,
  sendLoginCode,
  tgApi as tg,
  type TgUser,
} from '../_shared/telegram.ts';
import { config as ingestConfig } from '../ingest/config.ts';
import { extractEvents } from '../ingest/extract.ts';
import { dbSearch } from '../ingest/geocode.ts';
import { ingestPosts } from '../ingest/run.ts';
import { createStore } from '../ingest/store.ts';
import type { SourcePost } from '../ingest/types.ts';

const MINI_APP_URL = Deno.env.get('MINI_APP_URL')!.trim();
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');

function appUrl(startParam?: string) {
  if (!startParam) return MINI_APP_URL;
  const u = new URL(MINI_APP_URL);
  u.searchParams.set('startapp', startParam);
  return u.toString();
}

/** Привязываем запрос на вход к этому аккаунту Telegram и присылаем код. */
async function handleLogin(token: string, chatId: number, from: TgUser) {
  const admin = adminClient();
  const { data: row } = await admin
    .from('tg_login_requests')
    .select('created_at, chat_id')
    .eq('token', token)
    .maybeSingle<{ created_at: string; chat_id: number | null }>();

  const expired = !row || Date.now() - new Date(row.created_at).getTime() > LOGIN_REQUEST_TTL_MS;
  // Запрос уже привязан к другому аккаунту — не отдаём код чужому человеку.
  if (expired || (row.chat_id && row.chat_id !== chatId)) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Ссылка для входа устарела. Вернитесь в приложение и нажмите «Войти через Telegram» ещё раз.',
    });
    return;
  }

  const code = newLoginCode();
  const tgUser: TgUser = { id: from.id, first_name: from.first_name, last_name: from.last_name, username: from.username };
  await admin
    .from('tg_login_requests')
    .update({
      chat_id: chatId,
      tg_user: tgUser,
      code_hash: await loginCodeHash(token, code),
      code_sent_at: new Date().toISOString(),
      attempts: 0,
    })
    .eq('token', token);
  await sendLoginCode(chatId, code);
}

/** Сообщение из группы-источника → разбор как поста канала. Правка с «КОМПЛЕКТ»/отменой снимает события поста. */
// deno-lint-ignore no-explicit-any
async function ingestGroupMessage(msg: any, edited: boolean) {
  const username = String(msg.chat.username ?? '').toLowerCase();
  const group = ingestConfig.telegramGroups.find((g) => g.name === username);
  const text = msg.text ?? msg.caption;
  if (!group || !text) return;
  // В форуме сообщения общей ветки (General) приходят без message_thread_id; её номер — 1.
  const thread = msg.is_topic_message ? msg.message_thread_id : 1;
  if (group.thread !== undefined && thread !== group.thread) return;

  const post: SourcePost = {
    source: 'telegram',
    postId: `${msg.chat.username}/${msg.message_id}`,
    url: `https://t.me/${msg.chat.username}/${msg.message_id}`,
    postedAt: new Date(msg.date * 1000).toISOString(),
    text,
    sourceName: msg.chat.title ?? msg.chat.username,
    defaultSport: group.sport,
  };
  const admin = adminClient();
  if (edited) {
    const { reason } = extractEvents(post);
    if (reason === 'набор закрыт' || reason === 'отмена или перенос') {
      await admin.from('events').update({ status: 'hidden' }).like('external_key', `telegram:${post.postId}#%`);
      return;
    }
  }
  await ingestPosts(createStore(admin), [post], { geoSearch: dbSearch(admin) });
}

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  const update = await req.json().catch(() => null);
  const groupMsg = update?.message ?? update?.edited_message;
  if (groupMsg && groupMsg.chat?.type !== 'private') {
    // В группах бот только читает анонсы, команды там не обрабатываем.
    await ingestGroupMessage(groupMsg, Boolean(update.edited_message)).catch((err) => console.error('ingest', err));
    return new Response('ok');
  }
  const msg = update?.message;
  if (!msg?.text) return new Response('ok');

  const chatId = msg.chat.id;
  const [cmd, arg] = String(msg.text).trim().split(/\s+/, 2);

  if (cmd === '/start' && arg?.startsWith('login_')) {
    await handleLogin(arg.slice('login_'.length), chatId, msg.from);
  } else if (cmd === '/start') {
    const eventParam = arg?.startsWith('event_') ? arg : undefined;
    await tg('sendMessage', {
      chat_id: chatId,
      text: eventParam
        ? 'Открываю событие 👇'
        : '🏃 <b>Mesto</b> — любительские тренировки и игры рядом с тобой в Минске.\n\n' +
          'Футбол, бег, йога, волейбол и многое другое: найди событие на карте, запишись в один клик ' +
          'или создай своё и собери команду.',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: eventParam ? 'Открыть событие' : 'Открыть Mesto', web_app: { url: appUrl(eventParam) } }]],
      },
    });
  } else if (cmd === '/help') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Нажми кнопку меню «Mesto» внизу чата или отправь /start.',
    });
  }

  return new Response('ok');
});
