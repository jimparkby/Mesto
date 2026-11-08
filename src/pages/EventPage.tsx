import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CaretDown, Share } from '@phosphor-icons/react';
import { api, type Participant } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { Icon, IconTile, TILE } from '../components/Icon';
import { SportIcon } from '../components/SportIcon';
import { LoginSheet } from '../components/LoginSheet';
import { MapView } from '../components/MapView';
import { formatPrice, formatWhen, isFull, isPast, pluralPlaces, spotsLeft } from '../domain/events';
import { eventLevelLabel } from '../domain/levels';
import { levelLabel, sportMeta } from '../domain/sports';
import type { SportEvent } from '../domain/types';
import { platform } from '../platforms';
import { useToast } from '../state';

const TG_APP_LINK = import.meta.env.VITE_TG_APP_LINK as string | undefined;

function shareUrl(e: SportEvent): string {
  if (TG_APP_LINK) return `${TG_APP_LINK}?startapp=event_${e.id}`;
  const base = location.href.split('#')[0];
  return base.startsWith('http') ? `${base}#/event/${e.id}` : `https://t.me/share?text=${encodeURIComponent(e.title)}`;
}

interface ExpandableSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function ExpandableSection({ title, open, onToggle, children }: ExpandableSectionProps) {
  return (
    <div className="expandable">
      <button className={`expandable-header${open ? ' is-open' : ''}`} onClick={onToggle} aria-expanded={open}>
        <span className="expandable-title">{title}</span>
        <CaretDown size={18} weight="bold" className="expandable-chevron" />
      </button>
      {open && <div className="expandable-body">{children}</div>}
    </div>
  );
}

