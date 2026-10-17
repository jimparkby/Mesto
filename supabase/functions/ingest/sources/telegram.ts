// Публичные Telegram-каналы через веб-превью https://t.me/s/<channel>.
// Не нужны ни бот, ни аккаунт: превью отдаёт последние ~20 постов, ?before=<id> — более старые.

import type { ChannelConfig } from '../config.ts';
import type { SourcePost } from '../types.ts';

const UA = 'Mozilla/5.0 (compatible; MestoIngest/0.1; +https://github.com/jimparkby/Mesto)';

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', hellip: '…',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML текста поста → обычный текст. Ссылки сохраняем: в них часто регистрация. */
function htmlToText(html: string): string {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis, (_m, href: string, inner: string) => {
      const label = inner.replace(/<[^>]+>/g, '');
      const url = decodeEntities(href);
      return label.includes(url) || url.startsWith('?') ? label : `${label} (${url})`;
    })
    .replace(/<[^>]+>/g, '');
  // Некоторые каналы экранируют текст дважды (&amp;ldquo;) — декодируем два раза.
  return decodeEntities(decodeEntities(text)).replace(/\n{3,}/g, '\n\n').trim();
}

interface Page {
  title: string;
  posts: SourcePost[];
  oldestId: number | null;
}

async function fetchPage({ name: channel, sport }: ChannelConfig, before?: number): Promise<Page> {
  const url = `https://t.me/s/${channel}${before ? `?before=${before}` : ''}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } });
  if (!res.ok) throw new Error(`t.me/s/${channel}: HTTP ${res.status}`);
  const html = await res.text();

  const title = decodeEntities(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? channel);
  const posts: SourcePost[] = [];
  let oldestId: number | null = null;

  // Каждый пост — блок с data-post="channel/123"; режем страницу по этим маркерам.
  const blocks = html.split(/(?=<div class="tgme_widget_message_wrap)/).slice(1);
  for (const block of blocks) {
    const postRef = block.match(/data-post="([^"]+\/(\d+))"/);
    if (!postRef) continue;
    const id = Number(postRef[2]);
    oldestId = oldestId === null ? id : Math.min(oldestId, id);

    const textHtml = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)<\/div>/s)?.[1];
    if (!textHtml) continue; // пост без текста (только фото/видео)
    const text = htmlToText(textHtml);
    if (text.length < 40) continue; // «Доброе утро» и подобное

    posts.push({
      source: 'telegram',
      postId: postRef[1],
      url: `https://t.me/${postRef[1]}`,
      postedAt: block.match(/<time datetime="([^"]+)"/)?.[1] ?? null,
      text,
      sourceName: title,
      defaultSport: sport,
    });
  }
  return { title, posts, oldestId };
}

/** Последние посты канала, от новых к старым, не больше `pages` страниц. */
export async function fetchTelegramChannel(channel: ChannelConfig, pages: number): Promise<SourcePost[]> {
  const all: SourcePost[] = [];
  let before: number | undefined;
  for (let i = 0; i < pages; i++) {
    const page = await fetchPage(channel, before);
    all.push(...page.posts);
    if (page.oldestId === null || page.oldestId <= 1) break;
    before = page.oldestId;
  }
  const unique = new Map(all.map((p) => [p.postId, p]));
  return [...unique.values()].sort((a, b) => (b.postedAt ?? '').localeCompare(a.postedAt ?? ''));
}
