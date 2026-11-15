import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LatLng } from '../domain/types';
import { Icon } from './Icon';
import { MapView } from './MapView';

interface Props {
  /** Отмеченная точка (или найденная по адресу, если точку ещё не ставили). */
  value: LatLng | null;
  onPick: (p: LatLng) => void;
  /** Подпись под картой: адрес выбранного места. */
  caption?: string | null;
}

/**
 * Выбор точки: маленькое превью в форме, по нажатию — карта на весь экран,
 * где удобно двигать и приближать карту и ставить метку.
 */
export function MapPicker({ value, onPick, caption }: Props) {
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [full]);

  return (
    <>
      <div className="card no-pad map-pick-widget">
        <MapView pick={{ value, onPick: () => {} }} center={value ?? undefined} className="map-pick" zoom={value ? 14 : 11} />
        <button type="button" className="map-pick-open" onClick={() => setFull(true)}>
          <span className="map-pick-open-label">
            <Icon name="map" size={16} /> {value ? 'Изменить точку' : 'Открыть карту и отметить место'}
          </span>
        </button>
      </div>

      {full &&
        createPortal(
          <div className="map-full" role="dialog" aria-label="Выбор места на карте">
            <MapView pick={{ value, onPick }} className="map-full-map" zoom={value ? 15 : 12} />
            <div className="map-full-top">
              <div className="map-full-hint">{value ? caption || 'Точка отмечена' : 'Нажмите на карту, чтобы отметить место'}</div>
            </div>
            <div className="map-full-bottom">
              <button type="button" className="btn btn-primary btn-block" onClick={() => setFull(false)}>
                {value ? 'Готово' : 'Закрыть'}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
