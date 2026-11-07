import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { EventCard } from '../components/EventCard';
import { Icon } from '../components/Icon';
import { SportIcon } from '../components/SportIcon';
import { isPast } from '../domain/events';
import { DEFAULT_FILTERS, type DateRange } from '../domain/filters';
import { SPORTS } from '../domain/sports';
import type { SportEvent, SportId } from '../domain/types';
import { useEvents } from '../hooks';
import { useFilters } from '../state';

const DAY = 24 * 3600_000;

function startOfDay(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Главная: приветствие, сводка в крупных виджетах и ближайшие события — всё из реальных данных. */
export function MainPage() {
  const { user, myEventIds } = useAuth();
  const { events, loading } = useEvents();
  const { setFilters } = useFilters();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const upcoming = events.filter((e) => !isPast(e));
    const today0 = startOfDay();
    const inRange = (e: SportEvent, from: number, to: number) => {
      const t = new Date(e.startsAt).getTime();
      return t >= from && t < to;
    };
    const bySport = new Map<SportId, number>();
    for (const e of upcoming) bySport.set(e.sport, (bySport.get(e.sport) ?? 0) + 1);
    return {
      upcoming,
      today: upcoming.filter((e) => inRange(e, today0, today0 + DAY)).length,
      week: upcoming.filter((e) => inRange(e, today0, today0 + 7 * DAY)).length,
      free: upcoming.filter((e) => e.price === 0).length,
      mine: upcoming.filter((e) => myEventIds.has(e.id)).length,
      // Сначала виды спорта, по которым есть события.
      sports: [...SPORTS].filter((s) => s.id !== 'other').sort((a, b) => (bySport.get(b.id) ?? 0) - (bySport.get(a.id) ?? 0)),
    };
  }, [events, myEventIds]);

  const openEvents = (patch: { sport?: SportId; date?: DateRange; freeOnly?: boolean }) => {
    setFilters({
      ...DEFAULT_FILTERS,
      sports: patch.sport ? [patch.sport] : [],
      date: patch.date ?? 'all',
      freeOnly: !!patch.freeOnly,
    });
    navigate('/events');
  };

  const firstName = user?.name?.split(/\s+/)[0];
  const num = (n: number) => (loading ? '—' : String(n));

  return (
    <div className="page home">
      <header className="home-head">
        <div>
          <p className="home-hello">{firstName ? `Привет, ${firstName}!` : 'Привет!'}</p>
          <p className="home-date">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link to="/profile" aria-label="Профиль">
          <Avatar name={user?.name ?? 'Гость'} photoUrl={user?.photoUrl} size={44} />
        </Link>
      </header>

      <h1 className="home-title">
        Найди свою
        <br />
        <span>команду</span>
      </h1>

      <div className="home-sports" role="list">
        {stats.sports.map((s) => (
          <button key={s.id} type="button" className="home-sport" onClick={() => openEvents({ sport: s.id })}>
            <SportIcon sport={s.id} size={18} color={s.color} />
            {s.label}
          </button>
        ))}
      </div>

      <section className="home-grid">
        <button type="button" className="home-tile" onClick={() => openEvents({ date: 'today' })}>
          <span className="home-tile-cap">Сегодня</span>
          <span className="home-tile-num">{num(stats.today)}</span>
          <span className="home-tile-sub">{plural(stats.today, 'событие', 'события', 'событий')}</span>
        </button>
        <button type="button" className="home-tile" onClick={() => openEvents({ date: 'week' })}>
          <span className="home-tile-cap">На неделе</span>
          <span className="home-tile-num">{num(stats.week)}</span>
          <span className="home-tile-sub">игр и тренировок</span>
        </button>
        <button type="button" className="home-tile" onClick={() => openEvents({ freeOnly: true })}>
          <span className="home-tile-cap">Бесплатно</span>
          <span className="home-tile-num">{num(stats.free)}</span>
          <span className="home-tile-sub">без оплаты</span>
        </button>
        <Link to="/profile" className="home-tile">
          <span className="home-tile-cap">Я иду</span>
          <span className="home-tile-num">{user ? num(stats.mine) : '0'}</span>
          <span className="home-tile-sub">{user ? 'мои записи' : 'войдите, чтобы записаться'}</span>
        </Link>
      </section>

      <div className="home-section-head">
        <h2 className="home-section-title">Ближайшие</h2>
        <Link to="/events" className="home-link">
          Все <Icon name="chevron" size={16} weight="bold" />
        </Link>
      </div>

      {loading && !events.length ? (
        <div className="stack">
          {[0, 1].map((i) => (
            <div key={i} className="card skeleton tall" />
          ))}
        </div>
      ) : stats.upcoming.length === 0 ? (
        <div className="card home-empty">
          <p>Пока нет событий. Создайте первое — команда найдётся.</p>
          <Link to="/create" className="btn btn-primary btn-block">
            <Icon name="plus" size={20} weight="bold" /> Создать событие
          </Link>
        </div>
      ) : (
        stats.upcoming
          .slice(0, 3)
          .map((e) => <EventCard key={e.id} event={e} joined={myEventIds.has(e.id)} />)
      )}
    </div>
  );
}
