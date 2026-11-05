import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api';
import { EventCard } from '../components/EventCard';
import { FilterBar } from '../components/FilterBar';
import { Icon } from '../components/Icon';
import { isPast } from '../domain/events';
import { applyFilters, countActiveFilters, DEFAULT_FILTERS, sortEvents } from '../domain/filters';
import { useEvents, useGeolocation } from '../hooks';
import { useFilters } from '../state';
import { CaretDown } from '@phosphor-icons/react';

export function HomePage() {
  const { myEventIds } = useAuth();
  const { events, loading, error, reload } = useEvents();
  const { filters, setFilters, sort, setSort } = useFilters();
  const geo = useGeolocation();

  const visible = useMemo(() => {
    const upcoming = events.filter((e) => !isPast(e));
    return sortEvents(applyFilters(upcoming, filters, geo.location), sort, geo.location);
  }, [events, filters, sort, geo.location]);

  const hasFilters = countActiveFilters(filters) > 0 || filters.query !== '';

  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="page events-page">
      <header className="events-head">
        <div className="events-head-text">
          <h1 className="events-title">События</h1>
          {api.mode === 'demo' && (
            <span className="badge badge-muted" title="Данные хранятся на устройстве">
              демо-режим
            </span>
          )}
        </div>
        <Link to="/create" className="btn btn-primary btn-arrow btn-block events-create">
          <Icon name="plus" size={20} weight="bold" />
          Создать событие
        </Link>
      </header>

      <div className="search-row">
        <label className="search-box">
          <Icon name="search" size={22} weight="bold" />
          <input
            className="input"
            type="search"
            placeholder="Поиск событий…"
            aria-label="Поиск"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          />
        </label>
        <button className="btn-icon" onClick={() => setFiltersOpen(!filtersOpen)} aria-label="Фильтры">
          <Icon name="filter" size={22} weight="bold" />
          {hasFilters && <span className="dot">{countActiveFilters(filters)}</span>}
        </button>
      </div>

      <div className="quick-chips">
        <button
          className={`chip${filters.date === 'today' ? ' is-on' : ''}`}
          onClick={() => setFilters((f) => ({ ...f, date: f.date === 'today' ? 'all' : 'today' }))}
        >
          Сегодня
        </button>
        <button
          className={`chip${filters.radiusKm ? ' is-on' : ''}`}
          onClick={() => {
            if (!geo.location) geo.request();
            setFilters((f) => ({ ...f, radiusKm: f.radiusKm ? null : 3 }));
          }}
        >
          <Icon name="near" size={18} className="chip-icon" />
          {geo.location ? 'Рядом' : 'Местоположение'}
        </button>
        <button className="chip chip-expand" onClick={() => setFiltersOpen(!filtersOpen)}>
          <CaretDown size={16} weight="bold" />
          Фильтры
        </button>
      </div>

      {filtersOpen && (
        <FilterBar
          location={geo.location}
          onRequestLocation={geo.request}
          geoPending={geo.status === 'pending'}
          events={events}
          hideSearch
        />
      )}

      <div className="list-toolbar">
        <span className="muted">
          {loading ? 'Загрузка…' : `Найдено: ${visible.length}`}
        </span>
        <div className="segmented sort-toggle">
          <button
            className={sort === 'time' ? 'is-on' : ''}
            onClick={() => setSort('time')}
          >
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
          <div className="empty-emoji">
            <Icon name="search" size={48} />
          </div>
          <p>Не удалось загрузить события.</p>
          <button className="btn btn-ghost" onClick={reload}>
            Повторить
          </button>
        </div>
      )}

      {loading && !events.length && (
        <div className="stack">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton tall" />
          ))}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">
            <Icon name="search" size={48} />
          </div>
          <p>{hasFilters ? 'По этим фильтрам ничего нет.' : 'Пока нет событий.'}</p>
          {hasFilters && (
            <button className="btn btn-ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Сбросить фильтры
            </button>
          )}
        </div>
      )}

      {visible.map((e) => (
        <EventCard key={e.id} event={e} location={geo.location} joined={myEventIds.has(e.id)} />
      ))}
    </div>
  );
}
