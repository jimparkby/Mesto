import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ArrowsOut, CaretDown, Info, Share } from '@phosphor-icons/react';
import { api, type Participant } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { Icon, IconTile, TILE } from '../components/Icon';
import { SportIcon } from '../components/SportIcon';
import { LevelsInfoSheet } from '../components/LevelsInfoSheet';
import { LoginSheet } from '../components/LoginSheet';
import { Sheet } from '../components/Sheet';
import { MapView } from '../components/MapView';
import { formatPrice, formatWhen, isFull, isPast, pluralPlaces, spotsLeft } from '../domain/events';
import { eventLevelLabel } from '../domain/levels';
import { levelLabel, sportMeta } from '../domain/sports';
import type { EventStatus, SportEvent } from '../domain/types';
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
  const { user, myRequests, toggleRegistration } = useAuth();
  const toast = useToast();
  const [event, setEvent] = useState<SportEvent | null | undefined>(undefined);
  const [people, setPeople] = useState<Participant[]>([]);
  const [busy, setBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [mapFull, setMapFull] = useState(false);

  // Карта на весь экран: страница под ней не прокручивается.
  useEffect(() => {
    if (!mapFull) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mapFull]);

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
  const request = myRequests.get(event.id);
  const joined = request === 'approved';
  const approved = people.filter((p) => p.status === 'approved');
  const pending = people.filter((p) => p.status === 'pending');
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
      const status = await toggleRegistration(event.id, want);
      if (status === 'pending') toast('Заявка отправлена. Организатор посмотрит профиль и подтвердит запись', 'success');
      else if (status === 'approved') toast('Вы записаны! Увидимся на тренировке', 'success');
      else toast(request === 'pending' ? 'Заявка отозвана' : 'Запись отменена', 'info');
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Организатор (и админ) может отменить своё событие или объявление и вернуть его в ленту.
  const canManage = !!user && (user.id === event.organizerId || user.role === 'admin');
  const setStatus = async (status: EventStatus) => {
    setBusy(true);
    try {
      await api.setEventStatus(event.id, status);
      toast(status === 'cancelled' ? 'Событие отменено' : 'Событие снова в ленте', status === 'cancelled' ? 'info' : 'success');
      setCancelOpen(false);
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (userId: string, approve: boolean) => {
    setDeciding(userId);
    try {
      await api.decideRegistration(event.id, userId, approve);
      toast(approve ? 'Участник принят' : 'Заявка отклонена', approve ? 'success' : 'info');
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setDeciding(null);
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
  else if (event.status === 'cancelled') cta = { label: 'Событие отменено', action: () => {}, kind: 'btn-ghost', disabled: true };
  else if (event.status !== 'published') cta = { label: 'Запись закрыта', action: () => {}, kind: 'btn-ghost', disabled: true };
  else if (joined) cta = { label: 'Отменить запись', action: () => join(false), kind: 'btn-ghost' };
  else if (request === 'pending') cta = { label: 'Отозвать заявку', action: () => join(false), kind: 'btn-ghost' };
  else if (request === 'rejected') cta = { label: 'Заявка отклонена', action: () => {}, kind: 'btn-ghost', disabled: true };
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
        {request === 'pending' && (
          <span className="badge badge-on-hero">
            <Icon name="clock" size={14} /> Заявка на рассмотрении
          </span>
        )}
      </div>

      {request === 'pending' && (
        <div className="card callout">
          Заявка отправлена. Организатор посмотрит ваш профиль и подтвердит запись — ответ придёт от бота.
        </div>
      )}
      {request === 'rejected' && (
        <div className="card callout callout-danger">Организатор отклонил заявку на это событие.</div>
      )}

      {event.status === 'cancelled' && (
        <div className="card callout callout-danger">
          Организатор отменил {event.eventType === 'training' ? 'тренировку' : 'событие'}.
        </div>
      )}

      <div className="card organizer-card">
        {event.organizerId ? (
          <Link to={`/user/${event.organizerId}`} aria-label="Профиль организатора">
            <Avatar name={event.organizerName || 'Организатор'} size={44} />
          </Link>
        ) : (
          <Avatar name={event.organizerName || 'Организатор'} size={44} />
        )}
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
            <div className="widget-label label-row">
              Уровень
              <button
                type="button"
                className="label-info"
                aria-label="Что значат уровни"
                onClick={() => setLevelsOpen(true)}
              >
                <Info size={14} weight="fill" />
              </button>
            </div>
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
        <button className="map-expand-btn" onClick={() => setMapFull(true)} aria-label="Открыть карту на весь экран">
          <ArrowsOut size={20} weight="bold" />
        </button>
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
        title={`Участники · ${event.registeredCount}${canManage && pending.length ? ` · заявок ${pending.length}` : ''}`}
        open={peopleOpen || (canManage && pending.length > 0)}
        onToggle={() => setPeopleOpen(!peopleOpen)}
      >
        {canManage && pending.length > 0 && (
          <div className="requests">
            <div className="section-title">Заявки — посмотрите профиль и подтвердите</div>
            {pending.map((p) => (
              <div key={p.userId} className="request-row">
                <Link to={`/user/${p.userId}`} className="request-person">
                  <Avatar name={p.name} photoUrl={p.photoUrl} size={40} />
                  <span className="request-name">{p.name}</span>
                </Link>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={deciding === p.userId}
                  onClick={() => decide(p.userId, false)}
                  aria-label={`Отклонить: ${p.name}`}
                >
                  <Icon name="close" size={16} />
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={deciding === p.userId}
                  onClick={() => decide(p.userId, true)}
                >
                  Принять
                </button>
              </div>
            ))}
          </div>
        )}
        {approved.length === 0 ? (
          <p className="muted">Пока никого — станьте первым!</p>
        ) : (
          <div className="people">
            {approved.slice(0, 24).map((p) =>
              // Демо-участники — выдуманные, профиля у них нет.
              p.userId.startsWith('demo-') ? (
                <div key={p.userId} className="person">
                  <Avatar name={p.name} photoUrl={p.photoUrl} size={40} />
                  <span>{p.name.split(' ')[0]}</span>
                </div>
              ) : (
                <Link key={p.userId} to={`/user/${p.userId}`} className="person" aria-label={`Профиль: ${p.name}`}>
                  <Avatar name={p.name} photoUrl={p.photoUrl} size={40} />
                  <span>{p.name.split(' ')[0]}</span>
                </Link>
              ),
            )}
            {approved.length > 24 && <div className="person more">+{approved.length - 24}</div>}
          </div>
        )}
      </ExpandableSection>

      {canManage && !past && (
        <section className="card settings">
          {event.status === 'cancelled' ? (
            <button className="settings-row" disabled={busy} onClick={() => setStatus('published')}>
              <IconTile name="check" color={TILE.green} />
              <span className="grow">Вернуть в ленту</span>
            </button>
          ) : (
            <button className="settings-row danger" disabled={busy} onClick={() => setCancelOpen(true)}>
              <IconTile name="close" color={TILE.red} />
              <span className="grow">Отменить {event.eventType === 'training' ? 'тренировку' : 'событие'}</span>
            </button>
          )}
        </section>
      )}

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Отменить событие?">
        <p className="muted">
          Оно пропадёт из ленты и с карты, записаться будет нельзя. Участники увидят отметку «Отменено». Вернуть
          событие в ленту можно здесь же.
        </p>
        <button className="btn btn-danger" disabled={busy} onClick={() => setStatus('cancelled')}>
          {busy ? 'Отменяем…' : 'Да, отменить'}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => setCancelOpen(false)}>
          Не отменять
        </button>
      </Sheet>

      <div className="action-bar">
        <button className="btn btn-ghost btn-round" onClick={share} aria-label="Поделиться">
          <Share size={22} weight="bold" />
        </button>
        <button className={`btn ${cta.kind} btn-grow`} disabled={cta.disabled || busy} onClick={cta.action}>
          {busy ? '…' : cta.label}
        </button>
      </div>

      <LevelsInfoSheet open={levelsOpen} onClose={() => setLevelsOpen(false)} initialSport={event.sport} lockSport />

      {mapFull &&
        createPortal(
          <div className="map-full" role="dialog" aria-label="Карта события">
            <MapView events={[event]} center={{ lat: event.lat, lng: event.lng }} zoom={15} className="map-full-map" />
            <div className="map-full-top">
              <div className="map-full-hint">
                {event.venueName}
                {event.address && event.address !== event.venueName ? ` · ${event.address}` : ''}
              </div>
            </div>
            <div className="map-full-bottom map-full-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setMapFull(false)}>
                Закрыть
              </button>
              <button type="button" className="btn btn-primary btn-grow" onClick={route}>
                <Icon name="route" size={20} />
                Построить маршрут
              </button>
            </div>
          </div>,
          document.body,
        )}

      <LoginSheet
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        reason="Войдите, чтобы записаться на событие"
      />
    </div>
  );
}
