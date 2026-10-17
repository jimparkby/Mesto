// Пост на естественном языке → список структурированных событий. Без LLM: словари и регулярки.
//
// Как устроено:
//  1. Фильтр: в посте должны быть слова про спорт и не должно быть «спектакль», «концерт», «билеты на матч»…
//  2. Пост режется на сегменты: строка с датой начинает новое событие (расписание на неделю → несколько событий).
//     Строки до первой даты — общий заголовок, их место/цена/уровень достаются всем событиям.
//  3. В каждом сегменте ищем дату, время (или диапазон «20.00—21.30»), место, цену, число мест, уровень.
//
// Всё, что распознано не уверенно (дата по дню недели, вид спорта «другое»), помечается confident: false —
// такие события попадают в ленту скрытыми, их одобряет админ.

import { KNOWN_PLACES } from './places.ts';
import type { ExtractedEvent, Level, SportId, SourcePost } from './types.ts';

// В JS \b не работает с кириллицей, поэтому границы слова — через lookbehind/lookahead.
// Флаг g — только для matchAll/replace/подсчёта: у глобальной регулярки .test() помнит lastIndex между вызовами.
const B = '(?<![\\p{L}\\d])';
const E = '(?![\\p{L}])';
const re = (body: string, flags = 'giu') => new RegExp(body, flags);

// ---------- вид спорта ----------

const SPORT_WORDS: [SportId, RegExp][] = [
  ['running', re(`${B}(пробежк|забег|бегов|бегаем|бег${E}|трейл|марафон|полумарафон|раннинг|run${E}|running|parkrun|s95)`)],
  ['football', re(`${B}(футбол|мини-футбол|футзал|football)`)],
  ['basketball', re(`${B}(баскетбол|стритбол|streetball|basketball)`)],
  ['volleyball', re(`${B}(волейбол|volleyball)`)],
  ['tennis', re(`${B}(теннис|tennis)`)],
  ['yoga', re(`${B}(йог[аеиу]|йогой|хатха|yoga)`)],
  ['cycling', re(`${B}(вело|покатушк|шоссейн|гревел|mtb${E}|cycling)`)],
  ['workout', re(`${B}(воркаут|workout|турник|кроссфит|crossfit|функционал|круговая тренировк)`)],
  ['swimming', re(`${B}(плаван|заплыв|бассейн|открытая вода)`)],
  ['hockey', re(`${B}(хокке|hockey)`)],
  ['other', re(`${B}(лыж|сквош|падел|бадминтон|скалолаз|боулдеринг|зарядк|триатлон|ориентирован|фрисби|регби|сап${E}|sup${E}|гандбол|настольн|скандинавск)`)],
];

/** Слова, без которых пост — не анонс участия, а новость/мотивация. */
const ACTIVITY = re(
  `${B}(тренировк|трениру|игра${E}|играем|игру${E}|игры${E}|турнир|забег|заплыв|заезд|пробежк|сбор${E}|собираемся|приходи|присоединя|регистрац|запис|старт${E}|занятие|урок|ждём|ждем|участ)`,
  'iu',
);

