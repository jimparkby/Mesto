import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api';
import { EventCard } from '../components/EventCard';
import { FilterBar } from '../components/FilterBar';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { formatDay, isPast } from '../domain/events';
import { applyFilters, countActiveFilters, DEFAULT_FILTERS, sortEvents } from '../domain/filters';
import { useEvents, useGeolocation } from '../hooks';
import { useFilters } from '../state';

export function HomePage() {
  const { user, myEventIds } = useAuth();
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

  const hasFilters = countActiveFilters(filters) > 0 || filters.query !== '';

  return (
    <div className="page">
      <PageHeader eyebrow="Спорт рядом · Минск" title={user ? `Привет, ${user.name.split(' ')[0]}!` : 'СпортРядом'}>
        {api.mode === 'demo' && <span className="badge badge-muted" title="Данные хранятся на устройстве">демо-режим</span>}
      </PageHeader>

      <FilterBar location={geo.location} onRequestLocation={geo.request} geoPending={geo.status === 'pending'} />

      <div className="list-toolbar">
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
