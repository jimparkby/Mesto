import { CalendarCheck, MapPin } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { formatPrice, isPast, spotsLeft } from '../domain/events';
import {
  BOOKING_HORIZON_DAYS,
  dayKey,
  dayTitle,
  durationLabel,
  freeSpotsLabel,
  groupByDay,
  nextDays,
} from '../domain/schedule';
import { levelsLabel, sportMeta } from '../domain/sports';
import type { SportEvent } from '../domain/types';
import { platform } from '../platforms';
import { useToast } from '../state';
import { DateStrip } from './DateStrip';
import { LoginSheet } from './LoginSheet';
import { Sheet } from './Sheet';
import { SportIcon } from './SportIcon';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/**
 * Онлайн-запись к тренеру: лента дней, свободные слоты на выбранный день, запись в два тапа.
 * Занятия выставляет сервер по недельному шаблону тренера (страница «Расписание»).
 */
export function CoachSchedule({ coachId, coachName }: { coachId: string; coachName: string }) {
  const { user, myRequests, toggleRegistration } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState<SportEvent[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<SportEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const days = useMemo(() => nextDays(BOOKING_HORIZON_DAYS), []);

  const load = useCallback(async () => {
    const from = new Date();
    const to = new Date(from.getTime() + BOOKING_HORIZON_DAYS * 86_400_000);
    const list = await api.coachSessions(coachId, from.toISOString(), to.toISOString()).catch(() => []);
    setSessions(list.filter((e) => e.status === 'published' && !isPast(e)));
  }, [coachId]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => groupByDay(sessions ?? []), [sessions]);
  const marks = useMemo(() => {
    const m = new Map<string, 'free' | 'full'>();
    for (const [k, list] of byDay) m.set(k, list.some((e) => spotsLeft(e) > 0) ? 'free' : 'full');
    return m;
  }, [byDay]);

  // По умолчанию — ближайший день, где есть свободные места.
  useEffect(() => {
    if (selected || !sessions) return;
    const first = days.find((d) => marks.get(dayKey(d)) === 'free') ?? days.find((d) => marks.has(dayKey(d)));
    setSelected(dayKey(first ?? days[0]));
  }, [sessions, marks, days, selected]);

  if (sessions === null) return <div className="card skeleton" />;
  if (sessions.length === 0) return null;

  const key = selected ?? dayKey(days[0]);
  const list = byDay.get(key) ?? [];
  const selectedDate = days.find((d) => dayKey(d) === key) ?? days[0];
  const nextWithSlots = days.find((d) => dayKey(d) > key && marks.has(dayKey(d)));

  const book = async (e: SportEvent, join: boolean) => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    setBusy(true);
    try {
      const status = await toggleRegistration(e.id, join);
      platform.haptic(join ? 'success' : 'selection');
      if (status === 'approved') toast(`Вы записаны: ${dayTitle(new Date(e.startsAt)).toLowerCase()}, ${timeOf(e.startsAt)}`, 'success');
      else if (status === 'pending') toast('Заявка отправлена — тренер подтвердит запись', 'success');
      else toast('Запись отменена', 'info');
      setConfirm(null);
      await load();
    } catch (err) {
      toast((err as Error).message, 'error');
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card schedule-card">
      <div className="section-row">
        <h2 className="card-h">Онлайн-запись</h2>
        {user?.id === coachId && (
          <Link to="/schedule" className="link">
            Настроить
          </Link>
        )}
      </div>
      <DateStrip days={days} selected={key} onSelect={setSelected} marks={marks} />
      <div className="schedule-day-title">{dayTitle(selectedDate)}</div>

      {list.length === 0 ? (
        <div className="schedule-empty muted">
          В этот день занятий нет.
          {nextWithSlots && (
            <button type="button" className="link" onClick={() => setSelected(dayKey(nextWithSlots))}>
              Ближайшее — {dayTitle(nextWithSlots).toLowerCase()}
            </button>
          )}
        </div>
      ) : (
        <div className="slot-list">
          {list.map((e) => {
            const req = myRequests.get(e.id);
            const left = spotsLeft(e);
            const own = user?.id === coachId;
            return (
              <div key={e.id} className={`slot-row${left === 0 && !req ? ' is-full' : ''}`}>
                <div className="slot-time">
                  <b>{timeOf(e.startsAt)}</b>
                  <span>{durationLabel(e.durationMin)}</span>
                </div>
                <Link to={`/event/${e.id}`} className="slot-body">
                  <span className="slot-title">
                    <SportIcon sport={e.sport} size={16} color={sportMeta(e.sport).color} /> {e.title}
                  </span>
                  <span className="slot-meta">
                    <MapPin size={13} weight="fill" /> {e.venueName}
                  </span>
                  <span className="slot-meta">
                    {formatPrice(e.price)} · {levelsLabel(e.levels)}
                  </span>
                  <span className={`slot-spots${left === 0 ? ' is-full' : left <= 2 ? ' is-few' : ''}`}>{freeSpotsLabel(e)}</span>
                </Link>
                {own ? null : req === 'approved' ? (
                  <button type="button" className="btn btn-ghost btn-sm slot-btn is-booked" disabled={busy} onClick={() => book(e, false)}>
                    <CalendarCheck size={16} weight="fill" /> Вы идёте
                  </button>
                ) : req === 'pending' ? (
                  <button type="button" className="btn btn-ghost btn-sm slot-btn" disabled={busy} onClick={() => book(e, false)}>
                    Ждёт ответа
                  </button>
                ) : req === 'rejected' ? (
                  <button type="button" className="btn btn-ghost btn-sm slot-btn" disabled>
                    Отклонено
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm slot-btn" disabled={left === 0 || busy} onClick={() => setConfirm(e)}>
                    {left === 0 ? 'Мест нет' : 'Записаться'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title="Подтвердите запись">
        {confirm && (
          <>
            <div className="card wizard-summary">
              <div className="summary-row">
                <span className="summary-label">Тренер</span>
                <span className="summary-value">{coachName}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Занятие</span>
                <span className="summary-value">{confirm.title}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Когда</span>
                <span className="summary-value">
                  {dayTitle(new Date(confirm.startsAt))}, {timeOf(confirm.startsAt)} · {durationLabel(confirm.durationMin)}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Где</span>
                <span className="summary-value">{confirm.address || confirm.venueName}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Цена</span>
                <span className="summary-value">{formatPrice(confirm.price)}</span>
              </div>
            </div>
            <p className="hint">
              {confirm.autoApprove ? 'Место закрепится за вами сразу.' : 'Тренер подтвердит запись — придёт уведомление.'}
              {confirm.price > 0 ? ' Оплата на месте.' : ''} Отменить запись можно здесь же.
            </p>
            <button type="button" className="btn btn-primary btn-arrow" disabled={busy} onClick={() => book(confirm, true)}>
              {busy ? 'Записываем…' : confirm.autoApprove ? 'Записаться' : 'Отправить заявку'}
            </button>
          </>
        )}
      </Sheet>
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} reason="Войдите, чтобы записаться к тренеру" />
    </section>
  );
}
