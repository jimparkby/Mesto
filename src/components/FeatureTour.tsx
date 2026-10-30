import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { platform } from '../platforms';

interface TourStep {
  selector: string;
  title: string;
  text: string;
}

/** Пошаговые подсказки по главному экрану: выделяем блок и объясняем, зачем он. */
const STEPS: TourStep[] = [
  {
    selector: '[data-tour="types"]',
    title: 'Тип события',
    text: 'Переключай между всеми событиями, только тренировками или играми.',
  },
  {
    selector: '[data-tour="chips"]',
    title: 'Быстрые фильтры',
    text: '«Сегодня», «Рядом» и виды спорта — в один тап. Остальные — в кнопке «Ещё».',
  },
  {
    selector: '[data-tour="list"]',
    title: 'Сортировка',
    text: 'По времени или ближе ко мне — как тебе удобнее смотреть список.',
  },
  {
    selector: '.event-card',
    title: 'Карточка события',
    text: 'Всё главное — место, время, уровень и сколько мест осталось. Жми, чтобы записаться.',
  },
  {
    selector: '[data-tour="tab-map"]',
    title: 'Карта',
    text: 'Смотри, что проходит рядом, — события отмечены цветными метками.',
  },
  {
    selector: '[data-tour="tab-create"]',
    title: 'Своя игра или тренировка',
    text: 'Создай событие за минуту и поделись ссылкой — команда найдётся.',
  },
];

const PAD = 8;
const TOOLTIP_GAP = 12;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface Props {
  onDone: () => void;
}

/** Интерактивный тур: подсвечивает элементы главного экрана и ждёт «Далее». */
export function FeatureTour({ onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);

  const last = index === STEPS.length - 1;

  // Тур всегда стартует на ленте событий.
  useEffect(() => {
    if (location.pathname !== '/events') navigate('/events', { replace: true });
  }, [location.pathname, navigate]);

  const measure = useCallback((i: number) => {
    const step = STEPS[i];
    if (!step) return false;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    setRect({
      top: Math.max(PAD, r.top - PAD),
      left: Math.max(PAD, r.left - PAD),
      width: Math.min(r.width + PAD * 2, window.innerWidth - PAD * 2),
      height: Math.min(r.height + PAD * 2, window.innerHeight - PAD * 2),
    });
    return true;
  }, []);

  // Ищем целевой блок в течение ~1с (список событий подгружается асинхронно); если нет — пропускаем шаг.
  useEffect(() => {
    setRect(null);
    let raf = 0;
    let tries = 0;
    const tick = () => {
      const el = document.querySelector(STEPS[index]?.selector ?? '') as HTMLElement | null;
      if (el && el.getBoundingClientRect().height > 0) {
        el.scrollIntoView({ block: 'center' });
      }
      if (measure(index)) return;
      if (++tries < 60) raf = requestAnimationFrame(tick);
      // Шаг недоступен (например, нет событий) — пропускаем; если шаг последний — завершаем тур.
      else if (index >= STEPS.length - 1) onDone();
      else setIndex((i) => i + 1);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, location.key, measure]);

  // Пересчитываем подсветку при скролле и повороте экрана.
  useEffect(() => {
    const onMove = () => measure(index);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [index, measure]);

  // «Назад» в Telegram / Android пропускает тур, чтобы не блокировать выход.
  useEffect(() => {
    const prev = platform.setBackHandler(() => onDone());
    return prev;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Расставляем карточку подсказки после измерения блока.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!rect || !card) return;
    const ch = card.offsetHeight;
    const cw = Math.min(340, window.innerWidth - 32);
    const left = clamp(rect.left + rect.width / 2 - cw / 2, 16, window.innerWidth - cw - 16);
    let top = rect.top - ch - TOOLTIP_GAP;
    if (top < 12) {
      top = rect.top + rect.height + TOOLTIP_GAP;
      if (top + ch > window.innerHeight - 12) top = Math.max(12, (window.innerHeight - ch) / 2);
    }
    card.style.width = `${cw}px`;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }, [rect, index]);

  const goNext = () => {
    platform.haptic('selection');
    if (last) onDone();
    else setIndex((i) => i + 1);
  };

  const step = STEPS[index];
  if (!step) return null;

  return (
    <div className="tour-overlay" role="dialog" aria-label="Подсказки по приложению">
      {rect && (
        <div
          className="tour-spot"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden
        />
      )}
      <div className="tour-card" ref={cardRef} style={{ visibility: rect ? 'visible' : 'hidden' }}>
        <div>
          <div className="tour-title">{step.title}</div>
          <p className="tour-text">{step.text}</p>
        </div>
        <div className="tour-foot">
          <div className="tour-dots" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s.selector} className={i === index ? 'is-on' : ''} />
            ))}
          </div>
          <div className="tour-actions">
            <button className="tour-skip" onClick={onDone}>
              Пропустить
            </button>
            <button className="btn btn-primary" onClick={goNext}>
              {last ? 'Понятно' : 'Далее'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
