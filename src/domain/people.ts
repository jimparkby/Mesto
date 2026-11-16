import { levelRank } from './sports';
import type { Gender, Level, PublicProfile, Ratings, SportId, SportSkill } from './types';

export const EMPTY_RATINGS: Ratings = { vibe: null, levelFit: null, effectiveness: null, count: 0 };

/** Общий рейтинг (★): среднее из имеющихся оценок; null — оценок ещё нет. */
export function overallRating(r: Ratings | null | undefined): number | null {
  if (!r || r.count === 0) return null;
  const xs = [r.vibe, r.levelFit, r.effectiveness].filter((x): x is number => typeof x === 'number');
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function formatRating(x: number | null | undefined): string {
  return typeof x === 'number' ? x.toFixed(1) : '—';
}

export function ageFrom(birthDate: string | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function yearsLabel(n: number): string {
  return `${n} ${plural(n, 'год', 'года', 'лет')}`;
}

export function ageLabel(n: number): string {
  return yearsLabel(n);
}

export function genderLabel(g: Gender | null | undefined): string | null {
  if (g === 'male') return 'Мужской';
  if (g === 'female') return 'Женский';
  return null;
}

const ONLINE_MS = 5 * 60_000;

export function isOnline(lastSeenAt: string | null | undefined, now = Date.now()): boolean {
  return !!lastSeenAt && now - new Date(lastSeenAt).getTime() < ONLINE_MS;
}

/** «Онлайн», «Был(а) недавно», «Был(а) 3 дня назад». */
export function lastSeenLabel(lastSeenAt: string | null | undefined, gender: Gender | null | undefined, now = Date.now()): string | null {
  if (!lastSeenAt) return null;
  if (isOnline(lastSeenAt, now)) return 'Онлайн';
  const was = gender === 'female' ? 'Была' : gender === 'male' ? 'Был' : 'Был(а)';
  const diff = now - new Date(lastSeenAt).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return `${was} недавно`;
  if (days < 7) return `${was} ${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
  if (days < 30) return `${was} ${Math.floor(days / 7)} нед. назад`;
  return `${was} давно`;
}

export function skillFor(p: { skills: SportSkill[] }, sport: SportId | null | undefined): SportSkill | null {
  if (!sport) return null;
  return p.skills.find((s) => s.sport === sport) ?? null;
}

/** Самый высокий уровень человека (или уровень в выбранном виде спорта). */
export function topLevel(p: { skills: SportSkill[] }, sport?: SportId | null): Level {
  const list = sport ? p.skills.filter((s) => s.sport === sport) : p.skills;
  return list.reduce<Level>((best, s) => (levelRank(s.level) > levelRank(best) ? s.level : best), 'any');
}

/** Минимальная цена занятия у тренера (по виду спорта или по всем). */
export function coachPrice(p: { skills: SportSkill[] }, sport?: SportId | null): number | null {
  const prices = (sport ? p.skills.filter((s) => s.sport === sport) : p.skills)
    .map((s) => s.price)
    .filter((x): x is number => typeof x === 'number' && x > 0);
  return prices.length ? Math.min(...prices) : null;
}

export function coachYears(p: { skills: SportSkill[] }, sport?: SportId | null): number | null {
  const years = (sport ? p.skills.filter((s) => s.sport === sport) : p.skills)
    .map((s) => s.years)
    .filter((x): x is number => typeof x === 'number' && x > 0);
  return years.length ? Math.max(...years) : null;
}

export function priceLabel(byn: number): string {
  return `${byn} BYN`;
}

/** «@name», «t.me/name», «https://t.me/+invite» → https://t.me/…; null — не похоже на ссылку Telegram. */
export function normalizeTgLink(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const m = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_+/=-]{3,})$/i.exec(v) ?? /^@([A-Za-z0-9_]{4,})$/.exec(v);
  return m ? `https://t.me/${m[1]}` : null;
}

export function telegramLink(username: string | null | undefined): string | null {
  return username ? `https://t.me/${username}` : null;
}

/** Премиум-профили выше, затем по рейтингу и числу оценок. */
export function comparePeople(a: PublicProfile, b: PublicProfile): number {
  if (a.premium !== b.premium) return a.premium ? -1 : 1;
  const ra = overallRating(a.ratings) ?? 0;
  const rb = overallRating(b.ratings) ?? 0;
  if (rb !== ra) return rb - ra;
  return b.ratings.count - a.ratings.count;
}
