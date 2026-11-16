import { ChartLineUp, Desktop, MoonStars, PencilSimple, Sun, TelegramLogo } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { EventCard } from '../components/EventCard';
import { Icon, IconTile, TILE } from '../components/Icon';
import { LoginSheet } from '../components/LoginSheet';
import { ProfileView } from '../components/ProfileView';
import { isPast } from '../domain/events';
import type { CoachStats } from '../domain/types';
import { useEvents } from '../hooks';
import { platform } from '../platforms';
import { useTheme, type ThemeMode } from '../theme';
import { version } from '../../package.json';

const THEME_OPTIONS: { id: ThemeMode; label: string; Glyph: typeof Sun }[] = [
  { id: 'system', label: 'Система', Glyph: Desktop },
  { id: 'light', label: 'Светлая', Glyph: Sun },
  { id: 'dark', label: 'Тёмная', Glyph: MoonStars },
];

const TG_APP_LINK = import.meta.env.VITE_TG_APP_LINK as string | undefined;

/** Чат с командой — тот же бот, что присылает коды и заявки. */
export function teamChatUrl(): string | null {
  const m = /^https:\/\/t\.me\/([A-Za-z0-9_]+)/.exec(TG_APP_LINK ?? '');
  return m ? `https://t.me/${m[1]}` : null;
}

export function ProfilePage() {
  const { user, loading, error, signOut, myEventIds } = useAuth();
  const { events } = useEvents({ includeHidden: true });
  const { mode, setMode } = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'mine' | 'past'>('upcoming');
  const [stats, setStats] = useState<CoachStats | null>(null);

  const lists = useMemo(() => {
    // Отменённые события в профиле не показываем и не считаем.
    const active = events.filter((e) => e.status !== 'cancelled');
    const joined = active.filter((e) => myEventIds.has(e.id));
    return {
      upcoming: joined.filter((e) => !isPast(e)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      mine: active.filter((e) => e.organizerId === user?.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      past: joined.filter((e) => isPast(e)).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    };
  }, [events, myEventIds, user?.id]);

  const isCoach = !!user?.isCoach;
  useEffect(() => {
    if (user && isCoach) api.coachStats(user, 30, null).then(setStats).catch(() => setStats(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isCoach]);

  if (loading)
    return (
      <div className="page">
        <div className="card skeleton" />
      </div>
    );

  if (!user)
    return (
      <div className="page">
        <header className="profile-head">
          <Avatar name="?" size={88} />
          <h1 className="big-title">Вы не вошли</h1>
          <p className="muted">Войдите, чтобы заполнить спортивный паспорт, записываться и создавать события.</p>
          <button className="btn btn-primary" onClick={() => setLoginOpen(true)}>
            Войти
          </button>
        </header>
        {error && <p className="hint">Ошибка входа: {error}</p>}
        <ThemeCard mode={mode} setMode={setMode} />
        <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );

  const team = teamChatUrl();
  const own = events.filter((e) => e.organizerId === user.id);

  return (
    <div className="page profile-page">
      <div className="page-title-row">
        <h1 className="page-title">Профиль</h1>
        <Link to="/passport" className="btn-edit">
          Изменить <PencilSimple size={14} weight="bold" />
        </Link>
      </div>

      {!user.onboarded && (
        <Link to="/passport" className="card callout">
          Заполните спортивный паспорт — без него вас не найдут в поиске. <b>Заполнить →</b>
        </Link>
      )}

      <ProfileView profile={user} events={own} />

      {isCoach && (
        <section className="card coach-stats-mini">
          <div className="section-row">
            <h2 className="card-h">Статистика</h2>
            <Link to="/stats" className="link">
              Детали
            </Link>
          </div>
          <div className="coach-stats-total">
            Общий доход: <b>{stats ? `${stats.totalIncome} BYN` : '—'}</b>
          </div>
          <div className="coach-stats-grid">
            <div>
              <span className="muted">Брони за 30 дней</span>
              <b>{stats?.funnel.bookings ?? '—'}</b>
            </div>
            <div>
              <span className="muted">Проведено</span>
              <b>{stats?.funnel.held ?? '—'}</b>
            </div>
            <div>
              <span className="muted">Просмотры профиля</span>
              <b>{stats?.funnel.views ?? '—'}</b>
            </div>
          </div>
          <Link to="/stats" className="btn btn-tonal btn-block">
            <ChartLineUp size={18} weight="bold" /> Графики и воронка
          </Link>
        </section>
      )}

      <h2 className="section-label">Мои события</h2>
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
          Организую
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
              {tab === 'mine' ? 'Создать событие' : 'Найти игру'}
            </Link>
          </div>
        )}
      </div>

      <ThemeCard mode={mode} setMode={setMode} />

      <section className="card settings">
        {team && (
          <button className="settings-row" onClick={() => platform.openLink(team)}>
            <span className="icon-tile" style={{ background: '#229ed9', width: 30, height: 30 }}>
              <TelegramLogo size={18} weight="fill" color="#fff" />
            </span>
            <span className="grow">Написать команде Mesto</span>
            <Icon name="chevron" size={18} weight="bold" className="muted" />
          </button>
        )}
        {user.role === 'admin' && (
          <Link to="/admin" className="settings-row">
            <IconTile name="shield" color={TILE.indigo} />
            <span className="grow">Модерация событий</span>
            <Icon name="chevron" size={18} weight="bold" className="muted" />
          </Link>
        )}
        {user.provider !== 'telegram' && (
          <button className="settings-row danger" onClick={signOut}>
            <IconTile name="logout" color={TILE.red} />
            <span className="grow">Выйти</span>
          </button>
        )}
      </section>

      <p className="footer-note">Mesto {version}</p>

    </div>
  );
}

function ThemeCard({ mode, setMode }: { mode: ThemeMode; setMode: (m: ThemeMode) => void }) {
  return (
    <section className="card settings">
      <div className="label">Оформление</div>
      <div className="segmented full theme-segment">
        {THEME_OPTIONS.map(({ id, label, Glyph }) => (
          <button key={id} className={mode === id ? 'is-on' : ''} onClick={() => setMode(id)}>
            <Glyph size={15} weight="fill" />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
