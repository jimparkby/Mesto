import { CalendarBlank, MapPin, UsersThree } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { distanceKm, formatDistance, formatPrice, formatWhen, isFull } from '../domain/events';
import { eventLevelLabel } from '../domain/levels';
import { eventTypeLabel, levelsLabel, sportMeta } from '../domain/sports';
import type { LatLng, SportEvent } from '../domain/types';
import { useToast } from '../state';
import { LoginSheet } from './LoginSheet';
import { PersonAvatar, PremiumBadge, RatingBadge } from './People';
import { SportIcon } from './SportIcon';

/** «2/4» — сколько мест занято с учётом мест, занятых вне приложения. */
export function takenLabel(e: SportEvent): string {
  return `${Math.min(e.capacity, e.registeredCount + e.reserved)}/${e.capacity}`;
}

export function eventLevels(e: SportEvent): string {
  if (e.levels.length) return levelsLabel(e.levels);
  return eventLevelLabel(e, (l) => levelsLabel([l]));
}

/** Запись прямо из карточки: вход, заявка или моментальная запись, тост. */
function useQuickJoin(e: SportEvent) {
  const { user, myRequests, toggleRegistration } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const request = myRequests.get(e.id);

  const join = async (ev: React.MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (!user) {
      setLoginOpen(true);
      return;
    }
    setBusy(true);
    try {
      const status = await toggleRegistration(e.id, true);
      toast(status === 'pending' ? 'Заявка отправлена организатору' : 'Вы записаны!', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const mine = !!user && e.organizerId === user.id;
  let label = e.eventType === 'training' && e.organizerIsCoach ? 'Записаться' : 'Присоединиться';
  let disabled = busy;
  if (mine) {
    label = 'Ваше событие';
    disabled = true;
  } else if (request === 'approved') {
    label = 'Вы идёте';
    disabled = true;
  } else if (request === 'pending') {
    label = 'Заявка отправлена';
    disabled = true;
  } else if (request === 'rejected') {
    label = 'Заявка отклонена';
    disabled = true;
  } else if (isFull({ ...e, registeredCount: e.registeredCount + e.reserved })) {
    label = 'Мест нет';
    disabled = true;
  }

  const sheet = <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} reason="Войдите, чтобы записаться на событие" />;
  return { join, label, disabled, busy, sheet, done: request === 'approved' || request === 'pending' || mine };
}

/** Карточка «Доступные игры»: организатор с рейтингом, места, уровень, когда, где и «Присоединиться». */
export function GameCard({ event: e, location }: { event: SportEvent; location?: LatLng | null }) {
  const meta = sportMeta(e.sport);
  const q = useQuickJoin(e);
  return (
    <>
      <Link to={`/event/${e.id}`} className={`card game-card${e.organizerPremium ? ' is-premium' : ''}`}>
        <div className="game-card-head">
          <PersonAvatar name={e.organizerName || 'Организатор'} photoUrl={e.organizerPhotoUrl} size={40} premium={e.organizerPremium} />
          <div className="game-card-org">
            <div className="game-card-org-name">
              {e.organizerName || 'Организатор'}
              {e.organizerPremium && <PremiumBadge small />}
            </div>
            <RatingBadge value={e.organizerRating ?? null} />
          </div>
          <span className="game-card-count">
            <UsersThree size={16} weight="fill" /> {takenLabel(e)}
          </span>
        </div>
        <div className="game-card-sport">
          <SportIcon sport={e.sport} size={18} color={meta.color} />
          <b>{meta.label}</b>
          <span className="badge badge-muted">{eventTypeLabel(e.eventType)}</span>
          {e.organizerIsCoach && <span className="badge badge-coach">Тренер</span>}
        </div>
        <h3 className="game-card-title">{e.title}</h3>
        <div className="game-card-lines">
          <span>{eventLevels(e)}</span>
          <span>
            <CalendarBlank size={15} weight="fill" /> {formatWhen(e)}
          </span>
          <span>
            <MapPin size={15} weight="fill" /> {e.venueName}
            {location && ` · ${formatDistance(distanceKm(location, e))}`}
          </span>
          <span className={e.price === 0 ? 'game-card-free' : 'game-card-price'}>{formatPrice(e.price)}</span>
        </div>
        <button type="button" className={`btn ${q.done ? 'btn-ghost' : 'btn-primary'} btn-block game-card-join`} disabled={q.disabled} onClick={q.join}>
          {q.busy ? '…' : q.label}
        </button>
      </Link>
      {q.sheet}
    </>
  );
}

/** Карточка в карусели «Занятия с тренером». */
export function CoachSessionCard({ event: e }: { event: SportEvent }) {
  const meta = sportMeta(e.sport);
  const q = useQuickJoin(e);
  return (
    <>
      <Link to={`/event/${e.id}`} className={`card coach-card${e.organizerPremium ? ' is-premium' : ''}`}>
        <div className="coach-card-head">
          <PersonAvatar name={e.organizerName} photoUrl={e.organizerPhotoUrl} size={40} premium={e.organizerPremium} />
          <div className="coach-card-id">
            <div className="coach-card-name">{e.organizerName}</div>
            <RatingBadge value={e.organizerRating ?? null} />
          </div>
          <span className="badge badge-coach">Тренер</span>
        </div>
        <div className="coach-card-lines">
          <span className="coach-card-sport">
            <SportIcon sport={e.sport} size={16} color={meta.color} /> {meta.label}
          </span>
          <span>{eventLevels(e)}</span>
          <span>{formatWhen(e)}</span>
          <span className="coach-card-venue">{e.venueName}</span>
          <b className="coach-card-price">{e.price > 0 ? `${e.price} BYN / занятие` : 'Бесплатно'}</b>
        </div>
        <button type="button" className={`btn ${q.done ? 'btn-ghost' : 'btn-tonal'} btn-block`} disabled={q.disabled} onClick={q.join}>
          {q.busy ? '…' : q.label}
        </button>
      </Link>
      {q.sheet}
    </>
  );
}

/** Маленькая карточка «Мои события» в горизонтальной ленте. */
export function MyEventTile({ event: e, organizer }: { event: SportEvent; organizer: boolean }) {
  const meta = sportMeta(e.sport);
  return (
    <Link to={`/event/${e.id}`} className="my-tile" style={{ ['--sport' as string]: meta.color }}>
      <span className="my-tile-icon">
        <SportIcon sport={e.sport} size={22} color="#fff" />
      </span>
      <span className="my-tile-title">{e.title}</span>
      <span className="my-tile-when">{formatWhen(e)}</span>
      <span className="my-tile-meta">
        {organizer ? 'Организую' : 'Иду'} · {takenLabel(e)}
      </span>
    </Link>
  );
}
