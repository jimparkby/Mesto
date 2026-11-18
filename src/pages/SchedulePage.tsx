import { CalendarPlus, CaretDown, Lightning, Plus, UserCheck } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Participant } from '../api';
import { useAuth } from '../auth/AuthContext';
import { DateStrip } from '../components/DateStrip';
import { PersonAvatar } from '../components/People';
import { SportIcon } from '../components/SportIcon';
import { formatPrice, isPast } from '../domain/events';
import {
  BOOKING_HORIZON_DAYS,
  clientSpots,
  clientsBooked,
  dayKey,
  dayTitle,
  durationLabel,
  groupByDay,
  nextDays,
  slotTimeLabel,
  WEEKDAYS,
  weekdaysLabel,
} from '../domain/schedule';
import { levelsLabel, sportMeta } from '../domain/sports';
import type { CoachSlot, SportEvent } from '../domain/types';
import { useToast } from '../state';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** Расписание тренера: недельный шаблон и календарь выставленных занятий с записями клиентов. */
export function SchedulePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<'calendar' | 'template'>('calendar');
  const [slots, setSlots] = useState<CoachSlot[] | null>(null);
  const [sessions, setSessions] = useState<SportEvent[] | null>(null);
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const days = useMemo(() => nextDays(BOOKING_HORIZON_DAYS), []);

  const load = useCallback(async () => {
    if (!user) return;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + BOOKING_HORIZON_DAYS * 86_400_000);
    const [s, e] = await Promise.all([
      api.listCoachSlots(user.id),
      api.coachSessions(user.id, from.toISOString(), to.toISOString()).catch(() => [] as SportEvent[]),
    ]);
    setSlots(s);
    setSessions(e);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Пустой шаблон — сразу показываем вкладку шаблона.
  useEffect(() => {
    if (slots && slots.length === 0) setTab('template');
  }, [slots]);

  const byDay = useMemo(() => groupByDay(sessions ?? []), [sessions]);
  const marks = useMemo(() => {
    const m = new Map<string, 'free' | 'full'>();
    for (const [k, list] of byDay) {
      const live = list.filter((e) => e.status === 'published');
      if (live.length) m.set(k, live.some((e) => clientsBooked(e) < clientSpots(e)) ? 'free' : 'full');
    }
    return m;
  }, [byDay]);

  if (!user)
    return (
      <div className="page empty">
        <p>Войдите, чтобы вести расписание.</p>
      </div>
    );
  if (!user.isCoach)
    return (
      <div className="page empty">
        <p>Расписание и онлайн-запись доступны тренерам. Выберите роль «Тренер» в спортивном паспорте.</p>
        <Link to="/passport" className="btn btn-ghost">
          Открыть паспорт
        </Link>
      </div>
    );

  const toggleActive = async (s: CoachSlot) => {
    try {
      const { id, coachId: _c, validFrom: _v, ...input } = s;
      const saved = await api.saveCoachSlot({ ...input, active: !s.active }, user, id);
      setSlots((list) => list?.map((x) => (x.id === saved.id ? saved : x)) ?? null);
      toast(saved.active ? 'Слот включён — занятия выставлены' : 'Слот на паузе — свободные занятия сняты', 'info');
      load();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const daySessions = byDay.get(selected) ?? [];
  const selectedDate = days.find((d) => dayKey(d) === selected) ?? days[0];
  const upcoming = (sessions ?? []).filter((e) => e.status === 'published' && !isPast(e));
  const booked = upcoming.reduce((a, e) => a + clientsBooked(e), 0);
  const capacity = upcoming.reduce((a, e) => a + clientSpots(e), 0);

  return (
    <div className="page schedule-page">
      <h1 className="page-title">Расписание</h1>

      <div className="coach-stats-grid schedule-kpis">
        <div>
          <span className="muted">Занятий впереди</span>
          <b>{sessions ? upcoming.length : '—'}</b>
        </div>
        <div>
          <span className="muted">Записано</span>
          <b>{sessions ? booked : '—'}</b>
        </div>
        <div>
          <span className="muted">Загрузка</span>
          <b>{sessions && capacity ? `${Math.round((booked / capacity) * 100)}%` : '—'}</b>
        </div>
      </div>

      <div className="segmented full">
        <button className={tab === 'calendar' ? 'is-on' : ''} onClick={() => setTab('calendar')}>
          Календарь
        </button>
        <button className={tab === 'template' ? 'is-on' : ''} onClick={() => setTab('template')}>
          Шаблон недели
        </button>
      </div>

      {tab === 'calendar' && (
        <>
          <section className="card schedule-card">
            <DateStrip days={days} selected={selected} onSelect={setSelected} marks={marks} />
            <div className="schedule-day-title">{dayTitle(selectedDate)}</div>
            {sessions === null ? (
              <div className="skeleton" style={{ height: 80 }} />
            ) : daySessions.length === 0 ? (
              <div className="schedule-empty muted">
                Занятий нет.
                <Link to="/create" className="link">
                  Добавить разовое занятие
                </Link>
              </div>
            ) : (
              <div className="slot-list">
                {daySessions.map((e) => (
                  <SessionRow key={e.id} event={e} onChanged={load} />
                ))}
              </div>
            )}
          </section>
          {slots?.length === 0 && (
            <div className="card callout">
              Заполните шаблон недели — занятия будут выставляться сами на {BOOKING_HORIZON_DAYS / 7} недели вперёд.{' '}
              <button className="link" onClick={() => setTab('template')}>
                К шаблону →
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'template' && (
        <>
          <p className="hint">
            Задайте, когда вы обычно тренируете. Занятия появятся у клиентов автоматически на {BOOKING_HORIZON_DAYS / 7} недели вперёд и будут
            продлеваться каждую ночь. Изменения шаблона не трогают занятия, на которые уже записались.
          </p>

          {slots === null && <div className="card skeleton tall" />}

          {slots && slots.length > 0 && (
            <section className="card week-grid">
              {WEEKDAYS.map((w) => {
                const daySlots = slots.filter((s) => s.weekdays.includes(w.id)).sort((a, b) => a.startTime.localeCompare(b.startTime));
                return (
                  <div key={w.id} className="week-row">
                    <span className="week-day">{w.short}</span>
                    <div className="week-slots">
                      {daySlots.length === 0 && <span className="faint">выходной</span>}
                      {daySlots.map((s) => (
                        <Link
                          key={s.id}
                          to={`/schedule/slot/${s.id}`}
                          className={`week-pill${s.active ? '' : ' is-off'}`}
                          style={{ ['--sport' as string]: sportMeta(s.sport).color }}
                        >
                          {s.startTime}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          <div className="stack">
            {slots?.map((s) => (
              <div key={s.id} className={`card slot-card${s.active ? '' : ' is-off'}`}>
                <Link to={`/schedule/slot/${s.id}`} className="slot-card-body">
                  <span className="slot-card-icon" style={{ background: `${sportMeta(s.sport).color}22` }}>
                    <SportIcon sport={s.sport} size={22} color={sportMeta(s.sport).color} />
                  </span>
                  <span className="slot-card-text">
                    <b>{s.title}</b>
                    <span>
                      {weekdaysLabel(s.weekdays)} · {slotTimeLabel(s)}
                    </span>
                    <span className="muted">
                      {s.spots} {s.spots === 1 ? 'место' : s.spots < 5 ? 'места' : 'мест'} · {formatPrice(s.price)} · {levelsLabel(s.levels)}
                    </span>
                    <span className="muted">{s.venueName || s.address}</span>
                    <span className={`slot-card-mode${s.autoApprove ? ' is-auto' : ''}`}>
                      {s.autoApprove ? (
                        <>
                          <Lightning size={13} weight="fill" /> Моментальная запись
                        </>
                      ) : (
                        <>
                          <UserCheck size={13} weight="fill" /> Запись с подтверждением
                        </>
                      )}
                    </span>
                  </span>
                </Link>
                <label className="switch-row slot-card-switch">
                  <span>{s.active ? 'Запись открыта' : 'На паузе'}</span>
                  <input type="checkbox" className="switch" checked={s.active} onChange={() => toggleActive(s)} />
                </label>
              </div>
            ))}
          </div>

          <button className="btn btn-primary btn-arrow" onClick={() => navigate('/schedule/slot/new')}>
            <Plus size={18} weight="bold" /> Добавить слот
          </button>
          <Link to="/create" className="btn btn-ghost">
            <CalendarPlus size={18} weight="bold" /> Разовое занятие на дату
          </Link>
        </>
      )}
    </div>
  );
}

/** Занятие в календаре тренера: записи, заявки, отмена или возврат. */
function SessionRow({ event: e, onChanged }: { event: SportEvent; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Participant[] | null>(null);
  const [busy, setBusy] = useState(false);
  const past = isPast(e);
  const cancelled = e.status === 'cancelled';
  const booked = clientsBooked(e);
  const spots = clientSpots(e);

  const loadPeople = useCallback(() => {
    api
      .participants(e.id)
      .then((list) => setPeople(list.filter((p) => p.userId !== e.organizerId)))
      .catch(() => setPeople([]));
  }, [e.id, e.organizerId]);

  useEffect(() => {
    if (open && people === null) loadPeople();
  }, [open, people, loadPeople]);

  const setStatus = async (status: 'published' | 'cancelled') => {
    setBusy(true);
    try {
      await api.setEventStatus(e.id, status);
      toast(status === 'cancelled' ? 'Занятие отменено, клиенты получат уведомление' : 'Занятие снова открыто для записи', 'info');
      onChanged();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (userId: string, approve: boolean) => {
    setBusy(true);
    try {
      await api.decideRegistration(e.id, userId, approve);
      loadPeople();
      onChanged();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const pending = people?.filter((p) => p.status === 'pending') ?? [];
  const approved = people?.filter((p) => p.status === 'approved') ?? [];

  return (
    <div className={`slot-row slot-row-coach${cancelled ? ' is-cancelled' : ''}${past ? ' is-past' : ''}`}>
      <div className="slot-time">
        <b>{timeOf(e.startsAt)}</b>
        <span>{durationLabel(e.durationMin)}</span>
      </div>
      <button type="button" className="slot-body" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="slot-title">
          <SportIcon sport={e.sport} size={16} color={sportMeta(e.sport).color} /> {e.title}
        </span>
        <span className="slot-meta">
          {e.venueName} · {formatPrice(e.price)}
        </span>
        <span className={`slot-spots${booked >= spots ? ' is-full' : ''}`}>
          {cancelled ? 'Отменено' : `Записано ${booked} из ${spots}`}
          {!e.slotId && !cancelled ? ' · разовое' : ''}
        </span>
      </button>
      <CaretDown size={16} weight="bold" className={`slot-caret muted${open ? ' is-open' : ''}`} />

      {open && (
        <div className="slot-details">
          {people === null ? (
            <div className="muted">Загружаем…</div>
          ) : (
            <>
              {pending.map((p) => (
                <div key={p.userId} className="slot-person">
                  <PersonAvatar name={p.name} photoUrl={p.photoUrl} size={32} />
                  <Link to={`/user/${p.userId}`} className="grow">
                    {p.name} <span className="muted">· заявка</span>
                  </Link>
                  <button className="btn btn-tonal btn-xs" disabled={busy} onClick={() => decide(p.userId, true)}>
                    Принять
                  </button>
                  <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => decide(p.userId, false)}>
                    ✕
                  </button>
                </div>
              ))}
              {approved.map((p) => (
                <Link key={p.userId} to={`/user/${p.userId}`} className="slot-person">
                  <PersonAvatar name={p.name} photoUrl={p.photoUrl} size={32} />
                  <span className="grow">{p.name}</span>
                </Link>
              ))}
              {pending.length + approved.length === 0 && <div className="muted">Пока никто не записался.</div>}
            </>
          )}
          <div className="slot-actions">
            <Link to={`/event/${e.id}`} className="btn btn-ghost btn-sm">
              Открыть
            </Link>
            {!past &&
              (cancelled ? (
                <button className="btn btn-tonal btn-sm" disabled={busy} onClick={() => setStatus('published')}>
                  Вернуть
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm danger" disabled={busy} onClick={() => setStatus('cancelled')}>
                  Отменить занятие
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
