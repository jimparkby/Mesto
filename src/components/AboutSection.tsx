import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { levelLabel, LEVELS, SPORTS, sportMeta } from '../domain/sports';
import type { AboutMe, Level, SportId } from '../domain/types';
import { useToast } from '../state';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

const EMPTY: AboutMe = { bio: '', sports: [], level: 'any' };

/** Раздел «О себе»: пара слов, любимые виды спорта и уровень. */
export function AboutSection() {
  const { user, updateAbout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AboutMe>(EMPTY);
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const about = user.about ?? EMPTY;
  const isEmpty = !about.bio && about.sports.length === 0 && about.level === 'any';

  const edit = () => {
    setDraft(about);
    setOpen(true);
  };

  const toggleSport = (id: SportId) =>
    setDraft((d) => ({ ...d, sports: d.sports.includes(id) ? d.sports.filter((s) => s !== id) : [...d.sports, id] }));

  const save = async () => {
    setBusy(true);
    try {
      await updateAbout({ ...draft, bio: draft.bio.trim() });
      toast('Профиль обновлён', 'success');
      setOpen(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card about">
      <div className="about-head">
        <h2 className="h2">О себе</h2>
        <button className="btn-edit" onClick={edit}>
          {isEmpty ? 'Заполнить' : 'Изменить'}
          <Icon name="edit" size={14} />
        </button>
      </div>

      {isEmpty ? (
        <p className="muted">Расскажите, чем занимаетесь и с кем хотите играть — так проще найти компанию.</p>
      ) : (
        <>
          {about.bio && <p className="prewrap">{about.bio}</p>}
          {about.sports.length > 0 && (
            <div className="chips-wrap">
              {about.sports.map((id) => {
                const s = sportMeta(id);
                return (
                  <span key={id} className="chip-sm">
                    {s.emoji} {s.label}
                  </span>
                );
              })}
            </div>
          )}
          {about.level !== 'any' && (
            <p className="about-level">
              <Icon name="level" size={16} /> Уровень: {levelLabel(about.level)}
            </p>
          )}
        </>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="О себе">
        <label className="field">
          <span className="label">Пара слов</span>
          <textarea
            className="input"
            rows={3}
            maxLength={300}
            placeholder="Бегаю по утрам в Лошицком парке, ищу компанию на футбол по выходным"
            value={draft.bio}
            onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
          />
        </label>
        <div className="field">
          <div className="label">Любимые виды спорта</div>
          <div className="chips-wrap">
            {SPORTS.map((s) => (
              <button
                key={s.id}
                className={`chip${draft.sports.includes(s.id) ? ' is-on' : ''}`}
                onClick={() => toggleSport(s.id)}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <div className="label">Мой уровень</div>
          <div className="chips-wrap">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                className={`chip${draft.level === l.id ? ' is-on' : ''}`}
                onClick={() => setDraft((d) => ({ ...d, level: l.id as Level }))}
              >
                {l.id === 'any' ? 'Не указан' : l.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-arrow" disabled={busy} onClick={save}>
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </Sheet>
    </section>
  );
}
