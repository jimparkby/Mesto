import { useMemo, useState } from 'react';
import { Info } from '@phosphor-icons/react';
import { isPast } from '../domain/events';
import { countActiveFilters, DATE_RANGES, DEFAULT_FILTERS, RADII } from '../domain/filters';
import { scaleFor, type Division } from '../domain/levels';
import { EVENT_TYPES, LEVELS, SPORTS } from '../domain/sports';
import type { EventType, LatLng, Level, SportEvent, SportId } from '../domain/types';
import { useFilters } from '../state';
import { Icon } from './Icon';
import { LevelsInfoSheet } from './LevelsInfoSheet';
import { Sheet } from './Sheet';
import { SportIcon } from './SportIcon';

interface Props {
  location: LatLng | null;
  onRequestLocation: () => void;
  geoPending?: boolean;
  /** События для расчёта популярных видов спорта. Без них — фиксированный топ. */
  events?: SportEvent[];
}

/** Сколько популярных видов спорта показывать в карусели (остальные — через «Ещё»). */
const POPULAR_LIMIT = 5;
const FALLBACK_POPULAR: SportId[] = ['football', 'basketball', 'volleyball', 'running', 'tennis'];

export function FilterBar({ location, onRequestLocation, geoPending, events }: Props) {
  const { filters, setFilters } = useFilters();
  const [open, setOpen] = useState(false);
  const [allSportsOpen, setAllSportsOpen] = useState(false);
  const [levelsInfoOpen, setLevelsInfoOpen] = useState(false);
  const [sportQuery, setSportQuery] = useState('');
  const active = countActiveFilters(filters);

  const toggleSport = (id: SportId) =>
    setFilters((f) => {
      const sports = f.sports.includes(id) ? f.sports.filter((s) => s !== id) : [...f.sports, id];
      // Деление действует только пока выбран ровно один «свой» вид спорта.
      const dropDivision = !!f.division && !(sports.length === 1 && sports[0] === f.division.sport);
      return {
        ...f,
        sports,
        division: dropDivision ? null : f.division,
        level: dropDivision ? 'all' : f.level,
      };
    });

  // Деления показываются, когда выбран ровно один вид спорта.
  const soloSport = filters.sports.length === 1 ? filters.sports[0] : null;
  const scale = soloSport ? scaleFor(soloSport) : undefined;

  const pickLevel = (level: Level | 'all') =>
    setFilters((f) => ({ ...f, level, division: null }));

  const pickDivision = (sport: SportId, d: Division) =>
    setFilters((f) => ({ ...f, level: d.level, division: { sport, tag: d.tag } }));

  // Топ видов спорта по числу предстоящих событий; выбранные всегда остаются видимыми.
  const visibleSports = useMemo(() => {
    const counts = new Map<SportId, number>();
    if (events) {
      for (const e of events) {
        if (e.status !== 'published' || isPast(e)) continue;
        counts.set(e.sport, (counts.get(e.sport) ?? 0) + 1);
      }
    }
    const top =
      counts.size > 0
        ? [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, POPULAR_LIMIT)
            .map(([id]) => id)
        : [...FALLBACK_POPULAR];
    for (const s of filters.sports) if (!top.includes(s)) top.push(s);
    return SPORTS.filter((s) => top.includes(s.id)).map((s) => s.id);
  }, [events, filters.sports]);

  const filteredAll = useMemo(() => {
    const q = sportQuery.trim().toLowerCase();
    return q ? SPORTS.filter((s) => s.label.toLowerCase().includes(q)) : SPORTS;
  }, [sportQuery]);

  const closeAllSports = () => {
    setAllSportsOpen(false);
    setSportQuery('');
  };

  return (
    <div className="filterbar">
      <div className="segmented full type-segment" role="tablist" aria-label="Тип события" data-tour="types">
        <button
          className={filters.eventType === 'all' ? 'is-on' : ''}
          onClick={() => setFilters((f) => ({ ...f, eventType: 'all' }))}
        >
          Все
        </button>
        {EVENT_TYPES.map((t) => (
          <button
            key={t.id}
            className={filters.eventType === t.id ? 'is-on' : ''}
            onClick={() => setFilters((f) => ({ ...f, eventType: t.id as EventType }))}
          >
            {t.plural}
          </button>
        ))}
      </div>

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
        <button className={`btn-icon${active ? ' is-active' : ''}`} onClick={() => setOpen(true)} aria-label="Фильтры">
          <Icon name="filter" size={22} weight="bold" />
          {active > 0 && <span className="dot">{active}</span>}
        </button>
      </div>

      <div className="chips-scroll" data-tour="chips">
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
          <Icon name="near" size={16} className="chip-icon" />
          {geoPending ? '…' : 'Рядом'}
        </button>
        {visibleSports.map((id) => {
          const s = SPORTS.find((x) => x.id === id)!;
          const on = filters.sports.includes(s.id);
          return (
            <button key={s.id} className={`chip${on ? ' is-on' : ''}`} onClick={() => toggleSport(s.id)}>
              <SportIcon sport={s.id} size={18} color={on ? undefined : s.color} />
              {s.label}
            </button>
          );
        })}
        <button className="chip chip-more" onClick={() => setAllSportsOpen(true)}>
          <Icon name="dots" size={18} />
          Ещё
        </button>
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
          <div className="label label-row">
            Уровень
            <button
              type="button"
              className="label-info"
              aria-label="Что значат уровни и деления"
              onClick={() => setLevelsInfoOpen(true)}
            >
              <Info size={14} weight="fill" />
            </button>
          </div>
          <div className="chips-wrap">
            <button
              className={`chip${filters.level === 'all' && !filters.division ? ' is-on' : ''}`}
              onClick={() => pickLevel('all')}
            >
              Любой
            </button>
            {scale ? (
              scale.divisions.map((d) => {
                const on = filters.division?.sport === scale.sport && filters.division.tag === d.tag;
                return (
                  <button
                    key={d.tag}
                    className={`chip${on ? ' is-on' : ''}`}
                    onClick={() => pickDivision(scale.sport, d)}
                  >
                    {d.tag}
                  </button>
                );
              })
            ) : (
              LEVELS.filter((l) => l.id !== 'any').map((l) => (
                <button
                  key={l.id}
                  className={`chip${filters.level === l.id && !filters.division ? ' is-on' : ''}`}
                  onClick={() => pickLevel(l.id)}
                >
                  {l.label}
                </button>
              ))
            )}
          </div>
          {scale && (
            <p className="hint">
              Деления: {scale.title}. Что значат — по значку ⓘ рядом с «Уровень».
            </p>
          )}
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
          <button className="btn btn-primary btn-arrow" onClick={() => setOpen(false)}>
            Показать
          </button>
        </div>
      </Sheet>

      <Sheet open={allSportsOpen} onClose={closeAllSports} title="Все виды спорта">
        <label className="search-box sheet-search">
          <Icon name="search" size={20} weight="bold" />
          <input
            className="input"
            type="search"
            placeholder="Найти вид спорта"
            aria-label="Найти вид спорта"
            value={sportQuery}
            onChange={(e) => setSportQuery(e.target.value)}
          />
        </label>
        <div className="chips-wrap">
          {filteredAll.map((s) => {
            const on = filters.sports.includes(s.id);
            return (
              <button key={s.id} className={`chip${on ? ' is-on' : ''}`} onClick={() => toggleSport(s.id)}>
                <SportIcon sport={s.id} size={18} color={on ? undefined : s.color} />
                {s.label}
              </button>
            );
          })}
          {filteredAll.length === 0 && <p className="muted">Ничего не нашлось</p>}
        </div>
        <div className="sheet-actions">
          <button
            className="btn btn-ghost"
            onClick={() => {
              setFilters((f) => ({ ...f, sports: [] }));
              setSportQuery('');
            }}
          >
            Сбросить
          </button>
          <button className="btn btn-primary btn-arrow" onClick={closeAllSports}>
            Готово
          </button>
        </div>
      </Sheet>

      <LevelsInfoSheet
        open={levelsInfoOpen}
        onClose={() => setLevelsInfoOpen(false)}
        initialSport={soloSport}
      />
    </div>
  );
}
