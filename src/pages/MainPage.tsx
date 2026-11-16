import { Plus, SlidersHorizontal, Star } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { CoachSessionCard, GameCard, MyEventTile } from '../components/GameCards';
import { Icon } from '../components/Icon';
import { SportIcon } from '../components/SportIcon';
import { TopBar, TopBarButton } from '../components/TopBar';
import { isPast } from '../domain/events';
import { DEFAULT_FILTERS } from '../domain/filters';
import { POPULAR_SPORTS, sportMeta } from '../domain/sports';
import type { SportEvent, SportId } from '../domain/types';
import { useEvents, useGeolocation } from '../hooks';
import { useCity, useFilters } from '../state';

/** Premium-организаторы выше, дальше — по времени начала. */
function byPriority(a: SportEvent, b: SportEvent): number {
  if (!!a.organizerPremium !== !!b.organizerPremium) return a.organizerPremium ? -1 : 1;
  return a.startsAt.localeCompare(b.startsAt);
}

/** Главная «События»: мои события, фильтр по виду спорта, занятия с тренером и доступные игры в выбранном городе. */
export function MainPage() {
  const { user, myEventIds, myRequests, pendingReviews } = useAuth();
  const { events, loading } = useEvents();
  const { city } = useCity();
  const { setFilters } = useFilters();
  const geo = useGeolocation();
  const navigate = useNavigate();
  const [sport, setSport] = useState<SportId | 'all'>('all');

  const data = useMemo(() => {
    const upcoming = events.filter((e) => !isPast(e) && e.city === city);
    const mine = user
      ? upcoming
          .filter((e) => e.organizerId === user.id || myEventIds.has(e.id) || myRequests.get(e.id) === 'pending')
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      : [];
    const bySport = sport === 'all' ? upcoming : upcoming.filter((e) => e.sport === sport);
    const isCoachSession = (e: SportEvent) => e.eventType === 'training' && !!e.organizerIsCoach;
    // Виды спорта, по которым есть события, — первыми в чипах.
    const counts = new Map<SportId, number>();
    for (const e of upcoming) counts.set(e.sport, (counts.get(e.sport) ?? 0) + 1);
    const chips = [...new Set([...[...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!), ...POPULAR_SPORTS])].slice(0, 14);
    return {
      mine,
      coach: bySport.filter(isCoachSession).sort(byPriority).slice(0, 12),
      games: bySport.filter((e) => !isCoachSession(e)).sort(byPriority),
      chips,
    };
  }, [events, city, user, myEventIds, myRequests, sport]);

  const openAll = (coachOnly = false) => {
    setFilters({ ...DEFAULT_FILTERS, sports: sport === 'all' ? [] : [sport], eventType: coachOnly ? 'training' : 'all' });
    navigate('/events');
  };

  return (
    <div className="page home2">
      <TopBar
        title="События"
        actions={
          <TopBarButton label="Все события и фильтры" onClick={() => openAll()}>
            <SlidersHorizontal size={22} />
          </TopBarButton>
        }
      />

      {pendingReviews.length > 0 && (
        <Link to={`/rate/${pendingReviews[0].event.id}`} className="card review-banner">
          <span className="review-banner-icon">
            <Star size={22} weight="fill" />
          </span>
          <span className="grow">
            <b>{pendingReviews[0].event.eventType === 'training' ? 'Как прошла тренировка?' : 'Как прошла игра?'}</b>
            <span className="muted">Подтвердите «{pendingReviews[0].event.title}» и оцените партнёров</span>
          </span>
          <Icon name="chevron" size={18} weight="bold" />
        </Link>
      )}

      <section>
        <h2 className="section-h">Мои события</h2>
        <div className="my-row">
          <Link to="/create" className="my-create" data-tour="tab-create">
            <Plus size={22} weight="bold" />
            Создать событие
          </Link>
          {data.mine.map((e) => (
            <MyEventTile key={e.id} event={e} organizer={e.organizerId === user?.id} />
          ))}
        </div>
      </section>

      <div className="sport-chips" data-tour="chips" role="list">
        <button type="button" className={`chip${sport === 'all' ? ' is-on' : ''}`} onClick={() => setSport('all')}>
          Все
        </button>
        {data.chips.map((id) => {
          const m = sportMeta(id);
          const on = sport === id;
          return (
            <button key={id} type="button" className={`chip${on ? ' is-on' : ''}`} onClick={() => setSport(on ? 'all' : id)}>
              <SportIcon sport={id} size={18} color={on ? undefined : m.color} />
              {m.label}
            </button>
          );
        })}
      </div>

      {data.coach.length > 0 && (
        <section>
          <div className="section-row">
            <h2 className="section-h">Занятия с тренером</h2>
            <button type="button" className="link" onClick={() => openAll(true)}>
              Все
            </button>
          </div>
          <div className="coach-row">
            {data.coach.map((e) => (
              <CoachSessionCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      <section className="stack" data-tour="list">
        <div className="section-row">
          <h2 className="section-h">Доступные игры</h2>
          <button type="button" className="link" onClick={() => openAll()}>
            Все
          </button>
        </div>
        {loading && !events.length ? (
          [0, 1].map((i) => <div key={i} className="card skeleton tall" />)
        ) : data.games.length === 0 ? (
          <div className="card home-empty">
            <p>
              {sport === 'all' ? `В городе ${city} пока нет игр.` : `${sportMeta(sport).label}: в городе ${city} пока нет игр.`} Создайте
              первую — команда найдётся.
            </p>
            <Link to="/create" className="btn btn-primary btn-block">
              <Plus size={20} weight="bold" /> Создать событие
            </Link>
          </div>
        ) : (
          data.games.slice(0, 30).map((e) => <GameCard key={e.id} event={e} location={geo.location} />)
        )}
      </section>
    </div>
  );
}
