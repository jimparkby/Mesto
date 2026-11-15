import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { SportIcon } from '../components/SportIcon';
import { levelLabel, sportMeta } from '../domain/sports';
import type { PublicProfile, SportId } from '../domain/types';
import { platform } from '../platforms';

function SportChips({ sports }: { sports: SportId[] }) {
  return (
    <div className="chips-wrap">
      {sports.map((id) => {
        const s = sportMeta(id);
        return (
          <span key={id} className="chip-sm">
            <SportIcon sport={id} size={14} color={s.color} /> {s.label}
          </span>
        );
      })}
    </div>
  );
}

/** Профиль другого человека: участника события или организатора. */
export function UserPage() {
  const { id = '' } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);

  useEffect(() => {
    setProfile(undefined);
    api
      .getProfile(id)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [id]);

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
        <Link to="/events" className="btn btn-ghost">
          К списку событий
        </Link>
      </div>
    );

  const about = profile.about;
  const aboutEmpty = !about || (!about.bio && about.sports.length === 0 && about.level === 'any');

  return (
    <div className="page">
      <header className="profile-head">
        <Avatar name={profile.name} photoUrl={profile.photoUrl} size={88} />
        <h1 className="big-title">{profile.name}</h1>
        {profile.coach && (
          <span className="badge badge-coach">
            <Icon name="coach" size={12} /> Тренер
          </span>
        )}
        {profile.username && <div className="muted">@{profile.username}</div>}
        {profile.username && (
          <button className="btn btn-primary btn-sm" onClick={() => platform.openLink(`https://t.me/${profile.username}`)}>
            <Icon name="chat" size={16} /> Написать
          </button>
        )}
      </header>

      <section className="card about">
        <h2 className="h2">О себе</h2>
        {aboutEmpty ? (
          <p className="muted">Раздел «О себе» пока не заполнен.</p>
        ) : (
          <>
            {about!.bio && <p className="prewrap">{about!.bio}</p>}
            {about!.sports.length > 0 && <SportChips sports={about!.sports} />}
            {about!.level !== 'any' && (
              <p className="about-level">
                <Icon name="level" size={16} /> Уровень: {levelLabel(about!.level)}
              </p>
            )}
          </>
        )}
      </section>

      {profile.coach && (
        <section className="card about">
          <h2 className="h2">Тренер</h2>
          {profile.coach.bio && <p className="prewrap">{profile.coach.bio}</p>}
          {profile.coach.sports.length > 0 && <SportChips sports={profile.coach.sports} />}
          {profile.coach.years > 0 && (
            <p className="about-level">
              <Icon name="coach" size={16} /> Стаж: {profile.coach.years} г.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
