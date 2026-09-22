import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { formatWhen, isPast } from '../domain/events';
import { SPORTS, sportMeta } from '../domain/sports';
import type { EventStatus } from '../domain/types';
import { useEvents } from '../hooks';
import { useToast } from '../state';

const STATUS_LABEL: Record<EventStatus, string> = { published: 'Опубликовано', hidden: 'Скрыто', cancelled: 'Отменено' };

/** Простая модерация прямо в приложении (для MVP вместо отдельной админки на Next.js). */
export function AdminPage() {
  const { user } = useAuth();
  const { events, reload } = useEvents({ includeHidden: true });
  const toast = useToast();
  const [filter, setFilter] = useState<EventStatus | 'all'>('all');

  const stats = useMemo(() => {
    const upcoming = events.filter((e) => !isPast(e) && e.status === 'published');
    const seats = upcoming.reduce((s, e) => s + e.registeredCount, 0);
    const bySport = SPORTS.map((s) => ({ ...s, n: upcoming.filter((e) => e.sport === s.id).length }))
      .filter((s) => s.n > 0)
      .sort((a, b) => b.n - a.n);
    return { upcoming: upcoming.length, seats, bySport };
  }, [events]);

  if (user?.role !== 'admin') {
    return (
      <div className="page empty">
        <p>Раздел доступен только администраторам.</p>
        <Link to="/" className="btn btn-ghost">
          На главную
        </Link>
      </div>
    );
  }

  const setStatus = async (id: string, status: EventStatus) => {
    try {
      await api.setEventStatus(id, status);
      toast(`Статус: ${STATUS_LABEL[status]}`, 'success');
      reload();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const list = events
    .filter((e) => filter === 'all' || e.status === filter)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Админ</div>
          <h1 className="h1">Модерация</h1>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <b>{stats.upcoming}</b>
          <span>активных событий</span>
        </div>
        <div className="stat">
          <b>{stats.seats}</b>
          <span>записей</span>
        </div>
        <div className="stat">
          <b>{stats.bySport[0]?.emoji ?? '—'}</b>
          <span>топ-спорт</span>
        </div>
      </div>

      <div className="chips-wrap">
        {(['all', 'published', 'hidden', 'cancelled'] as const).map((s) => (
          <button key={s} className={`chip${filter === s ? ' is-on' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'Все' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="stack">
        {list.map((e) => (
          <div key={e.id} className="card admin-row">
            <Link to={`/event/${e.id}`} className="admin-row-main">
              <b>
                {sportMeta(e.sport).emoji} {e.title}
              </b>
              <span className="muted">
                {formatWhen(e)} · {e.venueName} · {e.registeredCount}/{e.capacity} · {e.organizerName}
              </span>
            </Link>
            <select
              className="input input-sm"
              value={e.status}
              onChange={(ev) => setStatus(e.id, ev.target.value as EventStatus)}
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
