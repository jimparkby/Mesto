import { useState } from 'react';
import { countActiveFilters, DATE_RANGES, DEFAULT_FILTERS, RADII } from '../domain/filters';
import { LEVELS, SPORTS } from '../domain/sports';
import type { LatLng, SportId } from '../domain/types';
import { useFilters } from '../state';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

interface Props {
  location: LatLng | null;
  onRequestLocation: () => void;
  geoPending?: boolean;
}

export function FilterBar({ location, onRequestLocation, geoPending }: Props) {
  const { filters, setFilters } = useFilters();
  const [open, setOpen] = useState(false);
  const active = countActiveFilters(filters);

  const toggleSport = (id: SportId) =>
    setFilters((f) => ({
      ...f,
      sports: f.sports.includes(id) ? f.sports.filter((s) => s !== id) : [...f.sports, id],
    }));

  return (
    <div className="filterbar">
      <div className="search-row">
        <label className="search-box">
          <Icon name="search" size={20} />
          <input
            className="input"
            type="search"
            placeholder="Поиск событий"
            aria-label="Поиск"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          />
        </label>
        <button className={`btn-icon${active ? ' is-active' : ''}`} onClick={() => setOpen(true)} aria-label="Фильтры">
          <Icon name="filter" size={22} />
          {active > 0 && <span className="dot">{active}</span>}
        </button>
      </div>

      <div className="chips-scroll">
        <button
          className={`chip${filters.date === 'today' ? ' is-on' : ''}`}
          onClick={() => setFilters((f) => ({ ...f, date: f.date === 'today' ? 'all' : 'today' }))}
        >
          Сегодня
        </button>
        <button
          className={`chip${filters.radiusKm ? ' is-on' : ''}`}
          onClick={() => {
            if (!location) onRequestLocation();
            setFilters((f) => ({ ...f, radiusKm: f.radiusKm ? null : 3 }));
          }}
        >
          <Icon name="pin" size={16} />
          {geoPending ? '…' : 'Рядом'}
        </button>
        {SPORTS.map((s) => (
          <button
            key={s.id}
            className={`chip${filters.sports.includes(s.id) ? ' is-on' : ''}`}
            onClick={() => toggleSport(s.id)}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Фильтры">
        <div className="field">
          <div className="label">Когда</div>
          <div className="chips-wrap">
            {DATE_RANGES.map((d) => (
              <button
                key={d.id}
                className={`chip${filters.date === d.id ? ' is-on' : ''}`}
                onClick={() => setFilters((f) => ({ ...f, date: d.id }))}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="label">Уровень</div>
          <div className="chips-wrap">
            <button
              className={`chip${filters.level === 'all' ? ' is-on' : ''}`}
              onClick={() => setFilters((f) => ({ ...f, level: 'all' }))}
            >
              Любой
            </button>
            {LEVELS.filter((l) => l.id !== 'any').map((l) => (
              <button
                key={l.id}
                className={`chip${filters.level === l.id ? ' is-on' : ''}`}
                onClick={() => setFilters((f) => ({ ...f, level: l.id }))}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="label">Расстояние от меня</div>
          <div className="chips-wrap">
            <button
              className={`chip${!filters.radiusKm ? ' is-on' : ''}`}
              onClick={() => setFilters((f) => ({ ...f, radiusKm: null }))}
            >
              Весь Минск
            </button>
            {RADII.map((r) => (
              <button
                key={r}
                className={`chip${filters.radiusKm === r ? ' is-on' : ''}`}
                onClick={() => {
                  if (!location) onRequestLocation();
                  setFilters((f) => ({ ...f, radiusKm: r }));
                }}
              >
                до {r} км
              </button>
            ))}
          </div>
          {filters.radiusKm && !location && <p className="hint">Разрешите доступ к геопозиции, чтобы фильтр заработал.</p>}
        </div>

        <label className="switch-row">
          <span>Только бесплатные</span>
          <input
            className="switch"
            type="checkbox"
            checked={filters.freeOnly}
            onChange={(e) => setFilters((f) => ({ ...f, freeOnly: e.target.checked }))}
          />
        </label>

        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={() => setFilters({ ...DEFAULT_FILTERS, query: filters.query })}>
            Сбросить
          </button>
          <button className="btn btn-primary" onClick={() => setOpen(false)}>
            Показать
          </button>
        </div>
      </Sheet>
    </div>
  );
}
