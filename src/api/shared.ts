import { coachPrice, comparePeople, topLevel } from '../domain/people';
import { levelRank } from '../domain/sports';
import type { Level, PendingReview, PublicProfile, SportEvent, SportId } from '../domain/types';
import type { Participant } from './types';

/** Сортировка в поиске: по рейтингу, сначала новые или дешевле (тренеры). */
export function sortPeople(list: PublicProfile[], f: { level: Level | 'all'; sport: SportId | null; sort: string }): PublicProfile[] {
  let out = list;
  if (f.level !== 'all') {
    const want = levelRank(f.level);
    out = out.filter((p) => levelRank(topLevel(p, f.sport)) === want);
  }
  if (f.sort === 'new')
    return [...out].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  if (f.sort === 'price')
    return [...out].sort(
      (a, b) => (coachPrice(a, f.sport) ?? Infinity) - (coachPrice(b, f.sport) ?? Infinity),
    );
  return [...out].sort(comparePeople);
}

/** Кого оценивать после события: ученики оценивают тренера, тренер — учеников, в игре — все друг друга. */
export function buildReview(
  event: SportEvent,
  me: { id: string },
  people: Participant[],
  profiles: Map<string, PublicProfile>,
): PendingReview | null {
  const coachSession = event.eventType === 'training' && !!event.organizerIsCoach;
  const list = people
    .filter((p) => p.userId !== me.id && !p.userId.startsWith('demo-'))
    .filter((p) => !coachSession || event.organizerId === me.id || p.userId === event.organizerId)
    .slice(0, 12)
    .map((p) => {
      const prof = profiles.get(p.userId);
      return {
        id: p.userId,
        name: prof?.name ?? p.name,
        photoUrl: prof?.photoUrl ?? p.photoUrl,
        isCoach: coachSession && p.userId === event.organizerId,
        skillLevel: prof ? topLevel(prof, event.sport) : ('any' as Level),
      };
    });
  if (!list.length) return null;
  return { event, people: list };
}
