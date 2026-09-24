import { Lightning, MapPin, MapTrifold, Plus, SoccerBall, UsersThree, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { SportId } from '../domain/types';
import { platform } from '../platforms';
import { SportIcon } from './SportIcon';

const SLIDES: { Glyph: PhosphorIcon; Badge: PhosphorIcon; title: string; text: string }[] = [
  {
    Glyph: SoccerBall,
    Badge: MapPin,
    title: 'Тренировки и игры в двух шагах от дома',
    text: 'Футбол, бег, йога, воркаут — всё, что проходит рядом с тобой в Минске.',
  },
  {
    Glyph: MapTrifold,
    Badge: Lightning,
    title: 'Находи на карте и записывайся в один клик',
    text: 'Фильтры по виду спорта, дате, уровню и расстоянию. Места считаются в реальном времени.',
  },
  {
    Glyph: UsersThree,
    Badge: Plus,
    title: 'Собирай свою команду',
    text: 'Создай событие за минуту и поделись ссылкой прямо в Telegram.',
  },
];

const LAUNCH_TILES: SportId[] = [
  'running',
  'basketball',
  'tennis',
  'volleyball',
  'football',
  'cycling',
  'yoga',
  'workout',
  'swimming',
];

interface Props {
  onDone: () => void;
}

/** Первый запуск: Launch Screen → Walkthrough из трёх слайдов. */
export function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState<'launch' | number>('launch');
  const touchX = useRef<number | null>(null);

  const slide = typeof step === 'number' ? step : -1;
  const last = slide === SLIDES.length - 1;

  const go = (next: 'launch' | number) => {
    platform.haptic('selection');
    setStep(next);
  };

  // «Назад» в Telegram / Android листает слайды обратно.
  useEffect(() => {
    if (step === 'launch') return platform.setBackHandler(null);
    return platform.setBackHandler(() => go(slide === 0 ? 'launch' : slide - 1));
  }, [step, slide]);

  if (step === 'launch') {
    return (
      <div className="onb onb-launch">
        <div className="onb-art" aria-hidden>
          <div className="onb-tiles">
            {LAUNCH_TILES.map((t, i) => (
              <div key={t} className={`onb-tile${i === 4 ? ' is-hero' : ''}`}>
                <SportIcon sport={t} size={48} color={i === 4 ? '#6c151e' : '#f5dabf'} />
              </div>
            ))}
          </div>
          <div className="onb-shade" />
        </div>
        <h1 className="onb-launch-title">
          Находи события
          <br />
          рядом
        </h1>
        <p className="onb-launch-sub">Любительский спорт в Минске</p>
        <div className="onb-spacer" />
        <button className="btn btn-peach btn-arrow" onClick={() => go(0)}>
          Начать
        </button>
      </div>
    );
  }

  return (
    <div
      className="onb"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx < -50 && !last) go(slide + 1);
        else if (dx > 50) go(slide === 0 ? 'launch' : slide - 1);
      }}
    >
      <div className="onb-logo">
        Mes<b>to</b>
      </div>

      <div className="onb-viewport">
        <div className="onb-slides" style={{ transform: `translateX(-${slide * 100}%)` }}>
          {SLIDES.map((s, i) => (
            <section key={s.title} className="onb-slide" aria-hidden={i !== slide}>
              <div className="glass-tile" aria-hidden>
                <s.Glyph size={88} weight="fill" color="#9e212e" />
                <span className="glass-tile-badge">
                  <s.Badge size={26} weight="fill" color="#fff" />
                </span>
              </div>
              <h2 className="onb-slide-title">{s.title}</h2>
              <p className="onb-slide-text">{s.text}</p>
            </section>
          ))}
        </div>
      </div>

      <div className="onb-dots" aria-hidden>
        {SLIDES.map((s, i) => (
          <span key={s.title} className={i === slide ? 'is-on' : ''} />
        ))}
      </div>

      <button className="btn btn-peach btn-arrow" onClick={() => (last ? onDone() : go(slide + 1))}>
        {last ? 'Найти тренировку' : 'Далее'}
      </button>
      {!last ? (
        <button className="onb-skip" onClick={onDone}>
          Уже знаете, как всё устроено? <b>Пропустить</b>
        </button>
      ) : (
        <div className="onb-skip" aria-hidden />
      )}
    </div>
  );
}
