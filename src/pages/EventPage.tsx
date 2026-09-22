import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Participant } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { LoginSheet } from '../components/LoginSheet';
import { MapView } from '../components/MapView';
import { formatPrice, formatWhen, isFull, isPast, pluralPlaces, spotsLeft } from '../domain/events';
import { levelLabel, sportMeta } from '../domain/sports';
import type { SportEvent } from '../domain/types';
import { platform } from '../platforms';
import { useToast } from '../state';

const TG_APP_LINK = import.meta.env.VITE_TG_APP_LINK as string | undefined;

function shareUrl(e: SportEvent): string {
  // Лучше всего делиться ссылкой на Mini App — она откроет событие прямо в Telegram.
  if (TG_APP_LINK) return `${TG_APP_LINK}?startapp=event_${e.id}`;
  const base = location.href.split('#')[0];
  return base.startsWith('http') ? `${base}#/event/${e.id}` : `https://t.me/share?text=${encodeURIComponent(e.title)}`;
}

export function EventPage() {
  const { id = '' } = useParams();
  const { user, myEventIds, toggleRegistration } = useAuth();
  const toast = useToast();
  const [event, setEvent] = useState<SportEvent | null | undefined>(undefined);
  const [people, setPeople] = useState<Participant[]>([]);
  const [busy, setBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const load = useCallback(async () => {
    const [e, p] = await Promise.all([api.getEvent(id), api.participants(id)]);
    setEvent(e);
    setPeople(p);
  }, [id]);

  useEffect(() => {
    load().catch(() => setEvent(null));
  }, [load]);

  if (event === undefined) return <div className="page"><div className="card skeleton tall" /></div>;
  if (event === null)
    return (
      <div className="page empty">
        <div className="empty-emoji">🔍</div>
        <p>Событие не найдено или удалено.</p>
        <Link to="/" className="btn btn-ghost">
          К списку событий
        </Link>
      </div>
    );

  const meta = sportMeta(event.sport);
  const joined = myEventIds.has(event.id);
  const past = isPast(event);
  const full = isFull(event);
  const isOrganizer = user?.id === event.organizerId;

  const join = async (want: boolean) => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    setBusy(true);
    try {
      await toggleRegistration(event.id, want);
      toast(want ? 'Вы записаны! Увидимся на тренировке 💪' : 'Запись отменена', want ? 'success' : 'info');
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const share = () =>
    platform
      .share(shareUrl(event), `${meta.emoji} ${event.title} — ${formatWhen(event)}, ${event.venueName}. Присоединяйся!`)
      .then(() => platform.kind === 'web' && toast('Ссылка скопирована'))
      .catch(() => {});

  const route = () => platform.openLink(`https://yandex.by/maps/?rtext=~${event.lat},${event.lng}&rtt=auto`);

  let cta: { label: string; action: () => void; kind: string; disabled?: boolean };
  if (past) cta = { label: 'Событие завершено', action: () => {}, kind: 'btn-ghost', disabled: true };
  else if (event.status !== 'published') cta = { label: 'Запись закрыта', action: () => {}, kind: 'btn-ghost', disabled: true };
  else if (joined) cta = { label: 'Отменить запись', action: () => join(false), kind: 'btn-ghost' };
  else if (full) cta = { label: 'Мест нет', action: () => {}, kind: 'btn-ghost', disabled: true };
  else cta = { label: event.price > 0 ? `Записаться · ${formatPrice(event.price)}` : 'Записаться', action: () => join(true), kind: 'btn-primary' };

  return (
    <div className="page event-page">
      <div className="event-hero" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)` }}>
        <span className="event-hero-emoji" aria-hidden>
          {meta.emoji}
        </span>
        <div className="event-hero-sport">{meta.label}</div>
        <h1 className="event-hero-title">{event.title}</h1>
        {joined && <span className="badge badge-on-hero">✓ Вы идёте</span>}
      </div>

      <div className="card info-list">
        <div className="info-row">
          <span>🕒</span>
          <div>{formatWhen(event)}</div>
        </div>
        <div className="info-row">
          <span>📍</span>
          <div>
            <div>{event.venueName}</div>
            <div className="muted">{event.address}</div>
          </div>
        </div>
        <div className="info-row">
          <span>💳</span>
          <div>{formatPrice(event.price)}</div>
        </div>
        <div className="info-row">
          <span>📈</span>
          <div>{levelLabel(event.level)}</div>
        </div>
        <div className="info-row">
          <span>👥</span>
          <div>
            {event.registeredCount} из {event.capacity}
            {!full && !past && <span className="muted"> · осталось {pluralPlaces(spotsLeft(event))}</span>}
          </div>
        </div>
        <div className="info-row">
          <span>🧑‍🏫</span>
          <div>
            Организатор: <b>{event.organizerName || '—'}</b>
            {isOrganizer && <span className="badge badge-ok"> это вы</span>}
          </div>
        </div>
      </div>

      {event.description && (
        <section className="card">
          <h2 className="h2">Описание</h2>
          <p className="prewrap">{event.description}</p>
        </section>
      )}

      <section className="card">
        <h2 className="h2">Участники · {event.registeredCount}</h2>
        {people.length === 0 ? (
          <p className="muted">Пока никого — станьте первым!</p>
        ) : (
          <div className="people">
            {people.slice(0, 24).map((p) => (
              <div key={p.userId} className="person">
                <Avatar name={p.name} photoUrl={p.photoUrl} size={40} />
                <span>{p.name.split(' ')[0]}</span>
              </div>
            ))}
            {people.length > 24 && <div className="person more">+{people.length - 24}</div>}
          </div>
        )}
      </section>

      <section className="card no-pad">
        <MapView events={[event]} center={{ lat: event.lat, lng: event.lng }} zoom={14} className="map-mini" />
        <button className="btn btn-ghost btn-block square-top" onClick={route}>
          🧭 Построить маршрут
        </button>
      </section>

      <div className="action-bar">
        <button className="btn btn-icon-lg" onClick={share} aria-label="Поделиться">
          📤
        </button>
        <button className={`btn ${cta.kind} btn-grow`} disabled={cta.disabled || busy} onClick={cta.action}>
          {busy ? '…' : cta.label}
        </button>
      </div>

      <LoginSheet
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        reason="Чтобы записаться, представьтесь — имя увидит организатор."
      />
    </div>
  );
}
