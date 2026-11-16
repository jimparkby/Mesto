import { CalendarBlank, GenderFemale, GenderMale, Info, MapPin, Play, Translate, X } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { isPast } from '../domain/events';
import { isVideoUrl } from '../domain/media';
import { ageFrom, formatRating, genderLabel, lastSeenLabel, priceLabel, yearsLabel } from '../domain/people';
import { levelLabel, sportMeta } from '../domain/sports';
import type { PublicProfile, SportEvent, SportId } from '../domain/types';
import { CoachSessionCard } from './GameCards';
import { Icon } from './Icon';
import { LevelsInfoSheet } from './LevelsInfoSheet';
import { PersonAvatar, PremiumBadge } from './People';
import { Sheet } from './Sheet';
import { SportIcon } from './SportIcon';

const RATING_INFO = {
  vibe: 'Атмосфера: приятно ли играть с человеком — пунктуальность, настрой, уважение к партнёрам.',
  levelFit: 'Совпадение уровня: насколько заявленный в паспорте уровень совпал с реальной игрой.',
  effectiveness: 'Эффективность тренировок: оценка тренера учениками после занятий.',
};

/** Профиль человека в стиле спортивного паспорта: карточка, информация, спорт, фото, видео. */
export function ProfileView({
  profile: p,
  events = [],
  headerExtra,
  children,
}: {
  profile: PublicProfile;
  /** Ближайшие события человека (для тренера — его занятия). */
  events?: SportEvent[];
  headerExtra?: ReactNode;
  children?: ReactNode;
}) {
  const [viewer, setViewer] = useState<string | null>(null);
  const [ratingInfo, setRatingInfo] = useState(false);
  const [levelsSport, setLevelsSport] = useState<SportId | null>(null);
  const age = ageFrom(p.birthDate);
  const seen = lastSeenLabel(p.lastSeenAt, p.gender);
  const online = seen === 'Онлайн';
  const upcoming = events.filter((e) => !isPast(e) && e.status === 'published');
  const GenderGlyph = p.gender === 'female' ? GenderFemale : GenderMale;

  return (
    <>
      <section className={`card profile-card${p.premium ? ' is-premium' : ''}`}>
        <PersonAvatar name={p.name} photoUrl={p.photoUrl} size={64} premium={p.premium} online={online} />
        <div className="profile-card-body">
          <div className="profile-card-name">
            {p.name}
            {p.premium && <PremiumBadge small />}
          </div>
          <button type="button" className="profile-card-ratings" onClick={() => setRatingInfo(true)}>
            {p.isCoach ? (
              <span>
                Эффективность <b>{formatRating(p.ratings.effectiveness)}</b>
              </span>
            ) : (
              <>
                <span>
                  Vibe <b>{formatRating(p.ratings.vibe)}</b>
                </span>
                <span>
                  Level fit <b>{formatRating(p.ratings.levelFit)}</b>
                </span>
              </>
            )}
            <Info size={14} weight="fill" className="muted" />
          </button>
          {p.isCoach && <span className="badge badge-coach">Тренер</span>}
        </div>
        {seen && <span className={`online-pill${online ? ' is-on' : ''}`}>{seen}</span>}
        {headerExtra}
      </section>

      <section className="card info-card">
        <h2 className="card-h">Информация</h2>
        <ul className="info-list">
          {p.gender && (
            <li>
              <GenderGlyph size={20} /> {genderLabel(p.gender)}
            </li>
          )}
          {age !== null && (
            <li>
              <CalendarBlank size={20} /> {yearsLabel(age)}
            </li>
          )}
          {p.languages.length > 0 && (
            <li>
              <Translate size={20} /> {p.languages.join(', ')}
            </li>
          )}
          <li>
            <MapPin size={20} /> {p.city}
          </li>
        </ul>
        {p.bio ? <p className="info-bio prewrap">{p.bio}</p> : <p className="info-bio muted">Пока ничего о себе не рассказал(а).</p>}
      </section>

      <h2 className="section-label">Спорт</h2>
      {p.skills.length === 0 ? (
        <div className="card muted">Виды спорта не указаны.</div>
      ) : (
        <div className="card skills-card">
          {p.skills.map((s) => {
            const m = sportMeta(s.sport);
            return (
              <button key={s.sport} type="button" className="skill-row" onClick={() => setLevelsSport(s.sport)}>
                <span className="skill-icon">
                  <SportIcon sport={s.sport} size={22} color={m.color} />
                </span>
                <span className="skill-body">
                  <b>{m.label}</b>
                  <span className="muted">
                    {p.isCoach
                      ? [s.years ? `Обучает ${yearsLabel(s.years)}` : null, s.price ? `${priceLabel(s.price)} за занятие` : null, levelLabel(s.level)]
                          .filter(Boolean)
                          .join(' · ')
                      : levelLabel(s.level)}
                  </span>
                </span>
                <Icon name="chevron" size={16} weight="bold" className="muted" />
              </button>
            );
          })}
        </div>
      )}

      {p.isCoach && upcoming.length > 0 && (
        <>
          <h2 className="section-label">Ближайшие занятия</h2>
          <div className="coach-row">
            {upcoming.slice(0, 10).map((e) => (
              <CoachSessionCard key={e.id} event={e} />
            ))}
          </div>
        </>
      )}

      {p.photos.length > 0 && (
        <section className="card media-card">
          <h2 className="card-h">Фото</h2>
          <div className="media-grid">
            {p.photos.map((url) => (
              <button key={url} type="button" className="media-cell" onClick={() => setViewer(url)}>
                <img src={url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      )}

      {p.videos.length > 0 && (
        <section className="card media-card">
          <h2 className="card-h">Видео</h2>
          <div className="media-grid">
            {p.videos.map((url) => (
              <button key={url} type="button" className="media-cell is-video" onClick={() => setViewer(url)}>
                <video src={`${url}#t=0.5`} preload="metadata" muted playsInline />
                <span className="media-play">
                  <Play size={22} weight="fill" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {children}

      {viewer && <MediaViewer url={viewer} onClose={() => setViewer(null)} />}

      <Sheet open={ratingInfo} onClose={() => setRatingInfo(false)} title="Оценки после игр">
        <p className="muted">
          После каждой игры или тренировки участники подтверждают, что она состоялась, и оценивают друг друга. Это помогает
          подбирать партнёров своего уровня.
        </p>
        <ul className="rating-explain">
          {p.isCoach ? (
            <li>
              <b>Эффективность {formatRating(p.ratings.effectiveness)}</b>
              <span>{RATING_INFO.effectiveness}</span>
            </li>
          ) : (
            <>
              <li>
                <b>Vibe {formatRating(p.ratings.vibe)}</b>
                <span>{RATING_INFO.vibe}</span>
              </li>
              <li>
                <b>Level fit {formatRating(p.ratings.levelFit)}</b>
                <span>{RATING_INFO.levelFit}</span>
              </li>
            </>
          )}
        </ul>
        <p className="hint">Всего оценок: {p.ratings.count}</p>
        <button className="btn btn-primary" onClick={() => setRatingInfo(false)}>
          Понятно
        </button>
      </Sheet>

      <LevelsInfoSheet open={!!levelsSport} onClose={() => setLevelsSport(null)} initialSport={levelsSport} lockSport />
    </>
  );
}

/** Просмотр фото или видео на весь экран. */
export function MediaViewer({ url, onClose }: { url: string; onClose: () => void }) {
  return createPortal(
    <div className="media-viewer" role="dialog" aria-label="Просмотр" onClick={onClose}>
      <button type="button" className="media-viewer-close" onClick={onClose} aria-label="Закрыть">
        <X size={24} weight="bold" />
      </button>
      {isVideoUrl(url) ? (
        <video src={url} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
      ) : (
        <img src={url} alt="" onClick={(e) => e.stopPropagation()} />
      )}
    </div>,
    document.body,
  );
}
