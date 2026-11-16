import { Info } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { PersonAvatar } from '../components/People';
import { Sheet } from '../components/Sheet';
import { formatWhen } from '../domain/events';
import { levelLabel, sportMeta } from '../domain/sports';
import type { PendingReview, RatingInput } from '../domain/types';
import { useToast } from '../state';
import { eventLevels } from '../components/GameCards';

const FACES = ['😡', '🙁', '😐', '🙂', '🤩'];

type Scores = Record<string, { vibe?: number; levelFit?: number; effectiveness?: number }>;

const HELP = {
  vibe: ['Vibe', 'Приятно ли было играть: пунктуальность, настрой, уважение к партнёрам.'],
  levelFit: ['Level fit', 'Совпал ли реальный уровень с указанным в паспорте.'],
  effectiveness: ['Эффективность тренировки', 'Насколько полезным было занятие: объяснения, нагрузка, прогресс.'],
} as const;

function FaceScale({ value, onChange, label }: { value?: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="faces" role="radiogroup" aria-label={label}>
      {FACES.map((f, i) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={value === i + 1}
          aria-label={`${i + 1} из 5`}
          className={`face${value === i + 1 ? ' is-on' : ''}`}
          onClick={() => onChange(i + 1)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

/** После события: подтвердить, что оно состоялось, и оценить партнёров (или тренера). */
export function RatePage() {
  const { id = '' } = useParams();
  const { user, refreshReviews, refreshNotifications } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [review, setReview] = useState<PendingReview | null | undefined>(undefined);
  const [stage, setStage] = useState<'confirm' | 'rate'>('confirm');
  const [scores, setScores] = useState<Scores>({});
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState<keyof typeof HELP | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .reviewFor(id, user)
      .then(setReview)
      .catch(() => setReview(null));
  }, [id, user]);

  if (!user)
    return (
      <div className="page empty">
        <p>Войдите, чтобы оценить игру.</p>
      </div>
    );
  if (review === undefined) return <div className="page"><div className="card skeleton tall" /></div>;
  if (review === null)
    return (
      <div className="page empty">
        <p>Это событие уже оценено или ещё не закончилось.</p>
        <Link to="/" className="btn btn-ghost">
          На главную
        </Link>
      </div>
    );

  const { event, people } = review;
  const training = event.eventType === 'training';
  const one = people.length === 1 ? people[0] : null;

  const submit = async (happened: boolean) => {
    setBusy(true);
    try {
      const ratings: RatingInput[] = Object.entries(scores)
        .filter(([, s]) => s.vibe || s.levelFit || s.effectiveness)
        .map(([rateeId, s]) => ({ rateeId, vibe: s.vibe ?? null, levelFit: s.levelFit ?? null, effectiveness: s.effectiveness ?? null }));
      if (happened && ratings.length === 0) {
        toast('Поставьте хотя бы одну оценку', 'error');
        setBusy(false);
        return;
      }
      await api.submitReview(event.id, happened, ratings, user);
      await Promise.all([refreshReviews(), refreshNotifications()]);
      toast(happened ? 'Спасибо! Оценки помогут подбирать партнёров' : 'Отметили, что событие не состоялось', 'success');
      navigate('/', { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const set = (pid: string, key: 'vibe' | 'levelFit' | 'effectiveness', v: number) =>
    setScores((s) => ({ ...s, [pid]: { ...s[pid], [key]: v } }));

  if (stage === 'confirm')
    return (
      <div className="page rate-page">
        <div className="rate-hero" style={{ ['--sport' as string]: sportMeta(event.sport).color }} />
        <section className="card rate-confirm">
          <h1 className="rate-title">{training ? 'Подтвердите ваше занятие' : 'Подтвердите вашу игру'}</h1>
          <div className="versus">
            <div className="versus-person">
              <PersonAvatar name={user.name} photoUrl={user.photoUrl} size={72} />
              <b>Вы</b>
            </div>
            <span className="versus-sign">{training ? '&' : 'VS'}</span>
            {one ? (
              <div className="versus-person">
                <PersonAvatar name={one.name} photoUrl={one.photoUrl} size={72} />
                <b>{one.name}</b>
              </div>
            ) : (
              <div className="versus-person">
                <div className="versus-group">
                  {people.slice(0, 3).map((p) => (
                    <PersonAvatar key={p.id} name={p.name} photoUrl={p.photoUrl} size={44} />
                  ))}
                </div>
                <b>
                  {people.length} {people.length < 5 ? 'партнёра' : 'партнёров'}
                </b>
              </div>
            )}
          </div>
          <div className="rate-event">
            <b>{sportMeta(event.sport).label}</b>
            <span>{eventLevels(event)}</span>
            <span>{formatWhen(event)}</span>
            <span>
              {event.venueName}
              {event.city ? `, ${event.city}` : ''}
            </span>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={() => setStage('rate')}>
            Подтвердить
          </button>
          <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => submit(false)}>
            Не состоялось
          </button>
        </section>
      </div>
    );

  return (
    <div className="page rate-page">
      <h1 className="rate-title center">{training ? 'Как прошла ваша тренировка?' : 'Как прошла ваша игра?'}</h1>
      <p className="muted center">
        {people.some((p) => p.isCoach)
          ? 'Пожалуйста, оцените тренера, чтобы мы могли улучшить рекомендации. Это займёт менее 10 секунд.'
          : 'Пожалуйста, оцените партнёров. Это займёт 5 секунд и поможет лучше подбирать игроков в следующих матчах.'}
      </p>

      {people.map((p) => (
        <section key={p.id} className="card rate-card">
          <div className="rate-person">
            <PersonAvatar name={p.name} photoUrl={p.photoUrl} size={64} />
            <b>{p.name}</b>
            <span className="muted">{p.isCoach ? 'Тренер' : p.skillLevel !== 'any' ? levelLabel(p.skillLevel) : 'Игрок'}</span>
          </div>
          {p.isCoach ? (
            <>
              <RateRow label={HELP.effectiveness[0]} onHelp={() => setHelp('effectiveness')} />
              <FaceScale label={HELP.effectiveness[0]} value={scores[p.id]?.effectiveness} onChange={(v) => set(p.id, 'effectiveness', v)} />
              <RateRow label={HELP.vibe[0]} onHelp={() => setHelp('vibe')} />
              <FaceScale label={HELP.vibe[0]} value={scores[p.id]?.vibe} onChange={(v) => set(p.id, 'vibe', v)} />
            </>
          ) : (
            <>
              <RateRow label={HELP.vibe[0]} onHelp={() => setHelp('vibe')} />
              <FaceScale label={HELP.vibe[0]} value={scores[p.id]?.vibe} onChange={(v) => set(p.id, 'vibe', v)} />
              <RateRow label={HELP.levelFit[0]} onHelp={() => setHelp('levelFit')} />
              <FaceScale label={HELP.levelFit[0]} value={scores[p.id]?.levelFit} onChange={(v) => set(p.id, 'levelFit', v)} />
            </>
          )}
        </section>
      ))}

      <div className="action-bar">
        <button className="btn btn-primary btn-grow" disabled={busy} onClick={() => submit(true)}>
          {busy ? 'Отправляем…' : 'Оценить'}
        </button>
      </div>

      <Sheet open={!!help} onClose={() => setHelp(null)} title={help ? HELP[help][0] : ''}>
        <p className="muted">{help ? HELP[help][1] : ''}</p>
        <p className="hint">Оценки анонимны: человек видит только среднее значение в своём профиле.</p>
        <button className="btn btn-primary" onClick={() => setHelp(null)}>
          Понятно
        </button>
      </Sheet>
    </div>
  );
}

function RateRow({ label, onHelp }: { label: string; onHelp: () => void }) {
  return (
    <div className="rate-row">
      <b>{label}</b>
      <button type="button" className="label-info" onClick={onHelp} aria-label={`Что такое ${label}`}>
        <Info size={14} weight="fill" />
      </button>
    </div>
  );
}
