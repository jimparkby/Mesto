import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { SPORTS, sportMeta } from '../domain/sports';
import type { CoachProfile, SportId } from '../domain/types';
import { useToast } from '../state';
import { Icon, IconTile, TILE } from './Icon';
import { Sheet } from './Sheet';
import { SportIcon } from './SportIcon';

const EMPTY: CoachProfile = { bio: '', sports: [], years: 0 };

function yearsLabel(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return `${n} год`;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} года`;
  return `${n} лет`;
}

/** Строка настроек «Профиль тренера»: включить, заполнить, выключить. */
export function CoachSettingsRow() {
  const { user, updateCoach } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CoachProfile>(EMPTY);
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const coach = user.coach ?? null;

  const edit = () => {
    setDraft(coach ?? { ...EMPTY, sports: user.about?.sports ?? [] });
    setOpen(true);
  };

  const toggleSport = (id: SportId) =>
    setDraft((d) => ({ ...d, sports: d.sports.includes(id) ? d.sports.filter((s) => s !== id) : [...d.sports, id] }));

  const save = async (next: CoachProfile | null) => {
    if (next && next.sports.length === 0) {
      toast('Выберите хотя бы один вид спорта', 'error');
      return;
    }
    setBusy(true);
    try {
      await updateCoach(next && { ...next, bio: next.bio.trim() });
      toast(next ? (coach ? 'Профиль тренера обновлён' : 'Вы тренер! Теперь можно выставлять объявления') : 'Профиль тренера выключен', 'success');
      setOpen(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="settings-row" onClick={edit}>
        <IconTile name="coach" color={TILE.orange} />
        <span className="grow">Профиль тренера</span>
        <span className="muted">{coach ? 'Включён' : 'Выключен'}</span>
        <Icon name="chevron" size={18} weight="bold" className="muted" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Профиль тренера">
        <p className="muted">
          Тренеры выставляют объявления о тренировках — их события в ленте отмечены значком «Тренер».
        </p>
        <div className="field">
          <div className="label">Что тренирую</div>
          <div className="chips-wrap">
            {SPORTS.map((s) => (
              <button
                key={s.id}
                className={`chip${draft.sports.includes(s.id) ? ' is-on' : ''}`}
                onClick={() => toggleSport(s.id)}
              >
                <SportIcon sport={s.id} size={18} color={draft.sports.includes(s.id) ? undefined : s.color} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="label">Стаж, лет</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            value={draft.years}
            onChange={(e) => setDraft((d) => ({ ...d, years: Math.max(0, Math.min(60, Number(e.target.value) || 0)) }))}
          />
        </label>
        <label className="field">
          <span className="label">О себе как о тренере</span>
          <textarea
            className="input"
            rows={4}
            maxLength={500}
            placeholder="КМС по волейболу, веду группы для начинающих и любителей, ставлю подачу и приём"
            value={draft.bio}
            onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
          />
        </label>
        <button className="btn btn-primary btn-arrow" disabled={busy} onClick={() => save(draft)}>
          {busy ? 'Сохраняем…' : coach ? 'Сохранить' : 'Стать тренером'}
        </button>
        {coach && (
          <button className="btn btn-ghost" disabled={busy} onClick={() => save(null)}>
            Выключить профиль тренера
          </button>
        )}
      </Sheet>
    </>
  );
}

/** Карточка тренера в профиле — видна, когда профиль тренера включён. */
export function CoachCard() {
  const { user } = useAuth();
  const coach = user?.coach;
  if (!coach) return null;
  return (
    <section className="card about">
      <div className="about-head">
        <h2 className="h2">Я тренер</h2>
        {coach.years > 0 && <span className="badge badge-coach">стаж {yearsLabel(coach.years)}</span>}
      </div>
      {coach.bio && <p className="prewrap">{coach.bio}</p>}
      <div className="chips-wrap">
        {coach.sports.map((id) => {
          const s = sportMeta(id);
          return (
            <span key={id} className="chip-sm">
              <SportIcon sport={id} size={14} color={s.color} /> {s.label}
            </span>
          );
        })}
      </div>
    </section>
  );
}
