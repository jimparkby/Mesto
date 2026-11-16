// Edge Function: webhook Telegram-бота «Mesto».
// /start → приветствие и кнопка, открывающая Mini App.
// /start event_<id> → сразу открывает карточку события.
// /start login_<token> → код для входа в APK (см. telegram-code-auth).
// Кнопки «Принять / Отклонить» под заявкой (callback ra:<id> / rr:<id>) → решение организатора.
// Оплата Premium в Telegram Stars: pre_checkout_query → подтверждение, successful_payment → продление;
// /start premium — счёт в чат (для APK и браузера), /paysupport — вопросы по оплате.
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
import { applyPremiumPayment, parsePremiumPayload, PREMIUM_DAYS, sendPremiumInvoice } from '../_shared/premium.ts';
import { decideByTelegram, updateOrganizerMessage } from '../_shared/registrations.ts';
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

/** Telegram спрашивает перед списанием Stars — подтверждаем, если счёт наш. */
// deno-lint-ignore no-explicit-any
async function handlePreCheckout(q: any) {
  const ok = !!parsePremiumPayload(String(q.invoice_payload ?? ''));
  await tg('answerPreCheckoutQuery', {
    pre_checkout_query_id: q.id,
    ok,
    ...(ok ? {} : { error_message: 'Счёт устарел. Откройте Premium в приложении ещё раз.' }),
  });
}

/** Stars списаны — продлеваем Premium и благодарим. */
// deno-lint-ignore no-explicit-any
async function handlePayment(msg: any) {
  const p = msg.successful_payment;
  const until = await applyPremiumPayment(String(p.invoice_payload ?? ''), String(p.telegram_payment_charge_id), Number(p.total_amount));
  const date = until ? new Date(until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  await tg('sendMessage', {
    chat_id: msg.chat.id,
    text: date
      ? `⭐ Спасибо! Premium активен до ${date}.\n\nВаши события теперь выше в выдаче, а профиль заметнее. Создавать комьюнити можно во вкладке «Комьюнити».`
      : 'Оплата получена, но Premium не включился автоматически. Напишите /paysupport — разберёмся и всё вернём.',
    reply_markup: { inline_keyboard: [[{ text: 'Открыть Mesto', web_app: { url: appUrl() } }]] },
  });
}

/** /start premium из APK или браузера: присылаем счёт, если аккаунт Telegram уже связан с профилем. */
async function handlePremiumStart(chatId: number, fromId: number) {
  const { data } = await adminClient().from('profiles').select('id').eq('telegram_id', fromId).maybeSingle<{ id: string }>();
  if (!data) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Сначала откройте Mesto и войдите через Telegram — затем оформите Premium в профиле.',
      reply_markup: { inline_keyboard: [[{ text: 'Открыть Mesto', web_app: { url: appUrl() } }]] },
    });
    return;
  }
  await sendPremiumInvoice(chatId, data.id);
}

/** Организатор нажал «Принять» или «Отклонить» под заявкой. */
// deno-lint-ignore no-explicit-any
async function handleCallback(cq: any) {
  const m = /^r([ar]):(\d+)$/.exec(String(cq.data ?? ''));
  if (!m) {
    await tg('answerCallbackQuery', { callback_query_id: cq.id });
    return;
  }
  const { text, info } = await decideByTelegram(Number(m[2]), m[1] === 'a', cq.from.id);
  await tg('answerCallbackQuery', { callback_query_id: cq.id, text });
  if (info && cq.message) await updateOrganizerMessage(cq.message.chat.id, cq.message.message_id, info);
}

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  const update = await req.json().catch(() => null);
  if (update?.callback_query) {
    await handleCallback(update.callback_query).catch((err) => console.error('callback', err));
    return new Response('ok');
  }
  if (update?.pre_checkout_query) {
    await handlePreCheckout(update.pre_checkout_query).catch((err) => console.error('pre_checkout', err));
    return new Response('ok');
  }
  if (update?.message?.successful_payment) {
    await handlePayment(update.message).catch((err) => console.error('payment', err));
    return new Response('ok');
  }
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
  } else if (cmd === '/start' && arg === 'premium') {
    await handlePremiumStart(chatId, msg.from.id);
  } else if (cmd === '/start') {
    const startParam = arg && /^(event|user)_/.test(arg) ? arg : undefined;
    await tg('sendMessage', {
      chat_id: chatId,
      text: startParam
        ? 'Открываю 👇'
        : `Привет, ${msg.from?.first_name ?? 'спортсмен'}! 👋\n\n` +
          '<b>Mesto</b> — партнёры по спорту, тренеры и события рядом с тобой. ' +
          'Заполни спортивный паспорт, находи людей своего уровня и создавай игры за минуту.\n\n' +
          'Это чат с командой: пиши сюда вопросы, идеи и замечания — мы читаем всё и отвечаем лично.',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: startParam ? 'Открыть' : 'Открыть Mesto', web_app: { url: appUrl(startParam) } }]],
      },
    });
  } else if (cmd === '/paysupport') {
    await tg('sendMessage', {
      chat_id: chatId,
      text:
        `Premium стоит Stars и действует ${PREMIUM_DAYS} дней, без автопродления.\n\n` +
        'Если оплата прошла, а Premium не включился, или нужен возврат — опишите ситуацию одним сообщением здесь, ' +
        'команда ответит в течение суток.',
    });
  } else if (cmd === '/help') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Нажми кнопку меню «Mesto» внизу чата или отправь /start. Вопросы по оплате — /paysupport.',
    });
  }

  return new Response('ok');
});
