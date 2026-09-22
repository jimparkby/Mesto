// Edge Function: webhook Telegram-бота «СпортРядом».
// /start → приветствие и кнопка, открывающая Mini App.
// /start event_<id> → сразу открывает карточку события.
//
// Секреты: TELEGRAM_BOT_TOKEN, MINI_APP_URL (https-адрес собранного фронтенда),
//          TELEGRAM_WEBHOOK_SECRET (тот же, что передан в setWebhook secret_token).

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const MINI_APP_URL = Deno.env.get('MINI_APP_URL')!;
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');

async function tg(method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(method, res.status, await res.text());
}

function appUrl(startParam?: string) {
  if (!startParam) return MINI_APP_URL;
  const u = new URL(MINI_APP_URL);
  u.searchParams.set('startapp', startParam);
  return u.toString();
}

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  const update = await req.json().catch(() => null);
  const msg = update?.message;
  if (!msg?.text) return new Response('ok');

  const chatId = msg.chat.id;
  const [cmd, arg] = String(msg.text).trim().split(/\s+/, 2);

  if (cmd === '/start') {
    const eventParam = arg?.startsWith('event_') ? arg : undefined;
    await tg('sendMessage', {
      chat_id: chatId,
      text: eventParam
        ? 'Открываю событие 👇'
        : '🏃 <b>СпортРядом</b> — любительские тренировки и игры рядом с тобой в Минске.\n\n' +
          'Футбол, бег, йога, волейбол и многое другое: найди событие на карте, запишись в один клик ' +
          'или создай своё и собери команду.',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: eventParam ? 'Открыть событие' : 'Открыть СпортРядом', web_app: { url: appUrl(eventParam) } }]],
      },
    });
  } else if (cmd === '/help') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Нажми кнопку меню «СпортРядом» внизу чата или отправь /start.',
    });
  }

  return new Response('ok');
});
