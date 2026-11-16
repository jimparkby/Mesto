import { Bell, CalendarX, ChatText, CheckCircle, Star, UserPlus, XCircle, HandWaving } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { NotificationKind } from '../domain/types';

const ICONS: Record<NotificationKind, { Glyph: typeof Bell; color: string }> = {
  welcome: { Glyph: HandWaving, color: '#9e212e' },
  request_new: { Glyph: UserPlus, color: '#007aff' },
  request_approved: { Glyph: CheckCircle, color: '#34c759' },
  request_rejected: { Glyph: XCircle, color: '#ff3b30' },
  comment: { Glyph: ChatText, color: '#5856d6' },
  rate_reminder: { Glyph: Star, color: '#ff9500' },
  event_cancelled: { Glyph: CalendarX, color: '#8e8e93' },
};

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** Уведомления: заявки, решения организаторов, комментарии, напоминания оценить игру. */
export function NotificationsPage() {
  const { user, notifications, markNotificationsRead, refreshNotifications } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    refreshNotifications()
      .then(() => markNotificationsRead())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user)
    return (
      <div className="page empty">
        <p>Войдите, чтобы видеть уведомления.</p>
      </div>
    );

  return (
    <div className="page">
      <h1 className="page-title">Уведомления</h1>
      {notifications.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">
            <Bell size={44} weight="fill" />
          </div>
          <p>Пока тихо. Здесь появятся заявки, ответы организаторов и напоминания оценить игру.</p>
        </div>
      )}
      <div className="card notif-list">
        {notifications.map((n) => {
          const { Glyph, color } = ICONS[n.kind] ?? ICONS.welcome;
          return (
            <button
              key={n.id}
              type="button"
              className={`notif${n.read ? '' : ' is-new'}`}
              onClick={() => n.link && navigate(n.link)}
              disabled={!n.link}
            >
              <span className="notif-icon" style={{ background: color }}>
                <Glyph size={18} weight="fill" color="#fff" />
              </span>
              <span className="notif-body">
                <b>{n.title}</b>
                {n.body && <span>{n.body}</span>}
                <small className="muted">{ago(n.createdAt)}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
