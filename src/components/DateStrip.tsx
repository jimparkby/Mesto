import { useEffect, useRef } from 'react';
import { dayKey, isoWeekday, WEEKDAYS } from '../domain/schedule';

/** Лента дней как в YClients: день недели, число, точка — есть занятия (полная — есть свободные места). */
export function DateStrip({
  days,
  selected,
  onSelect,
  marks,
}: {
  days: Date[];
  selected: string;
  onSelect: (key: string) => void;
  /** dayKey → 'free' (есть места) | 'full' (всё занято) */
  marks: Map<string, 'free' | 'full'>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.date-cell.is-on');
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [selected]);

  return (
    <div className="date-strip" ref={ref} role="tablist" aria-label="Дни">
      {days.map((d, i) => {
        const k = dayKey(d);
        const mark = marks.get(k);
        const monthStart = i === 0 || d.getDate() === 1;
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={selected === k}
            className={`date-cell${selected === k ? ' is-on' : ''}${mark ? '' : ' is-empty'}`}
            onClick={() => onSelect(k)}
          >
            <span className="date-cell-month">{monthStart ? d.toLocaleDateString('ru-RU', { month: 'short' }) : ' '}</span>
            <span className="date-cell-wd">{WEEKDAYS[isoWeekday(d) - 1].short}</span>
            <b className="date-cell-num">{d.getDate()}</b>
            <i className={`date-cell-dot${mark ? ` is-${mark}` : ''}`} />
          </button>
        );
      })}
    </div>
  );
}
