import { useEffect, useState } from 'react';
import { SPORT_SCALES, scaleFor } from '../domain/levels';
import { sportMeta } from '../domain/sports';
import type { SportId } from '../domain/types';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { SportIcon } from './SportIcon';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Вид спорта, чья справка откроется сразу; иначе — список видов спорта. */
  initialSport?: SportId | null;
}

function pluralDivisions(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return `${n} деление`;
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return `${n} деления`;
  return `${n} делений`;
}

/** Справка по уровням: список видов спорта и отдельное окно с делениями каждого из них. */
export function LevelsInfoSheet({ open, onClose, initialSport = null }: Props) {
  const [selected, setSelected] = useState<SportId | null>(initialSport);

  useEffect(() => {
    if (open) setSelected(initialSport);
  }, [open, initialSport]);

  const meta = selected ? sportMeta(selected) : null;
  const scale = selected ? scaleFor(selected) : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={meta && scale ? `${meta.label} — ${scale.title}` : 'Уровни и деления'}
    >
      {!selected && (
        <>
          <p className="hint">
            Выберите вид спорта — откроется отдельное окно с его делениями и подробным описанием уровней.
          </p>
          <div className="level-sports">
            {SPORT_SCALES.map((s) => {
              const m = sportMeta(s.sport);
              return (
                <button key={s.sport} className="level-sport-row" onClick={() => setSelected(s.sport)}>
                  <SportIcon sport={s.sport} size={20} color={m.color} />
                  <span className="level-sport-body">
                    <span className="level-sport-name">{m.label}</span>
                    <span className="level-sport-scale">{s.title}</span>
                  </span>
                  <span className="level-sport-count">{pluralDivisions(s.divisions.length)}</span>
                  <Icon name="chevron" size={16} className="level-sport-chev" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {selected && scale && (
        <>
          <div className="chips-wrap level-sport-chips">
            {SPORT_SCALES.map((s) => {
              const on = s.sport === selected;
              const m = sportMeta(s.sport);
              return (
                <button
                  key={s.sport}
                  className={`chip${on ? ' is-on' : ''}`}
                  onClick={() => setSelected(s.sport)}
                >
                  <SportIcon sport={s.sport} size={16} color={on ? undefined : m.color} />
                  {m.label}
                </button>
              );
            })}
          </div>
          {scale.note && <p className="hint">{scale.note}</p>}
          <ul className="level-list">
            {scale.divisions.map((d) => (
              <li className="level-row" key={d.tag}>
                <span className="level-tag">{d.tag}</span>
                <div className="level-body">
                  <div className="level-name">{d.label}</div>
                  <p className="level-desc">{d.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="sheet-actions">
        {selected ? (
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>
            Все виды спорта
          </button>
        ) : (
          <span />
        )}
        <button className="btn btn-primary btn-arrow" onClick={onClose}>
          Понятно
        </button>
      </div>
    </Sheet>
  );
}