/** Явно не наш формат: культура и зрелища. */
const NEGATIVE = re(
  `${B}(спектакл|концерт|выставк|опер[аеыу]${E}|балет|театр|кинопоказ|фильм|лекци|форум|экспо|expo|стендап|stand-up|экскурси|ярмарк|вечеринк|квиз|мюзикл)`,
  'iu',
);
/** Пост про розыгрыш призов (время в нём — время розыгрыша). Упоминание призов в анонсе забега не в счёт. */
const RAFFLE = re(`${B}(розыгрыш|разыгра|выиграть|giveaway)`, 'iu');
/** Отмены и переносы — не новое событие. */
const CANCEL = re(`${B}(отмен[аяеиыу]|отменяем|отменили|перенос|переносится|переносим)`, 'iu');
/** «Расписание откроется в 10:00 — Парк Павлова»: время открытия записи, а не тренировки. */
const SCHEDULE_RELEASE = re(`${B}расписани\\p{L}*\\s+(?:\\p{L}+\\s+)?(появ|откр|публику|будет)`, 'iu');
/** Новости большого спорта: медали, сборные, профлиги. Такой пост берём, только если в нём явно зовут участвовать. */
const PRO_NEWS = re(
  `${B}(сборн|медал|призер|призёр|чемпионат\\p{L}* (?:мира|европы|беларуси|россии)|кубк\\p{L}* (?:мира|европы)|этап\\p{L}* кубка|нхл|кхл|олимпиад|нок${E}|президент)`,
  'iu',
);
const STRONG_INVITE = re(
  `${B}(приглаша|регистрац|зарегистр|записаться|запись открыта|присоединя|приходи|открыт\\p{L}* тренировк|ждём вас|ждем вас)`,
  'iu',
);
/** «Билеты на матч» — зрелище, а не участие. */
const SPECTATOR = re(`${B}(билет)`, 'iu');
const MATCH = re(`${B}(матч|чемпионат|плей-офф|кубок)`, 'iu');

function detectSport(text: string): { sport: SportId; score: number } | null {
  let best: { sport: SportId; score: number } | null = null;
  for (const [sport, pattern] of SPORT_WORDS) {
    const score = text.match(pattern)?.length ?? 0;
    // «other» проигрывает любому конкретному виду спорта при равенстве
    if (score > 0 && (!best || score > best.score || (score === best.score && best.sport === 'other'))) {
      best = { sport, score };
    }
  }
  return best;
}

// ---------- дата и время ----------

const MONTHS: [RegExp, number][] = [
  [/^янв/, 1], [/^фев/, 2], [/^мар/, 3], [/^апр/, 4], [/^ма[йя]/, 5], [/^июн/, 6],
  [/^июл/, 7], [/^авг/, 8], [/^сен/, 9], [/^окт/, 10], [/^ноя/, 11], [/^дек/, 12],
];
const MONTH_NAME = '(январ[ья]|феврал[ья]|марта?|апрел[ья]|ма[йя]|июн[ья]|июл[ья]|августа?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья]|янв|фев|мар|апр|июн|июл|авг|сен|сент|окт|ноя|дек)\\.?';

const WEEKDAYS: [RegExp, number][] = [
  [/^(понедельник|пн)/, 1], [/^(вторник|вт)/, 2], [/^(сред[аyу]|ср)/, 3], [/^(четверг|чт)/, 4],
  [/^(пятниц[аеу]|пт)/, 5], [/^(суббот[аеу]|сб)/, 6], [/^(воскресень[ея]|вс)/, 0],
];
const WEEKDAY_NAME = '(понедельник|вторник|сред[ау]|четверг|пятниц[аеу]|суббот[аеу]|воскресень[ея]|пн|вт|ср|чт|пт|сб|вс)';

const RE_DATE_NUM = re(`${B}(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{4}|\\d{2}))?(?![\\d:])`);
const RE_DATE_WORD = re(`${B}(\\d{1,2})(?:-?го)?\\s+${MONTH_NAME}(?:\\s+(\\d{4}))?${E}`);
const RE_WEEKDAY = re(`${B}${WEEKDAY_NAME}${E}`);
const RE_RELATIVE = re(`${B}(сегодня|завтра|послезавтра)${E}`);
const RE_TIME_RANGE = re(`(?<![\\d.])(\\d{1,2})[:.](\\d{2})\\s*(?:-|–|—|до)\\s*(\\d{1,2})[:.,](\\d{2})(?![\\d.])`);
const RE_TIME = re(`(?<![\\d.])(\\d{1,2}):(\\d{2})(?![\\d])`);
// «в 19.00» — точка вместо двоеточия только после «в/с/к» и с «круглыми» минутами, иначе это дата
const RE_TIME_DOT = re(`${B}(?:в|с|к)\\s+(\\d{1,2})\\.(00|15|30|45)(?![\\d.])`);
const RE_TIME_HOURS = re(`${B}в\\s+(\\d{1,2})\\s*(?:ч|час|часов|утра|вечера)${E}`);

