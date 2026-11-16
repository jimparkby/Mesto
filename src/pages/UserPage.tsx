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
  const [busy, setBusy] = useState(false);

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

  const grantPremium = async (days: number) => {
    setBusy(true);
    try {
      await api.adminSetPremium(profile.id, days);
      setProfile(await api.getProfile(profile.id));
      toast(days > 0 ? `Premium выдан на ${days} дней` : 'Premium снят', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page user-page">
      <h1 className="page-title">Профиль</h1>
      <ProfileView profile={profile} events={own}>
        {user?.role === 'admin' && api.mode === 'supabase' && (
          <section className="card settings">
            <div className="label">Админ</div>
            <button className="settings-row" disabled={busy} onClick={() => grantPremium(30)}>
              <span className="grow">{profile.premium ? 'Продлить Premium на 30 дней' : 'Выдать Premium на 30 дней'}</span>
            </button>
            {profile.premium && (
              <button className="settings-row danger" disabled={busy} onClick={() => grantPremium(0)}>
                <span className="grow">Снять Premium</span>
              </button>
            )}
          </section>
        )}
      </ProfileView>

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
