import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api';
import { EventCard } from '../components/EventCard';
import { FilterBar } from '../components/FilterBar';
import { Icon } from '../components/Icon';
import { SportIcon } from '../components/SportIcon';
import { formatDay, formatTime, isPast } from '../domain/events';
import { applyFilters, countActiveFilters, DEFAULT_FILTERS, sortEvents } from '../domain/filters';
import { useEvents, useGeolocation } from '../hooks';
import { useFilters } from '../state';

const WEEK_MS = 7 * 86_400_000;

export function HomePage() {
  const { myEventIds } = useAuth();
  const { events, loading, error, reload } = useEvents();
  const { filters, setFilters, sort, setSort } = useFilters();
  const geo = useGeolocation();

  const visible = useMemo(() => {
    const upcoming = events.filter((e) => !isPast(e));
    return sortEvents(applyFilters(upcoming, filters, geo.location), sort, geo.location);
  }, [events, filters, sort, geo.location]);

  // При сортировке по времени группируем по дням.
  const groups = useMemo(() => {
    if (sort !== 'time') return [{ day: '', items: visible }];
    const map = new Map<string, typeof visible>();
    for (const e of visible) {
      const day = formatDay(e.startsAt);
      map.set(day, [...(map.get(day) ?? []), e]);
    }
    return [...map.entries()].map(([day, items]) => ({ day, items }));
  }, [visible, sort]);

  // Сводка сверху: все опубликованные предстоящие события, без учёта фильтров.
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.status === 'published' && !isPast(e))
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [events],
  );

  const weekCount = useMemo(() => {
    const horizon = Date.now() + WEEK_MS;
    return upcoming.filter((e) => +new Date(e.startsAt) <= horizon).length;
  }, [upcoming]);

  const nearest = useMemo(() => upcoming.slice(0, 2), [upcoming]);

  const hasFilters = countActiveFilters(filters) > 0 || filters.query !== '';

  return (
    <div className="page">
      <header className="events-head">
        <div className="events-head-text">
          <h1 className="events-title">События</h1>
          {api.mode === 'demo' && (
            <span className="badge badge-muted" title="Данные хранятся на устройстве">
              демо-режим
            </span>
          )}
        </div>
        <Link to="/create" className="btn btn-primary btn-sm events-create">
          <Icon name="plus" size={16} weight="bold" />
          Создать
        </Link>
      </header>

      <div className="search-row">
        <label className="search-box">
          <Icon name="search" size={20} weight="bold" />
          <input
            className="input"
            type="search"
            placeholder="Поиск событий"
            aria-label="Поиск"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          />
        </label>
      </div>

      <section className="events-summary">
        <Icon name="events" size={64} className="summary-deco" />
        <div className="summary-head">
          <p className="summary-cap">Тренировок за неделю</p>
          <p className="summary-num">{weekCount}</p>
        </div>
        <div className="summary-next">
          <p className="summary-cap">Тренировки в ближайшее время</p>
          {nearest.length === 0 ? (
            <p className="summary-empty">Пока тренировок нет</p>
          ) : (
            nearest.map((e) => (
              <Link key={e.id} to={`/event/${e.id}`} className="summary-row">
                <SportIcon sport={e.sport} size={20} color="#ffffff" />
                <span className="summary-row-title">{e.title}</span>
                <span className="summary-row-when">
                  {formatDay(e.startsAt)} · {formatTime(e.startsAt)}
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      <FilterBar
        location={geo.location}
        onRequestLocation={geo.request}
        geoPending={geo.status === 'pending'}
        events={events}
        hideSearch
      />

      <div className="list-toolbar" data-tour="list">
        <span className="muted">{loading ? 'Загрузка…' : `Найдено: ${visible.length}`}</span>
        <div className="segmented">
          <button className={sort === 'time' ? 'is-on' : ''} onClick={() => setSort('time')}>
            По времени
          </button>
          <button
            className={sort === 'distance' ? 'is-on' : ''}
            onClick={() => {
              if (!geo.location) geo.request();
              setSort('distance');
            }}
          >
            Ближе ко мне
          </button>
        </div>
      </div>
      {sort === 'distance' && geo.status === 'denied' && (
        <p className="hint">Нет доступа к геопозиции — разрешите его, чтобы видеть ближайшие события.</p>
      )}

      {error && (
        <div className="empty">
          <p>Не удалось загрузить события: {error}</p>
          <button className="btn btn-ghost" onClick={reload}>
            Повторить
          </button>
        </div>
      )}

      {loading && !events.length && (
        <div className="stack">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton" />
          ))}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">
            <Icon name="search" size={40} />
          </div>
          <p>{hasFilters ? 'По этим фильтрам ничего нет.' : 'Пока нет событий.'}</p>
          {hasFilters && (
            <button className="btn btn-ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Сбросить фильтры
            </button>
          )}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.day || 'all'} className="stack">
          {g.day && <h2 className="day-title">{g.day}</h2>}
          {g.items.map((e) => (
            <EventCard key={e.id} event={e} location={geo.location} joined={myEventIds.has(e.id)} />
          ))}
        </section>
      ))}
    </div>
  );
}