interface LocalDate { y: number; m: number; d: number }
interface DateHit { date: LocalDate; byWeekday: boolean }

/** Календарная дата поста по Минску. */
function minskToday(iso: string | null): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Minsk', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(iso ? new Date(iso) : new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

const dayNumber = (d: LocalDate) => Date.UTC(d.y, d.m - 1, d.d) / 86_400_000;
function addDays(d: LocalDate, n: number): LocalDate {
  const t = new Date(Date.UTC(d.y, d.m - 1, d.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
function validDate(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Дата без года — ближайшая к дате поста (анонсы в прошлое не пишут, но «вчера был» бывает). */
function withYear(base: LocalDate, m: number, d: number, y?: number): LocalDate | null {
  if (y) {
    if (y < 100) y += 2000;
    return validDate(y, m, d) ? { y, m, d } : null;
  }
  if (!validDate(base.y, m, d) && !validDate(base.y + 1, m, d)) return null;
  const sameYear = { y: base.y, m, d };
  return dayNumber(sameYear) >= dayNumber(base) - 7 ? sameYear : { y: base.y + 1, m, d };
}

function findDate(text: string, base: LocalDate): DateHit | null {
  // Время-диапазоны вида 20.00—21.30 похожи на даты — убираем их перед поиском.
  const clean = text.replace(RE_TIME_RANGE, ' ').replace(RE_TIME_DOT, ' ');

  for (const m of clean.matchAll(RE_DATE_NUM)) {
    const date = withYear(base, Number(m[2]), Number(m[1]), m[3] ? Number(m[3]) : undefined);
    if (date) return { date, byWeekday: false };
  }
  for (const m of clean.matchAll(RE_DATE_WORD)) {
    const month = MONTHS.find(([p]) => p.test(m[2].toLowerCase()))?.[1];
    const date = month && withYear(base, month, Number(m[1]), m[3] ? Number(m[3]) : undefined);
    if (date) return { date, byWeekday: false };
  }
  const rel = clean.match(RE_RELATIVE)?.[0]?.toLowerCase();
  if (rel) return { date: addDays(base, rel === 'сегодня' ? 0 : rel === 'завтра' ? 1 : 2), byWeekday: false };

  const wd = clean.match(RE_WEEKDAY)?.[0]?.toLowerCase();
  const target = wd ? WEEKDAYS.find(([p]) => p.test(wd))?.[1] : undefined;
  if (target !== undefined) {
    const today = new Date(Date.UTC(base.y, base.m - 1, base.d)).getUTCDay();
    return { date: addDays(base, (target - today + 7) % 7), byWeekday: true };
  }
  return null;
}

function hasDate(line: string, base: LocalDate): boolean {
  const hit = findDate(line, base);
  return hit !== null && !hit.byWeekday;
}

function findTime(text: string): { h: number; min: number; durationMin: number | null } | null {
  const ok = (h: number, min: number) => h >= 5 && h <= 23 && min < 60; // ночных тренировок не бывает
  const range = [...text.matchAll(RE_TIME_RANGE)].find((m) => ok(+m[1], +m[2]));
  if (range) {
    const start = +range[1] * 60 + +range[2];
    const end = +range[3] * 60 + +range[4];
    return { h: +range[1], min: +range[2], durationMin: end > start ? end - start : null };
  }
  for (const pattern of [RE_TIME, RE_TIME_DOT]) {
    const m = [...text.matchAll(pattern)].find((x) => ok(+x[1], +x[2]));
    if (m) return { h: +m[1], min: +m[2], durationMin: null };
  }
  const hours = [...text.matchAll(RE_TIME_HOURS)].find((x) => ok(+x[1], 0));
  if (hours) {
    let h = +hours[1];
    if (/вечера/i.test(hours[0]) && h < 12) h += 12;
    return { h, min: 0, durationMin: null };
  }
  return null;
}

function findDuration(text: string): number | null {
  const min = text.match(re(`(\\d{2,3})\\s*мин`, 'iu'));
  if (min) return Number(min[1]);
  const hours = text.match(re(`(\\d(?:[.,]5)?)\\s*(?:час|ч${E})`, 'iu'));
  if (hours) return Math.round(Number(hours[1].replace(',', '.')) * 60);
  return null;
}

// ---------- место ----------

const RE_VENUE_LINE = re(`^\\s*(?:📍|🗺|🏟|📌)?\\s*(?:место|где|адрес|локация|сбор|точка сбора|старт)\\s*[:—-]\\s*(.+)$`, 'imu');
const RE_PIN_LINE = re(`^\\s*(?:📍|🗺|🏟|📌)\\s*(.+)$`, 'mu');
const RE_ADDRESS = re(
  `${B}((?:ул\\.?|улица|пр-т|пр-кт|проспект|пр\\.|пер\\.?|переулок|бульвар|б-р|тракт|наб\\.?|набережная)\\s+[\\p{L}\\d .-]{2,40}?,?\\s*(?:д\\.\\s*)?\\d+[а-яА-Я]?(?:\\/\\d+)?)`,
  'iu',
);

interface Venue { venueName: string; address: string; lat?: number; lng?: number }

function findVenue(text: string): Venue | null {
  const lower = text.toLowerCase();
  const address = text.match(RE_ADDRESS)?.[1]?.trim() ?? '';

  for (const place of KNOWN_PLACES) {
    if (place.aliases.some((a) => lower.includes(a))) {
      return { venueName: place.name, address: address || place.address, lat: place.lat, lng: place.lng };
    }
  }
  const line = (text.match(RE_VENUE_LINE)?.[1] ?? text.match(RE_PIN_LINE)?.[1])?.trim();
  if (line) {
    const venueName = line.replace(RE_ADDRESS, '').replace(/[,.;\s]+$/, '').replace(/^[,.;\s]+/, '').slice(0, 80);
    return { venueName: venueName || line.slice(0, 80), address: address || (venueName ? '' : line) };
  }
  if (address) {
    // «19.10 пн 20.30—22.00 ФОЦ Машерова, пр-т Победителей, 23» → название — то, что перед адресом.
    const addrLine = text.split('\n').find((l) => l.includes(address)) ?? '';
    const before = stripWhen(addrLine.slice(0, addrLine.indexOf(address))).replace(/^[\s,.:;—–-]+|[\s,.:;—–-]+$/g, '');
    return { venueName: before.length >= 3 ? before.slice(0, 80) : address, address };
  }
  return null;
}

/**
 * Последний шанс: «05 июня, ФОЦ им Машерова, Победителей 23. 20.30—22,00 по 12р» — место пишут прямо
 * в строке с датой. Берём то, что осталось без даты/времени/цены, и отдаём геокодеру.
 */
function venueFromDateLine(line: string): Venue | null {
  if (line.length > 120) return null; // длинная строка — это уже текст новости, а не «дата, место»
  const rest = stripWhen(line)
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(re(`по\\s*\\d+(?:[.,]\\d+)?\\s*(?:р\\.?|руб\\p{L}*|byn)${E}`, 'giu'), '')
    .replace(/\(([^)]*)\)/g, ', $1')
    .split(/[,.;]\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3 && /\p{L}{3}/u.test(p) && !/^(зал|улица|на улице)$/iu.test(p));
  if (rest.length === 0 || rest[0].split(/\s+/).length > 6) return null;
  // «ФОЦ им Машерова» + «Победителей 23» (адрес без «ул.»)
  const address = rest.find((p, i) => i > 0 && /\d/.test(p)) ?? '';
  return { venueName: rest[0].slice(0, 80), address };
}

/** Убрать из строки даты, время и дни недели. */
function stripWhen(s: string): string {
  return s
    .replace(RE_TIME_RANGE, '').replace(RE_TIME, '').replace(RE_TIME_DOT, '')
    .replace(RE_DATE_NUM, '').replace(RE_DATE_WORD, '').replace(RE_WEEKDAY, '').replace(RE_RELATIVE, '')
    .replace(/\s{2,}/g, ' ');
}

// ---------- прочее ----------

function findPrice(text: string): number | null {
  if (re(`${B}(бесплатн|free${E}|вход свободный|без оплаты|0\\s*р${E})`, 'iu').test(text)) return 0;
  const m = text.match(re(`(\\d{1,4}(?:[.,]\\d{1,2})?)\\s*(?:р\\.?${E}|руб|byn|бел\\.?\\s*руб)`, 'iu'));
  return m ? Number(m[1].replace(',', '.')) : null;
}

function findCapacity(text: string): number | null {
  const m =
    text.match(re(`${B}(?:до|лимит|максимум|всего)\\s*(\\d{1,4})\\s*(?:человек|чел|участник|мест|игрок)`, 'iu')) ??
    text.match(re(`${B}(?:мест[ао]?|лимит)\\s*[:—-]?\\s*(\\d{1,4})`, 'iu'));
  return m ? Number(m[1]) : null;
}

function findLevel(text: string): Level {
  if (re(`${B}(новичк|начинающ|с нуля|для всех уровней|любой уровень)`, 'iu').test(text)) {
    return /для всех уровней|любой уровень/i.test(text) ? 'any' : 'beginner';
  }
  if (re(`${B}(продвинут|опытн|профи${E}|pro${E})`, 'iu').test(text)) return 'advanced';
  if (re(`${B}(средн[иеяй]+ уров|любител)`, 'iu').test(text)) return 'intermediate';
  return 'any';
}

const SPORT_LABEL: Record<SportId, string> = {
  football: 'Футбол', running: 'Пробежка', basketball: 'Баскетбол', volleyball: 'Волейбол',
  tennis: 'Теннис', yoga: 'Йога', cycling: 'Велозаезд', workout: 'Воркаут', swimming: 'Плавание',
  hockey: 'Хоккей', other: 'Тренировка',
};

const GREETING = re(`^(друзья|доброе|добрый|привет|всем привет|ура|напоминаем|внимание|у нас отличные новости)`, 'iu');

/**
 * Заголовок — первая осмысленная фраза из первых строк поста (без эмодзи, хэштегов, дат, ссылок).
 * Списки участников («1. @nick») и реквизиты пропускаем; если фраза — это просто место, пишем «Футбол — место».
 */
function makeTitle(lines: string[], sport: SportId, venueName: string): string {
  const fallback = `${SPORT_LABEL[sport]} — ${venueName}`.slice(0, 120);
  for (const raw of lines.slice(0, 3)) {
    if (/@\w|^\d+[.)]|карт[ауы]|iban/iu.test(raw)) continue;
    const pieces = stripWhen(raw)
      .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
      .replace(/#\S+/g, '')
      .replace(/\(https?:\/\/[^)]+\)|https?:\/\/\S+/g, '')
      .split(/[.!?](?:\s|$)|,\s/u)
      .map((t) =>
        t
          .replace(re(`(?:${B}(?:в|во|с|к|на|эту|этот|это|ближайш\\p{L}*)\\s*)+$`, 'iu'), '')
          .replace(/^[\s,.:;!—–-]+|[\s,.:;—–-]+$/g, '')
          .replace(/\s{2,}/g, ' '),
      );
    const t = pieces
      .map((p) => p.replace(re(`^(?:(?:уже|в|во|это|эту|этот|ближайш\\p{L}*)${E}\\s*)+`, 'iu'), '').replace(/^[\s,.:;!—–-]+/, ''))
      .find((p) => p.length >= 6 && /\p{L}{3}/u.test(p) && !GREETING.test(p));
    if (!t) continue;
    if (t.toLowerCase().includes(venueName.toLowerCase().slice(0, 12))) return fallback;
    const title = t[0].toUpperCase() + t.slice(1);
    return title.length > 80 ? `${title.slice(0, 77).trimEnd()}…` : title;
  }
  return fallback;
}

const pad = (n: number) => String(n).padStart(2, '0');

// ---------- разбор поста ----------

export type ExtractResult = { events: ExtractedEvent[]; reason: string | null };

export function extractEvents(post: SourcePost): ExtractResult {
  const text = post.text;
  // В тематическом канале вид спорта подразумевается, и «приходите» тоже: там каждый пост — про игру.
  const themed = post.defaultSport !== undefined;
  const sport = detectSport(text) ?? (themed ? { sport: post.defaultSport!, score: 1 } : null);
  if (!sport) return { events: [], reason: 'не про спорт' };
  if (NEGATIVE.test(text) && sport.score < 2) return { events: [], reason: 'культурное событие' };
  if (SPECTATOR.test(text) && MATCH.test(text)) return { events: [], reason: 'зрелищный матч' };
  if (CANCEL.test(text)) return { events: [], reason: 'отмена или перенос' };
  if (RAFFLE.test(text.slice(0, 250))) return { events: [], reason: 'розыгрыш' };
  if (SCHEDULE_RELEASE.test(text)) return { events: [], reason: 'анонс публикации расписания' };
  if (PRO_NEWS.test(text) && !STRONG_INVITE.test(text)) return { events: [], reason: 'новость большого спорта' };
  if (!themed && !ACTIVITY.test(text)) return { events: [], reason: 'нет призыва поучаствовать' };

  const base = minskToday(post.postedAt);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Сегменты: строка с конкретной датой начинает новое событие.
  const header: string[] = [];
  const segments: string[][] = [];
  for (const line of lines) {
    if (hasDate(line, base)) segments.push([line]);
    else if (segments.length) segments[segments.length - 1].push(line);
    else header.push(line);
  }
  // Даты нет ни в одной строке (только «в субботу»/«завтра») или все даты одинаковые
  // («15 августа организуем забег… Когда: 15 августа, 10:00») — весь пост одно событие.
  const distinctDates = new Set(segments.map((seg) => JSON.stringify(findDate(seg[0], base)?.date)));
  if (segments.length === 0 || distinctDates.size === 1) {
    header.length = 0;
    segments.length = 0;
    segments.push(lines);
  }

  const headerText = header.join('\n');
  const events: ExtractedEvent[] = [];
  const reasons = new Set<string>();

  for (const seg of segments) {
    const segText = seg.join('\n');
    const both = `${headerText}\n${segText}`;

    const dateHit = findDate(segText, base) ?? findDate(headerText, base);
    if (!dateHit) { reasons.add('нет даты'); continue; }
    const time = findTime(segText) ?? findTime(headerText);
    if (!time) { reasons.add('нет времени'); continue; }
    const venue = findVenue(segText) ?? findVenue(headerText) ?? venueFromDateLine(seg[0] ?? lines[0] ?? '');
    if (!venue) { reasons.add('нет места'); continue; }

    const segSport = segments.length > 1 ? detectSport(segText) ?? sport : sport;
    const { y, m, d } = dateHit.date;
    events.push({
      // В расписании у всех строк общий заголовок — различаем события по месту.
      title: segments.length > 1
        ? `${SPORT_LABEL[segSport.sport]} — ${venue.venueName}`.slice(0, 120)
        : makeTitle([...header, ...seg], segSport.sport, venue.venueName),
      sport: segSport.sport,
      description: text.length > 1500 ? `${text.slice(0, 1500).trimEnd()}…` : text,
      starts_at_local: `${y}-${pad(m)}-${pad(d)}T${pad(time.h)}:${pad(time.min)}`,
      duration_min: time.durationMin ?? findDuration(both),
      venue_name: venue.venueName,
      address: venue.address,
      lat: venue.lat,
      lng: venue.lng,
      level: findLevel(both) === 'any' ? findLevel(text) : findLevel(both),
      price_byn: findPrice(both) ?? findPrice(text),
      capacity: findCapacity(both) ?? findCapacity(text),
      organizer: '',
      confident: !dateHit.byWeekday && segSport.sport !== 'other',
    });
  }

  // Одна и та же дата+время дважды (например, дата в заголовке и в тексте) — оставляем первое.
  const unique = events.filter((e, i) => events.findIndex((x) => x.starts_at_local === e.starts_at_local) === i);
  return { events: unique, reason: unique.length ? null : [...reasons].join(', ') || 'не распознано' };
}
