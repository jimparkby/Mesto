import { ArrowsDownUp, SlidersHorizontal } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { PersonCard } from '../components/People';
import { Sheet } from '../components/Sheet';
import { SportPicker } from '../components/SportPicker';
import { TopBar, TopBarButton } from '../components/TopBar';
import { SKILL_LEVELS, sportMeta } from '../domain/sports';
import type { Gender, Level, PeopleFilters, PeopleSort, PublicProfile, SportId } from '../domain/types';
import { useCity } from '../state';

const SORTS: { id: PeopleSort; label: string; coachOnly?: boolean }[] = [
  { id: 'rating', label: 'По рейтингу' },
  { id: 'new', label: 'Сначала новые' },
  { id: 'price', label: 'Дешевле', coachOnly: true },
];

/** Поиск игроков и тренеров: вид спорта, уровень, пол, город — и сразу написать в Telegram. */
export function SearchPage() {
  const { user } = useAuth();
  const { city } = useCity();
  const [role, setRole] = useState<'player' | 'coach'>('player');
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<SportId | null>(null);
  const [level, setLevel] = useState<Level | 'all'>('all');
  const [gender, setGender] = useState<Gender | null>(null);
  const [sort, setSort] = useState<PeopleSort>('rating');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [people, setPeople] = useState<PublicProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const f: PeopleFilters = { query, role, city, sport, level, gender, sort: role === 'player' && sort === 'price' ? 'rating' : sort };
    const t = setTimeout(
      () =>
        api
          .searchPeople(f)
          .then((list) => !cancelled && setPeople(list.filter((p) => p.id !== user?.id)))
          .catch((e) => !cancelled && setError((e as Error).message)),
      query ? 300 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, role, city, sport, level, gender, sort, user?.id]);

  const activeFilters = (sport ? 1 : 0) + (level !== 'all' ? 1 : 0) + (gender ? 1 : 0);

  return (
    <div className="page search-page">
      <TopBar
        title="Поиск"
        bell={false}
        actions={
          <>
            <TopBarButton label="Сортировка" onClick={() => setSortOpen(true)}>
              <ArrowsDownUp size={22} />
            </TopBarButton>
            <TopBarButton label="Фильтры" onClick={() => setFiltersOpen(true)} active={activeFilters > 0}>
              <SlidersHorizontal size={22} />
              {activeFilters > 0 && <span className="topbar-dot">{activeFilters}</span>}
            </TopBarButton>
          </>
        }
      />

      <div className="segmented full">
        <button className={role === 'player' ? 'is-on' : ''} onClick={() => setRole('player')}>
          Игроки
        </button>
        <button className={role === 'coach' ? 'is-on' : ''} onClick={() => setRole('coach')}>
          Тренеры
        </button>
      </div>

      <label className="search-box">
        <Icon name="search" size={22} weight="bold" />
        <input
          className="input"
          type="search"
          placeholder={role === 'player' ? 'Поиск игроков' : 'Поиск тренера'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {activeFilters > 0 && (
        <div className="chips-wrap">
          {sport && (
            <button className="chip is-on" onClick={() => setSport(null)}>
              {sportMeta(sport).label} ✕
            </button>
          )}
          {level !== 'all' && (
            <button className="chip is-on" onClick={() => setLevel('all')}>
              {SKILL_LEVELS.find((l) => l.id === level)?.label} ✕
            </button>
          )}
          {gender && (
            <button className="chip is-on" onClick={() => setGender(null)}>
              {gender === 'female' ? 'Женщины' : 'Мужчины'} ✕
            </button>
          )}
        </div>
      )}

      {error && <div className="card callout callout-danger">{error}</div>}
      {people === null && !error && [0, 1, 2].map((i) => <div key={i} className="card skeleton tall" />)}
      {people?.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">
            <Icon name="search" size={44} />
          </div>
          <p>
            {role === 'player' ? 'Игроков' : 'Тренеров'} по этим условиям в городе {city} пока нет.
          </p>
          <p className="muted">Попробуйте другой вид спорта или город — или создайте событие, и люди найдут вас сами.</p>
        </div>
      )}
      <div className="stack">
        {people?.map((p) => (
          <PersonCard key={p.id} p={p} sport={sport} />
        ))}
      </div>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Фильтры">
        <div className="field">
          <div className="label">Вид спорта</div>
          <SportPicker value={sport} onChange={setSport} allowNone />
        </div>
        <div className="field">
          <div className="label">Уровень{sport ? ` · ${sportMeta(sport).label}` : ''}</div>
          <div className="chips-wrap">
            <button className={`chip${level === 'all' ? ' is-on' : ''}`} onClick={() => setLevel('all')}>
              Любой
            </button>
            {SKILL_LEVELS.map((l) => (
              <button key={l.id} className={`chip${level === l.id ? ' is-on' : ''}`} onClick={() => setLevel(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <div className="label">Пол</div>
          <div className="chips-wrap">
            <button className={`chip${!gender ? ' is-on' : ''}`} onClick={() => setGender(null)}>
              Не важно
            </button>
            <button className={`chip${gender === 'female' ? ' is-on' : ''}`} onClick={() => setGender('female')}>
              Женский
            </button>
            <button className={`chip${gender === 'male' ? ' is-on' : ''}`} onClick={() => setGender('male')}>
              Мужской
            </button>
          </div>
        </div>
        <div className="sheet-actions">
          <button
            className="btn btn-ghost"
            onClick={() => {
              setSport(null);
              setLevel('all');
              setGender(null);
            }}
          >
            Сбросить
          </button>
          <button className="btn btn-primary btn-arrow" onClick={() => setFiltersOpen(false)}>
            Показать
          </button>
        </div>
      </Sheet>

      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Сортировка">
        <div className="city-list">
          {SORTS.filter((s) => !s.coachOnly || role === 'coach').map((s) => (
            <button
              key={s.id}
              className={`city-row${sort === s.id ? ' is-on' : ''}`}
              onClick={() => {
                setSort(s.id);
                setSortOpen(false);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="hint">Профили с Premium всегда показываются выше.</p>
      </Sheet>
    </div>
  );
}
