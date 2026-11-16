import { useMemo, useState } from 'react';
import { POPULAR_SPORTS, SPORT_GROUPS, SPORTS, sportMeta } from '../domain/sports';
import type { SportId } from '../domain/types';
import { Icon } from './Icon';
import { SportIcon } from './SportIcon';

interface Single {
  value: SportId | null;
  onChange: (id: SportId | null) => void;
  allowNone?: boolean;
  multi?: false;
}

interface Multi {
  values: SportId[];
  onToggle: (id: SportId) => void;
  multi: true;
}

/**
 * Выбор вида спорта из каталога 80+: поиск по названию, популярные сверху, остальные — по группам.
 * Режимы: один вид (фильтр, событие) или несколько (спортивный паспорт).
 */
export function SportPicker(props: Single | Multi) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const selected = props.multi ? props.values : props.value ? [props.value] : [];

  const q = query.trim().toLowerCase();
  const found = useMemo(() => (q ? SPORTS.filter((s) => s.label.toLowerCase().includes(q)) : []), [q]);

  const pick = (id: SportId) => {
    if (props.multi) props.onToggle(id);
    else props.onChange(props.value === id && props.allowNone ? null : id);
  };

  const chip = (id: SportId) => {
    const m = sportMeta(id);
    const on = selected.includes(id);
    return (
      <button type="button" key={id} className={`chip${on ? ' is-on' : ''}`} onClick={() => pick(id)}>
        <SportIcon sport={id} size={18} color={on ? undefined : m.color} />
        {m.label}
      </button>
    );
  };

  // Выбранные, но не популярные — тоже наверху, чтобы их было видно.
  const top = [...new Set([...selected, ...POPULAR_SPORTS])];

  return (
    <div className="sport-picker2">
      <label className="search-box search-box-sm">
        <Icon name="search" size={18} weight="bold" />
        <input
          className="input"
          type="search"
          placeholder={`Найти среди ${SPORTS.length} видов спорта`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {q ? (
        <div className="chips-wrap">
          {found.map((s) => chip(s.id))}
          {found.length === 0 && <span className="muted">Не нашли — выберите «Другое» и уточните в описании.</span>}
        </div>
      ) : (
        <>
          {!props.multi && props.allowNone && (
            <div className="chips-wrap">
              <button type="button" className={`chip${!props.value ? ' is-on' : ''}`} onClick={() => props.onChange(null)}>
                Все виды спорта
              </button>
            </div>
          )}
          <div className="chips-wrap">{top.map(chip)}</div>
          {showAll ? (
            SPORT_GROUPS.map((g) => {
              const list = SPORTS.filter((s) => s.group === g.id && !top.includes(s.id));
              if (!list.length) return null;
              return (
                <div key={g.id} className="sport-group">
                  <div className="sport-group-title">{g.label}</div>
                  <div className="chips-wrap">{list.map((s) => chip(s.id))}</div>
                </div>
              );
            })
          ) : (
            <button type="button" className="link sport-more" onClick={() => setShowAll(true)}>
              Все виды спорта ({SPORTS.length})
            </button>
          )}
        </>
      )}
    </div>
  );
}
