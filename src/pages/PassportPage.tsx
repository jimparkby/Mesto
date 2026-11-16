import { CaretLeft, Camera, Check, Plus, Trash, VideoCamera, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { LoginSheet } from '../components/LoginSheet';
import { SportIcon } from '../components/SportIcon';
import { SportPicker } from '../components/SportPicker';
import { CITIES, DEFAULT_CITY, LANGUAGES } from '../domain/cities';
import { MAX_PHOTOS, MAX_VIDEO_MB, MAX_VIDEOS } from '../domain/media';
import { SKILL_LEVELS, sportMeta } from '../domain/sports';
import type { Gender, Level, SportId, SportSkill } from '../domain/types';
import { platform } from '../platforms';
import { useCity, useToast } from '../state';

const STEPS = ['role', 'sports', 'info', 'about', 'media'] as const;
type Step = (typeof STEPS)[number];

const TITLES: Record<Step, string> = {
  role: 'Выберите роль',
  sports: 'Виды спорта',
  info: 'Информация',
  about: 'О себе',
  media: 'Фото и видео',
};

/** Спортивный паспорт: регистрация по шагам и его редактирование из профиля. */
export function PassportPage() {
  const { user, loading, savePassport, uploadMedia } = useAuth();
  const { setCity: setAppCity, chosen: cityChosen } = useCity();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const first = params.has('first') || (!!user && !user.onboarded);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<'photo' | 'video' | 'avatar' | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  // Черновик паспорта — из профиля.
  const [isCoach, setIsCoach] = useState(false);
  const [skills, setSkills] = useState<SportSkill[]>([]);
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [city, setCity] = useState(DEFAULT_CITY);
  const [languages, setLanguages] = useState<string[]>(['Русский']);
  const [bio, setBio] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);

  const userId = user?.id;
  useEffect(() => {
    if (!user) return;
    setIsCoach(user.isCoach);
    setSkills(user.skills);
    setName(user.name);
    setPhotoUrl(user.photoUrl ?? null);
    setGender(user.gender);
    setBirthDate(user.birthDate ?? '');
    setCity(user.city || DEFAULT_CITY);
    setLanguages(user.languages.length ? user.languages : ['Русский']);
    setBio(user.bio);
    setPhotos(user.photos);
    setVideos(user.videos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  if (loading) return <div className="page"><div className="card skeleton tall" /></div>;
  if (!user)
    return (
      <div className="page passport">
        <h1 className="page-title">Спортивный паспорт</h1>
        <p className="muted">Войдите, чтобы заполнить паспорт: виды спорта, уровень, фото и видео.</p>
        <button className="btn btn-primary" onClick={() => setLoginOpen(true)}>
          Войти
        </button>
        <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );

  const current = STEPS[step];

  const toggleSport = (sport: SportId) =>
    setSkills((list) => (list.some((s) => s.sport === sport) ? list.filter((s) => s.sport !== sport) : [...list, { sport, level: 'amateur' }]));
  const patchSkill = (sport: SportId, patch: Partial<SportSkill>) =>
    setSkills((list) => list.map((s) => (s.sport === sport ? { ...s, ...patch } : s)));

  const today = new Date();
  const maxBirth = `${today.getFullYear() - 6}-12-31`;
  const stepError = (s: Step): string | null => {
    if (s === 'sports' && skills.length === 0) return 'Выберите хотя бы один вид спорта';
    if (s === 'sports' && isCoach && skills.some((x) => !x.price)) return 'Укажите цену занятия для каждого вида спорта';
    if (s === 'info' && name.trim().length < 2) return 'Укажите имя';
    if (s === 'info' && !gender) return 'Укажите пол';
    if (s === 'info' && !birthDate) return 'Укажите дату рождения';
    if (s === 'info' && (birthDate < '1920-01-01' || birthDate > maxBirth)) return 'Проверьте дату рождения';
    return null;
  };
  const error = stepError(current);

  const upload = async (files: FileList | null, kind: 'photo' | 'video' | 'avatar') => {
    if (!files?.length) return;
    setUploading(kind);
    try {
      for (const file of Array.from(files)) {
        if (kind === 'video' && file.size > MAX_VIDEO_MB * 1024 * 1024) {
          toast(`Видео «${file.name}» больше ${MAX_VIDEO_MB} МБ`, 'error');
          continue;
        }
        const url = await uploadMedia(file, kind);
        if (kind === 'avatar') setPhotoUrl(url);
        else if (kind === 'photo') setPhotos((p) => (p.length < MAX_PHOTOS ? [...p, url] : p));
        else setVideos((v) => (v.length < MAX_VIDEOS ? [...v, url] : v));
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setUploading(null);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await savePassport({
        isCoach,
        skills,
        name,
        photoUrl,
        gender,
        birthDate: birthDate || null,
        city,
        languages,
        bio,
        photos,
        videos,
      });
      if (!cityChosen) setAppCity(city);
      toast(first ? 'Паспорт готов! Добро пожаловать в Mesto' : 'Профиль обновлён', 'success');
      navigate(first ? '/' : '/profile', { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (error) return toast(error, 'error');
    platform.haptic('selection');
    if (step === STEPS.length - 1) finish();
    else setStep(step + 1);
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
    else if (!first) navigate(-1);
  };

  return (
    <div className="page passport">
      <div className="passport-top">
        {step > 0 || !first ? (
          <button type="button" className="passport-back" onClick={back} aria-label="Назад">
            <CaretLeft size={22} weight="bold" />
          </button>
        ) : (
          <span className="passport-back is-empty" />
        )}
        <div className="passport-dots" aria-label={`Шаг ${step + 1} из ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className={i === step ? 'is-on' : i < step ? 'is-done' : ''} />
          ))}
        </div>
        <span className="passport-back is-empty" />
      </div>

      <h1 className="passport-title">{TITLES[current]}</h1>

      {current === 'role' && (
        <div className="role-cards">
          {[
            { coach: false, title: 'Игрок', text: 'Я хочу найти игроков своего уровня или тренера, чтобы улучшить свои навыки.', icon: 'user' as const },
            { coach: true, title: 'Тренер', text: 'Я хочу найти людей для обучения и помочь им улучшить свои навыки.', icon: 'coach' as const },
          ].map((r) => (
            <button key={r.title} type="button" className={`role-card${isCoach === r.coach ? ' is-on' : ''}`} onClick={() => setIsCoach(r.coach)}>
              <span className="role-card-icon">
                <Icon name={r.icon} size={26} />
              </span>
              <span className="role-card-body">
                <b>{r.title}</b>
                <span>{r.text}</span>
              </span>
              <span className="role-card-check">{isCoach === r.coach && <Check size={14} weight="bold" />}</span>
            </button>
          ))}
        </div>
      )}

      {current === 'sports' && (
        <>
          <p className="muted">
            {isCoach ? 'Что вы тренируете: стаж и цена занятия видны ученикам.' : 'Выберите любимые виды спорта и честно укажите уровень — так проще найти партнёров.'}
          </p>
          <SportPicker multi values={skills.map((s) => s.sport)} onToggle={toggleSport} />
          {skills.length > 0 && (
            <div className="stack">
              {skills.map((s) => {
                const m = sportMeta(s.sport);
                return (
                  <div key={s.sport} className="card skill-edit">
                    <div className="skill-edit-head">
                      <SportIcon sport={s.sport} size={22} color={m.color} />
                      <b>{m.label}</b>
                      <button type="button" className="icon-btn" onClick={() => toggleSport(s.sport)} aria-label={`Убрать ${m.label}`}>
                        <X size={16} weight="bold" />
                      </button>
                    </div>
                    <div className="chips-wrap">
                      {SKILL_LEVELS.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          className={`chip chip-level${s.level === l.id ? ' is-on' : ''}`}
                          onClick={() => patchSkill(s.sport, { level: l.id as Level })}
                        >
                          {l.label}
                          <small>{l.short}</small>
                        </button>
                      ))}
                    </div>
                    {isCoach && (
                      <div className="grid-2">
                        <label className="field">
                          <span className="label">Обучаю, лет</span>
                          <input
                            className="input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={60}
                            placeholder="0"
                            value={s.years || ''}
                            onChange={(e) => patchSkill(s.sport, { years: Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)) })}
                          />
                        </label>
                        <label className="field">
                          <span className="label">Цена занятия, BYN</span>
                          <input
                            className="input"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            placeholder="30"
                            value={s.price || ''}
                            onChange={(e) => patchSkill(s.sport, { price: Math.max(0, Math.min(10000, parseInt(e.target.value, 10) || 0)) })}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {current === 'info' && (
        <>
          <div className="avatar-edit">
            <Avatar name={name || user.name} photoUrl={photoUrl} size={84} />
            <button type="button" className="btn btn-ghost btn-sm" disabled={!!uploading} onClick={() => avatarInput.current?.click()}>
              <Camera size={16} weight="fill" /> {uploading === 'avatar' ? 'Загружаем…' : 'Сменить фото'}
            </button>
            <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files, 'avatar')} />
          </div>
          <label className="field">
            <span className="label">Имя</span>
            <input className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field">
            <div className="label">Пол</div>
            <div className="segmented full">
              <button type="button" className={gender === 'female' ? 'is-on' : ''} onClick={() => setGender('female')}>
                Женский
              </button>
              <button type="button" className={gender === 'male' ? 'is-on' : ''} onClick={() => setGender('male')}>
                Мужской
              </button>
            </div>
          </div>
          <label className="field">
            <span className="label">Дата рождения</span>
            <input className="input" type="date" min="1920-01-01" max={maxBirth} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            <span className="hint">Другим виден только возраст.</span>
          </label>
          <label className="field">
            <span className="label">Город</span>
            <select className="input" value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <div className="field">
            <div className="label">Языки</div>
            <div className="chips-wrap">
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`chip${languages.includes(l) ? ' is-on' : ''}`}
                  onClick={() => setLanguages((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]))}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {current === 'about' && (
        <label className="field">
          <span className="label">{isCoach ? 'Опыт и достижения' : 'Пара слов о себе'}</span>
          <textarea
            className="input"
            rows={6}
            maxLength={600}
            placeholder={
              isCoach
                ? 'Опыт игры — 8 лет, обучаю 3 года. Серебряный призёр чемпионата страны. Работаю с новичками и любителями.'
                : 'Играю в падел второй год. Ищу компанию на вечерние игры :)'
            }
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <span className="hint">{bio.length}/600</span>
        </label>
      )}

      {current === 'media' && (
        <>
          <p className="muted">Фото и спортивные видео помогают понять уровень ещё до первого сообщения. Можно добавить позже.</p>
          <section className="card media-card">
            <h2 className="card-h">
              Фото <span className="muted">{photos.length}/{MAX_PHOTOS}</span>
            </h2>
            <div className="media-grid">
              {photos.map((url) => (
                <div key={url} className="media-cell">
                  <img src={url} alt="" />
                  <button type="button" className="media-remove" onClick={() => setPhotos((p) => p.filter((x) => x !== url))} aria-label="Удалить фото">
                    <Trash size={16} weight="bold" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" className="media-cell media-add" disabled={!!uploading} onClick={() => photoInput.current?.click()}>
                  {uploading === 'photo' ? '…' : <Plus size={26} weight="bold" />}
                  <span>Фото</span>
                </button>
              )}
            </div>
            <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files, 'photo')} />
          </section>
          <section className="card media-card">
            <h2 className="card-h">
              Видео <span className="muted">{videos.length}/{MAX_VIDEOS}</span>
            </h2>
            <div className="media-grid">
              {videos.map((url) => (
                <div key={url} className="media-cell is-video">
                  <video src={`${url}#t=0.5`} preload="metadata" muted playsInline />
                  <button type="button" className="media-remove" onClick={() => setVideos((v) => v.filter((x) => x !== url))} aria-label="Удалить видео">
                    <Trash size={16} weight="bold" />
                  </button>
                </div>
              ))}
              {videos.length < MAX_VIDEOS && (
                <button type="button" className="media-cell media-add" disabled={!!uploading} onClick={() => videoInput.current?.click()}>
                  {uploading === 'video' ? '…' : <VideoCamera size={26} weight="fill" />}
                  <span>Видео до {MAX_VIDEO_MB} МБ</span>
                </button>
              )}
            </div>
            <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => upload(e.target.files, 'video')} />
          </section>
        </>
      )}

      <div className="passport-actions">
        {error && <p className="hint passport-error">{error}</p>}
        <button className="btn btn-primary btn-arrow btn-block" disabled={busy || !!uploading} onClick={next}>
          {busy ? 'Сохраняем…' : step === STEPS.length - 1 ? (first ? 'Готово' : 'Сохранить') : 'Продолжить'}
        </button>
      </div>
    </div>
  );
}
