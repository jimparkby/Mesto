import { Star } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { ageFrom, coachPrice, coachYears, formatRating, genderLabel, isOnline, overallRating, priceLabel, telegramLink, yearsLabel } from '../domain/people';
import { levelLabel, sportMeta } from '../domain/sports';
import type { PublicProfile, Ratings, SportId } from '../domain/types';
import { platform } from '../platforms';
import { Avatar } from './Avatar';
import { SportIcon } from './SportIcon';

/** ★ 4.8 — общий рейтинг; без оценок — «новичок в Mesto». */
export function RatingBadge({ ratings, value, className = '' }: { ratings?: Ratings | null; value?: number | null; className?: string }) {
  const x = value !== undefined ? value : overallRating(ratings);
  if (x === null || x === undefined) return <span className={`rating rating-none ${className}`}>нет оценок</span>;
  return (
    <span className={`rating ${className}`}>
      <Star size={14} weight="fill" /> {formatRating(x)}
    </span>
  );
}

/** Аватар с отметкой «онлайн». */
export function PersonAvatar({
  name,
  photoUrl,
  size = 48,
  online,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  online?: boolean;
}) {
  return (
    <span className="person-avatar" style={{ width: size, height: size }}>
      <Avatar name={name} photoUrl={photoUrl} size={size} />
      {online && <span className="person-avatar-online" aria-label="онлайн" />}
    </span>
  );
}

export function SportTags({ sports, max = 3 }: { sports: SportId[]; max?: number }) {
  const shown = sports.slice(0, max);
  return (
    <span className="sport-tags">
      {shown.map((s) => sportMeta(s).label).join(', ')}
      {sports.length > max && ` +${sports.length - max}`}
    </span>
  );
}

/** Карточка в поиске: игрок — виды спорта, город, пол; тренер — стаж, город, цена и «Записаться». */
export function PersonCard({ p, sport }: { p: PublicProfile; sport?: SportId | null }) {
  const skills = sport ? p.skills.filter((s) => s.sport === sport) : p.skills;
  const main = skills[0] ?? p.skills[0];
  const years = coachYears(p, sport);
  const price = coachPrice(p, sport);
  const age = ageFrom(p.birthDate);
  const tg = telegramLink(p.username);

  const action = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (tg) platform.openLink(tg);
  };

  return (
    <Link to={`/user/${p.id}`} className="card person-card">
      <div className="person-card-head">
        <PersonAvatar name={p.name} photoUrl={p.photoUrl} online={isOnline(p.lastSeenAt)} />
        <div className="person-card-id">
          <div className="person-card-name">
            {p.name}
          </div>
          <RatingBadge ratings={p.ratings} />
        </div>
      </div>
      {p.isCoach ? (
        <div className="person-card-lines">
          {main && (
            <div className="person-card-sport">
              <SportIcon sport={main.sport} size={16} color={sportMeta(main.sport).color} />
              <SportTags sports={p.skills.map((s) => s.sport)} />
            </div>
          )}
          {years && <div className="muted">Тренирует {yearsLabel(years)}</div>}
          <div className="muted">{p.city}</div>
          {price && (
            <div className="person-card-price">
              {priceLabel(price)} <span className="muted">за занятие</span>
            </div>
          )}
        </div>
      ) : (
        <div className="person-card-lines">
          {main && (
            <div className="person-card-sport">
              <SportIcon sport={main.sport} size={16} color={sportMeta(main.sport).color} />
              <SportTags sports={p.skills.map((s) => s.sport)} />
              <span className="chip-sm">{levelLabel(main.level)}</span>
            </div>
          )}
          <div className="muted">
            {[p.city, genderLabel(p.gender), age !== null ? yearsLabel(age) : null]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      )}
      <span
        role="button"
        tabIndex={0}
        className={`btn btn-tonal btn-block person-card-action${tg ? '' : ' is-disabled'}`}
        onClick={p.isCoach ? undefined : action}
      >
        {p.isCoach ? 'Записаться' : tg ? 'Написать в Telegram' : 'Профиль'}
      </span>
    </Link>
  );
}
