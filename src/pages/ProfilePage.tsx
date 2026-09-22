import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { EventCard } from '../components/EventCard';
import { LoginSheet } from '../components/LoginSheet';
import { isPast } from '../domain/events';
import { useEvents } from '../hooks';
import { platform } from '../platforms';

const PLATFORM_LABEL = { telegram: 'Telegram Mini App', native: 'Android-приложение', web: 'Веб-версия' };

export function ProfilePage() {
  const { user, loading, error, signOut, myEventIds } = useAuth();
  const { events } = useEvents({ includeHidden: true });
  const [loginOpen, setLoginOpen] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'mine' | 'past'>('upcoming');

  const lists = useMemo(() => {
    const joined = events.filter((e) => myEventIds.has(e.id));
    return {
      upcoming: joined.filter((e) => !isPast(e)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      mine: events.filter((e) => e.organizerId === user?.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      past: joined.filter((e) => isPast(e)).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    };
  }, [events, myEventIds, user?.id]);

  if (loading) return <div className="page"><div className="card skeleton" /></div>;

  return (
    <div className="page">
      {user ? (
        <div className="card profile-card">
          <Avatar name={user.name} photoUrl={user.photoUrl} size={64} />
          <div className="grow">
            <h1 className="h1">{user.name}</h1>
            <div className="muted">
              {user.username ? `@${user.username} · ` : ''}
              {user.provider === 'telegram' ? 'вход через Telegram' : 'гость'}
            </div>
          </div>
        </div>
      ) : (
        <div className="card profile-card">
          <Avatar name="?" size={64} />
          <div className="grow">
            <h1 className="h1">Вы не вошли</h1>
            <button className="btn btn-primary" onClick={() => setLoginOpen(true)}>
              Войти
            </button>
          </div>
        </div>
      )}
      {error && <p className="hint">Ошибка входа: {error}</p>}

      <div className="stats">
        <div className="stat">
          <b>{lists.upcoming.length}</b>
          <span>впереди</span>
        </div>
        <div className="stat">
          <b>{lists.past.length}</b>
          <span>посещено</span>
        </div>
        <div className="stat">
          <b>{lists.mine.length}</b>
          <span>организовано</span>
        </div>
      </div>

      <div className="segmented full">
        <button className={tab === 'upcoming' ? 'is-on' : ''} onClick={() => setTab('upcoming')}>
          Я иду
        </button>
        <button className={tab === 'mine' ? 'is-on' : ''} onClick={() => setTab('mine')}>
          Мои события
        </button>
        <button className={tab === 'past' ? 'is-on' : ''} onClick={() => setTab('past')}>
          История
        </button>
      </div>

      <div className="stack">
        {lists[tab].map((e) => (
          <EventCard key={e.id} event={e} joined={myEventIds.has(e.id)} compact />
        ))}
        {lists[tab].length === 0 && (
          <div className="empty">
            <p className="muted">
              {tab === 'mine' ? 'Вы ещё не создавали событий.' : tab === 'past' ? 'История пока пуста.' : 'Вы пока никуда не записаны.'}
            </p>
            <Link className="btn btn-ghost" to={tab === 'mine' ? '/create' : '/'}>
              {tab === 'mine' ? 'Создать событие' : 'Найти тренировку'}
            </Link>
          </div>
        )}
      </div>

      <section className="card settings">
        {user?.role === 'admin' && (
          <Link to="/admin" className="settings-row">
            🛡️ Модерация событий <span className="muted">›</span>
          </Link>
        )}
        <div className="settings-row">
          📱 Платформа <span className="muted">{PLATFORM_LABEL[platform.kind]}</span>
        </div>
        <div className="settings-row">
          🗄️ Данные <span className="muted">{api.mode === 'demo' ? 'демо (на устройстве)' : 'Supabase'}</span>
        </div>
        {user && user.provider !== 'telegram' && (
          <button className="settings-row danger" onClick={signOut}>
            Выйти
          </button>
        )}
      </section>

      <p className="footer-note">СпортРядом · MVP для Space University 2026</p>

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