export function EventPage() {
  const { id = '' } = useParams();
  const { user, myEventIds, toggleRegistration } = useAuth();
  const toast = useToast();
  const [event, setEvent] = useState<SportEvent | null | undefined>(undefined);
  const [people, setPeople] = useState<Participant[]>([]);
  const [busy, setBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);

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
        <div className="empty-emoji">
          <Icon name="search" size={40} />
        </div>
        <p>Событие не найдено или удалено.</p>
        <Link to="/events" className="btn btn-ghost">
          К списку событий
        </Link>
      </div>
    );

  const meta = sportMeta(event.sport);
  const joined = myEventIds.has(event.id);
  const past = isPast(event);
  const spotsFull = isFull(event);
  const left = spotsLeft(event);

  const join = async (want: boolean) => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    setBusy(true);
    try {
      await toggleRegistration(event.id, want);
      toast(want ? 'Вы записаны! Увидимся на тренировке' : 'Запись отменена', want ? 'success' : 'info');
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

  const writeOrganizer = () => platform.openLink(`https://t.me/${event.organizerUsername}`);

  const route = () => platform.openLink(`https://yandex.by/maps/?rtext=~${event.lat},${event.lng}&rtt=auto`);

  let cta: { label: string; action: () => void; kind: string; disabled?: boolean };
  if (past) cta = { label: 'Событие завершено', action: () => {}, kind: 'btn-ghost', disabled: true };
  else if (event.status !== 'published') cta = { label: 'Запись закрыта', action: () => {}, kind: 'btn-ghost', disabled: true };
  else if (joined) cta = { label: 'Отменить запись', action: () => join(false), kind: 'btn-ghost' };
  else if (spotsFull) cta = { label: 'Мест нет', action: () => {}, kind: 'btn-ghost', disabled: true };
  else cta = { label: event.price > 0 ? `Записаться · ${formatPrice(event.price)}` : 'Записаться', action: () => join(true), kind: 'btn-primary btn-arrow' };

  return (
    <div className="page event-page">
      <div className="event-hero" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)` }}>
        <span className="event-hero-emoji" aria-hidden>
          <SportIcon sport={event.sport} size={48} color="#fff" />
        </span>
        <div className="event-hero-sport">{meta.label}</div>
        <h1 className="event-hero-title">{event.title}</h1>
        {joined && (
          <span className="badge badge-on-hero">
            <Icon name="check" size={14} /> Вы идёте
          </span>
        )}
      </div>

      <div className="card organizer-card">
        <Avatar name={event.organizerName || 'Организатор'} size={44} />
        <div className="organizer-body">
          <div className="widget-label">
            Организатор
            {event.organizerIsCoach && (
              <span className="badge badge-coach">
                <Icon name="coach" size={12} /> Тренер
              </span>
            )}
          </div>
          <div className="organizer-name">{event.organizerName || 'Не указан'}</div>
          {event.organizerUsername ? (
            <div className="organizer-handle">@{event.organizerUsername}</div>
          ) : event.sourceUrl ? (
            <div className="organizer-handle muted">Событие из внешнего анонса</div>
          ) : (
            <div className="organizer-handle muted">Telegram не указан</div>
          )}
        </div>
        {event.organizerUsername ? (
          <button className="btn btn-primary organizer-write" onClick={writeOrganizer}>
            <Icon name="chat" size={18} />
            Написать
          </button>
        ) : event.sourceUrl ? (
          <button className="btn btn-ghost organizer-write" onClick={() => platform.openLink(event.sourceUrl!)}>
            Анонс
          </button>
        ) : null}
      </div>

      <div className="widget-row">
        <div className={`widget widget-time${joined ? ' is-on' : ''}`}>
          <IconTile name="clock" color={TILE.gray} size={44} />
          <div className="widget-body">
            <div className="widget-label">Когда</div>
            <div className="widget-value">{formatWhen(event)}</div>
          </div>
        </div>
        <div className={`widget widget-place${joined ? ' is-on' : ''}`}>
          <IconTile name="pin" color={TILE.red} size={44} />
          <div className="widget-body">
            <div className="widget-label">Где</div>
            <div className="widget-value">{event.venueName}</div>
            {event.address && <div className="widget-sub">{event.address}</div>}
          </div>
        </div>
      </div>

      <div className="widget-row">
        <div className={`widget widget-level`}>
          <IconTile name="level" color={TILE.indigo} size={44} />
          <div className="widget-body">
            <div className="widget-label">Уровень</div>
            <div className="widget-value">{eventLevelLabel(event, levelLabel)}</div>
          </div>
        </div>
        <div className={`widget widget-spots${left <= 3 ? ' is-low' : ''}${spotsFull ? ' is-full' : ''}`}>
          <IconTile name="users" color={TILE.blue} size={44} />
          <div className="widget-body">
            <div className="widget-label">Мест</div>
            <div className="widget-value">{spotsFull ? 'Мест нет' : `Осталось ${pluralPlaces(left)}`}</div>
          </div>
        </div>
      </div>

      <div className="card map-card">
        <MapView events={[event]} center={{ lat: event.lat, lng: event.lng }} zoom={14} className="map-event" />
        <button className="route-btn" onClick={route}>
          <Icon name="route" size={20} />
          Построить маршрут
        </button>
      </div>

      <ExpandableSection
        title="Описание"
        open={descOpen}
        onToggle={() => setDescOpen(!descOpen)}
      >
        {event.description ? (
          <p className="prewrap">{event.description}</p>
        ) : (
          <p className="muted">Описание не добавлено.</p>
        )}
      </ExpandableSection>

      <ExpandableSection
        title={`Участники · ${event.registeredCount}`}
        open={peopleOpen}
        onToggle={() => setPeopleOpen(!peopleOpen)}
      >
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
      </ExpandableSection>

      <div className="action-bar">
        <button className="btn btn-ghost btn-round" onClick={share} aria-label="Поделиться">
          <Share size={22} weight="bold" />
        </button>
        <button className={`btn ${cta.kind} btn-grow`} disabled={cta.disabled || busy} onClick={cta.action}>
          {busy ? '…' : cta.label}
        </button>
      </div>

      <LoginSheet
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        reason="Войдите, чтобы записаться на событие"
      />
    </div>
  );
}
