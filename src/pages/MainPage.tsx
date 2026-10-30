import {
  Backpack,
  Barbell,
  Basketball,
  CaretDown,
  ChartBar,
  MagnifyingGlass,
  Mountains,
  Volleyball,
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

/**
 * Главная страница макета: приветствие, крупное фото (заголовок и чипсы поверх него),
 * блоки ниже — объявление о тренере и два спортивных объявления, кнопка на ленту событий.
 */
export function MainPage() {
  return (
    <div className="st-page">
      <header className="st-head">
        <p className="st-hello">Привет, Данила!</p>
        <img className="st-avatar" src="start-avatar.png" alt="" width={36} height={36} />
      </header>

      <section className="st-hero">
        <img className="st-hero-img" src="basket.jpg" alt="" />
        <h1 className="st-title">
          Найди свою спортивную{' '}
          <span className="st-accent">
            Компанию
            <CaretDown weight="fill" size={20} className="st-caret" />
          </span>
        </h1>
        <div className="st-chips">
          <button type="button" className="st-chip st-chip-icon" aria-label="Поиск">
            <MagnifyingGlass weight="fill" size={14} />
          </button>
          <button type="button" className="st-chip">
            <Mountains weight="fill" size={13} />
            Slopes
          </button>
          <button type="button" className="st-chip">
            <Barbell weight="fill" size={13} />
            Workouts
          </button>
          <button type="button" className="st-chip">
            <ChartBar weight="fill" size={13} />
            Stats
          </button>
          <button type="button" className="st-chip">
            <Backpack weight="fill" size={13} />
            Gear
          </button>
        </div>
      </section>

      <section className="st-grid">
        <article className="st-card st-coach">
          <p className="st-label">Тренер</p>
          <h2 className="st-coach-title">Алексей Волков</h2>
          <p className="st-coach-sub">Баскетбол · 10 лет опыта</p>
          <img className="st-coach-photo" src="coach.jpg" alt="" />
        </article>

        <article className="st-card st-mini">
          <div className="st-mini-top">
            <Basketball weight="fill" size={15} className="st-mini-icon" />
            <p className="st-label">Баскетбол</p>
          </div>
          <p className="st-mini-title">Тренировка 3×3</p>
          <p className="st-mini-foot">Сегодня · 19:00</p>
        </article>

        <article className="st-card st-mini">
          <div className="st-mini-top">
            <Volleyball weight="fill" size={15} className="st-mini-icon" />
            <p className="st-label">Волейбол</p>
          </div>
          <p className="st-mini-title">Открытая игра</p>
          <p className="st-mini-foot">Завтра · 18:00</p>
        </article>
      </section>

      <Link to="/events" className="st-more">
        Посмотреть больше
      </Link>
    </div>
  );
}
