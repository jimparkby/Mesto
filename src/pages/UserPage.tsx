import { Share, TelegramLogo } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { ProfileView } from '../components/ProfileView';
import { telegramLink } from '../domain/people';
import type { PublicProfile } from '../domain/types';
import { useEvents } from '../hooks';
import { platform } from '../platforms';
import { useToast } from '../state';

const TG_APP_LINK = import.meta.env.VITE_TG_APP_LINK as string | undefined;

/** Профиль другого человека: спортивный паспорт, оценки, занятия тренера; связь — в Telegram. */
export function UserPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { events } = useEvents();
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);

  useEffect(() => {
    setProfile(undefined);
    api
      .getProfile(id)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [id]);

  // Просмотр профиля — для воронки в статистике тренера.
  useEffect(() => {
    if (user && id && user.id !== id) api.trackProfileView(id).catch(() => {});
  }, [user, id]);

  const own = useMemo(() => events.filter((e) => e.organizerId === id), [events, id]);

  if (profile === undefined)
    return (
      <div className="page">
        <div className="card skeleton tall" />
      </div>
    );
  if (profile === null)
    return (
      <div className="page empty">
        <div className="empty-emoji">
          <Icon name="user" size={40} />
        </div>
        <p>Профиль не найден.</p>
        <Link to="/search" className="btn btn-ghost">
          К поиску
        </Link>
      </div>
    );

  const tg = telegramLink(profile.username);
  const share = () => {
    const url = TG_APP_LINK ? `${TG_APP_LINK}?startapp=user_${profile.id}` : location.href;
    platform
      .share(url, `${profile.name} в Mesto — ${profile.isCoach ? 'тренер' : 'игрок'}`)
      .then(() => platform.kind === 'web' && toast('Ссылка скопирована'))
      .catch(() => {});
  };

  return (
    <div className="page user-page">
      <h1 className="page-title">Профиль</h1>
      <ProfileView profile={profile} events={own} />

      {user?.id !== profile.id && (
        <div className="action-bar">
          <button className="btn btn-ghost btn-round" onClick={share} aria-label="Поделиться профилем">
            <Share size={22} weight="bold" />
          </button>
          {tg ? (
            <button className="btn btn-primary btn-grow" onClick={() => platform.openLink(tg)}>
              <TelegramLogo size={22} weight="fill" />
              Написать в Telegram
            </button>
          ) : (
            <button className="btn btn-ghost btn-grow" disabled>
              Нет Telegram для связи
            </button>
          )}
        </div>
      )}
    </div>
  );
}
