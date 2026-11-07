import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { LoginSheet } from '../components/LoginSheet';
import { PageHeader } from '../components/PageHeader';
import { SportIcon } from '../components/SportIcon';
import { Icon } from '../components/Icon';
import { MapView } from '../components/MapView';
import { scaleFor, withDivisionTag } from '../domain/levels';
import { LEVELS, SPORTS, EVENT_TYPES } from '../domain/sports';
import type { EventType, LatLng, Level, SportId } from '../domain/types';
import { useToast } from '../state';
import { CaretDown } from '@phosphor-icons/react';

function defaultDateTime(): string {
  const d = new Date(Date.now() + 24 * 3600_000);
  d.setMinutes(0, 0, 0);
  d.setHours(19);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Section = 'sport' | 'when' | 'where' | 'more';

interface ExpandableSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function ExpandableSection({ title, open, onToggle, children }: ExpandableSectionProps) {
  return (
    <div className="expandable">
      <button className={`expandable-header${open ? ' is-open' : ''}`} onClick={onToggle} aria-expanded={open}>
        <span className="expandable-title">{title}</span>
        <CaretDown size={18} weight="bold" className="expandable-chevron" />
      </button>
      {open && <div className="expandable-body">{children}</div>}
    </div>
  );
}

export function CreateEventPage() {
  const { user, refreshMyEvents } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openSection, setOpenSection] = useState<Section>('sport');

  const [sport, setSport] = useState<SportId>('football');
  const [eventType, setEventType] = useState<EventType>('game');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [when, setWhen] = useState(defaultDateTime);
  const [durationMin, setDuration] = useState(90);
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [level, setLevel] = useState<Level>('any');
  /** Метка дивизиона («Д3») — только у видов спорта с официальной шкалой (волейбол). */
  const [division, setDivision] = useState<string | null>(null);
  const [price, setPrice] = useState(0);
  const [capacity, setCapacity] = useState(10);

  const errors: string[] = [];
  if (title.trim().length < 3) errors.push('название');
  if (!venueName.trim()) errors.push('место');
  if (!point) errors.push('точку на карте');
  if (new Date(when).getTime() < Date.now()) errors.push('дату в будущем');

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (errors.length || !point) {
      toast(`Укажите ${errors.join(', ')}`, 'error');
      return;
    }
    setBusy(true);
    try {
      const created = await api.createEvent(
        {
          title: withDivisionTag(title.trim(), sport, division),
          sport,
          eventType,
          description: description.trim(),
          startsAt: new Date(when).toISOString(),
          durationMin,
          venueName: venueName.trim(),
          address: address.trim(),
          lat: point.lat,
          lng: point.lng,
          level,
          price,
          capacity,
        },
        user,
      );
      await refreshMyEvents();
      toast('Событие опубликовано', 'success');
      navigate(`/event/${created.id}`, { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const meta = sportMeta(sport);
  // Дивизионы вместо «Новичок/Продвинутый» — там, где по ним реально собирают игры (волейбол: Д1–Д5).
  const divisionScale = sport === 'volleyball' ? scaleFor(sport) : undefined;
  const whenDate = new Date(when);
  const whenLabel = `${whenDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · ${whenDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="page">
      <PageHeader eyebrow="Организатору" title="Новое событие" />

      {!user && (
        <div className="card callout">
          Чтобы создать событие, нужно представиться.{' '}
          <button type="button" className="link" onClick={() => setLoginOpen(true)}>
            Войти
          </button>
        </div>
      )}

      <form className="form create-form" onSubmit={submit}>
        <div className="widget-row">
          <div className={`widget widget-sport${openSection === 'sport' ? ' is-open' : ''}`} onClick={() => setOpenSection('sport')}>
            <SportIcon sport={sport} size={40} color={meta.color} />
            <div className="widget-body">
              <div className="widget-label">Вид спорта</div>
              <div className="widget-value">{meta.label}</div>
            </div>
            <CaretDown size={20} weight="bold" className="widget-chevron" />
          </div>

          <div className={`widget widget-when${openSection === 'when' ? ' is-open' : ''}`} onClick={() => setOpenSection('when')}>
            <Icon className="widget-icon" name="clock" size={40} color="#5ee7e3" />
            <div className="widget-body">
              <div className="widget-label">Когда</div>
              <div className="widget-value">{whenLabel}</div>
            </div>
            <CaretDown size={20} weight="bold" className="widget-chevron" />
          </div>

          <div className={`widget widget-where${openSection === 'where' ? ' is-open' : ''}`} onClick={() => setOpenSection('where')}>
            <Icon className="widget-icon" name="pin" size={40} color="#ff3b30" />
            <div className="widget-body">
              <div className="widget-label">Где</div>
              <div className="widget-value">{venueName || 'Не указано'}</div>
              <div className="widget-sub">{point ? 'Точка на карте отмечена' : 'Нажмите, чтобы выбрать место на карте'}</div>
            </div>
            <CaretDown size={20} weight="bold" className="widget-chevron" />
          </div>
        </div>

        {openSection === 'sport' && (
          <>
            <div className="sport-picker">
            <div className="section-title">Выберите вид спорта</div>
            <div className="chips-wrap">
              {SPORTS.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`chip${sport === s.id ? ' is-on' : ''}`}
                  onClick={() => {
                    setSport(s.id);
                    setDivision(null);
                    setLevel('any');
                  }}
                >
                  <SportIcon sport={s.id} size={20} color={sport === s.id ? undefined : s.color} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="label">Название события</span>
            <input className="input" maxLength={120} placeholder="Например: Футбол 5×5 после работы" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <div className="field">
            <div className="label">{divisionScale ? `Уровень · ${divisionScale.title}` : 'Уровень'}</div>
            <div className="chips-wrap">
              <button
                type="button"
                className={`chip${level === 'any' && !division ? ' is-on' : ''}`}
                onClick={() => {
                  setLevel('any');
                  setDivision(null);
                }}
              >
                Любой
              </button>
              {divisionScale
                ? divisionScale.divisions.map((d) => (
                    <button
                      type="button"
                      key={d.tag}
                      title={d.label}
                      className={`chip${division === d.tag ? ' is-on' : ''}`}
                      onClick={() => {
                        setDivision(d.tag);
                        setLevel(d.level);
                      }}
                    >
                      {d.tag}
                    </button>
                  ))
                : LEVELS.filter((l) => l.id !== 'any').map((l) => (
                    <button type="button" key={l.id} className={`chip${level === l.id ? ' is-on' : ''}`} onClick={() => setLevel(l.id)}>
                      {l.label}
                    </button>
                  ))}
            </div>
            {divisionScale && (
              <span className="hint">
                {division
                  ? divisionScale.divisions.find((d) => d.tag === division)?.label
                  : 'Д1 — сильнейший, Д5 — новички'}
              </span>
            )}
          </div>
        </>
        )}

        {openSection === 'when' && (
          <div className="expandable-body">
            <div className="field">
              <span className="label">Дата и время</span>
              <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <div className="field">
              <span className="label">Длительность</span>
              <select className="input" value={durationMin} onChange={(e) => setDuration(Number(e.target.value))}>
                {[30, 45, 60, 90, 120, 150, 180].map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} мин` : `${m / 60} ч`.replace('.5', ',5')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {openSection === 'where' && (
          <div className="expandable-body">
            <label className="field">
              <span className="label">Место</span>
              <input className="input" placeholder="Парк, стадион, спорткомплекс" value={venueName} onChange={(e) => setVenueName(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Адрес (необязательно)</span>
              <input className="input" placeholder="ул. Примерная, 1" value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            <div className="field">
              <span className="label">Точка на карте {point ? '✓ отмечена' : '— не выбрана'}</span>
              <div className="card no-pad map-pick-widget">
                <MapView pick={{ value: point, onPick: setPoint }} className="map-pick" zoom={11} />
              </div>
              {!point && (
                <button type="button" className="btn btn-ghost btn-block" onClick={() => setOpenSection('where')}>
                  Указать на карте
                </button>
              )}
            </div>
          </div>
        )}

        <ExpandableSection
          title="Ещё параметры (тип, цена, описание)"
          open={openSection === 'more'}
          onToggle={() => setOpenSection('more')}
        >
          <div className="field">
            <div className="label">Тип события</div>
            <div className="chips-wrap">
              {EVENT_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`chip${eventType === t.id ? ' is-on' : ''}`}
                  onClick={() => setEventType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid-2">
            <label className="field">
              <span className="label">Участников</span>
              <input className="input" type="number" min={2} max={500} value={capacity} onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label className="field">
              <span className="label">Цена, BYN</span>
              <input className="input" type="number" min={0} step={1} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>

          <label className="field">
            <span className="label">Описание</span>
            <textarea
              className="input"
              rows={3}
              placeholder="Что взять с собой, где встречаемся, какой темп…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </ExpandableSection>

        {user && (
          <div className="card organizer-card">
            <div className="organizer-body">
              <div className="widget-label">Организатор</div>
              <div className="organizer-name">{user.name}</div>
              {user.username ? (
                <div className="organizer-handle">@{user.username} — участники смогут написать вам в Telegram</div>
              ) : (
                <div className="organizer-handle muted">
                  Нет username в Telegram — участникам будет не написать. Войдите через Telegram или укажите контакт в описании.
                </div>
              )}
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="error-banner">
            {errors.map((e) => `Укажите ${e}`).join(', ')}
          </div>
        )}

        <button className="btn btn-primary btn-arrow btn-block" disabled={busy || errors.length > 0 || !point}>
          {busy ? 'Публикуем…' : 'Опубликовать'}
        </button>
      </form>

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} reason="Войдите, чтобы создать событие" />
    </div>
  );
}

function sportMeta(id: SportId) {
  return SPORTS.find((s) => s.id === id) ?? SPORTS[0];
}
