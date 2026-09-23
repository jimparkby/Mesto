import { Link } from 'react-router-dom';
import { distanceKm, formatDistance, formatPrice, formatWhen, isFull, pluralPlaces, spotsLeft } from '../domain/events';
import { levelLabel, sportMeta } from '../domain/sports';
import type { LatLng, SportEvent } from '../domain/types';
import { Icon } from './Icon';

interface Props {
  event: SportEvent;
  location?: LatLng | null;
  joined?: boolean;
  compact?: boolean;
}

export function EventCard({ event: e, location, joined, compact }: Props) {
  const meta = sportMeta(e.sport);
  const left = spotsLeft(e);
  const fillPct = Math.min(100, Math.round((e.registeredCount / e.capacity) * 100));

  return (
    <Link to={`/event/${e.id}`} className={`card event-card${compact ? ' is-compact' : ''}`}>
      <div className="event-card-icon" style={{ background: `${meta.color}1f`, color: meta.color }}>
        <span aria-hidden>{meta.emoji}</span>
      </div>
      <div className="event-card-body">
        <div className="event-card-top">
          <span className="event-card-sport" style={{ color: meta.color }}>
            {meta.label}
          </span>
          {joined && <span className="badge badge-ok">Вы идёте</span>}
          {e.status !== 'published' && <span className="badge badge-warn">{e.status === 'hidden' ? 'Скрыто' : 'Отменено'}</span>}
        </div>
        <h3 className="event-card-title">{e.title}</h3>
        <div className="event-card-meta">
          <Icon name="clock" size={15} />
          <span>{formatWhen(e)}</span>
        </div>
        <div className="event-card-meta">
          <Icon name="pin" size={15} />
          <span>
            {e.venueName}
            {location && ` · ${formatDistance(distanceKm(location, e))}`}
          </span>
        </div>
        {!compact && (
          <div className="event-card-footer">
            <span className="chip-sm">{levelLabel(e.level)}</span>
            <span className={`chip-sm${e.price === 0 ? ' chip-free' : ''}`}>{formatPrice(e.price)}</span>
            <span className={`spots${isFull(e) ? ' is-full' : left <= 3 ? ' is-low' : ''}`}>
              {isFull(e) ? 'Мест нет' : `Осталось ${pluralPlaces(left)}`}
            </span>
          </div>
        )}
        <div className="progress" aria-hidden>
          <div style={{ width: `${fillPct}%`, background: meta.color }} />
        </div>
      </div>
    </Link>
  );
}
