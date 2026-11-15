import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { LevelsInfoSheet } from '../components/LevelsInfoSheet';
import { LoginSheet } from '../components/LoginSheet';
import { MapPicker } from '../components/MapPicker';
import { PageHeader } from '../components/PageHeader';
import { SportIcon } from '../components/SportIcon';
import { Icon } from '../components/Icon';
import { distanceKm, formatDistance } from '../domain/events';
import { geocodeAddress, reverseGeocode, SAME_PLACE_M } from '../domain/geocode';
import { scaleFor, withDivisionTag } from '../domain/levels';
import { LEVELS, SPORTS, EVENT_TYPES } from '../domain/sports';
import type { EventType, LatLng, Level, SportId } from '../domain/types';
import { useToast } from '../state';
import { CaretDown, Info } from '@phosphor-icons/react';

/** Поиск координат по адресу: идёт, нашли, не нашли. */
type AddressLookup = { state: 'idle' } | { state: 'searching' } | { state: 'found'; point: LatLng } | { state: 'missing' };

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

  // Тренер выставляет объявление о тренировке по своему виду спорта.
  const [sport, setSport] = useState<SportId>(() => user?.coach?.sports[0] ?? 'football');
  const [eventType, setEventType] = useState<EventType>(() => (user?.coach ? 'training' : 'game'));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [when, setWhen] = useState(defaultDateTime);
  const [durationMin, setDuration] = useState(90);
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  /** Точка, отмеченная на карте вручную. */
  const [point, setPoint] = useState<LatLng | null>(null);
  /** Адрес подставлен по точке — сверять его с точкой не нужно. */
  const [addressFromPoint, setAddressFromPoint] = useState(false);
  const [lookup, setLookup] = useState<AddressLookup>({ state: 'idle' });
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [level, setLevel] = useState<Level>('any');
  /** Метка дивизиона («Д3») — только у видов спорта с официальной шкалой (волейбол). */
  const [division, setDivision] = useState<string | null>(null);
  const [price, setPrice] = useState(0);
  const [capacity, setCapacity] = useState(10);

  // Адрес → координаты (с паузой после ввода). Адрес, подставленный по точке, не ищем.
  const addressText = address.trim();
  useEffect(() => {
    if (addressText.length < 4 || addressFromPoint) {
      setLookup({ state: 'idle' });
      return;
    }
    setLookup({ state: 'searching' });
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      geocodeAddress(addressText, ctrl.signal)
        .then((p) => setLookup(p ? { state: 'found', point: p } : { state: 'missing' }))
        .catch((e) => {
          if (!ctrl.signal.aborted) setLookup({ state: 'missing' });
          console.warn('geocode', e);
        });
    }, 800);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [addressText, addressFromPoint]);

  // Точку отметили, а адрес не ввели — подставляем адрес по точке.
  useEffect(() => {
    if (!point || (addressText && !addressFromPoint)) return;
    const ctrl = new AbortController();
    reverseGeocode(point, ctrl.signal)
      .then((a) => {
        if (!a) return;
        setAddress(a);
        setAddressFromPoint(true);
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point]);

  const addressPoint = lookup.state === 'found' ? lookup.point : null;
  /** Место события: отмеченная точка, иначе — найденная по адресу. */
  const place = point ?? addressPoint;
  const mismatchKm = point && addressPoint ? distanceKm(point, addressPoint) : 0;
  const mismatch = mismatchKm * 1000 > SAME_PLACE_M;

  const errors: string[] = [];
  if (title.trim().length < 3) errors.push('название');
  if (!point && !addressText) errors.push('адрес или точку на карте');
  else if (!point && lookup.state === 'missing') errors.push('адрес, который есть на карте, или отметьте точку');
  else if (mismatch) errors.push('одно место: адрес и точка на карте не совпадают');
  if (new Date(when).getTime() < Date.now()) errors.push('дату в будущем');
  const searching = !point && lookup.state === 'searching';

  const changeAddress = (v: string) => {
    setAddress(v);
    setAddressFromPoint(false);
  };

  const pointToAddress = () => {
    if (addressPoint) setPoint(addressPoint);
  };

  const addressToPoint = async () => {
    if (!point) return;
    const a = await reverseGeocode(point).catch(() => null);
    if (a) {
      setAddress(a);
      setAddressFromPoint(true);
    } else toast('Не удалось определить адрес точки — поправьте адрес вручную', 'error');
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (searching) {
      toast('Ищем адрес на карте, секунду…', 'info');
      return;
    }
    if (errors.length || !place) {
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
          venueName: venueName.trim() || addressText || 'Точка на карте',
          address: addressText,
          lat: place.lat,
          lng: place.lng,
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
      <PageHeader
        eyebrow={user?.coach ? 'Тренеру' : 'Организатору'}
        title={user?.coach ? 'Объявление о тренировке' : 'Новое событие'}
      />

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
              <div className="widget-value">{venueName || addressText || 'Не указано'}</div>
              <div className="widget-sub">
                {point ? 'Точка на карте отмечена' : addressPoint ? 'Место найдено по адресу' : 'Адрес или точка на карте'}
              </div>
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
            <div className="label label-row">
              {divisionScale ? `Уровень · ${divisionScale.title}` : 'Уровень'}
              <button
                type="button"
                className="label-info"
                aria-label={`Что значат уровни: ${meta.label}`}
                onClick={() => setLevelsOpen(true)}
              >
                <Info size={14} weight="fill" />
              </button>
            </div>
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
            <p className="hint">Укажите адрес, отметьте точку на карте или и то и другое.</p>
            <label className="field">
              <span className="label">Адрес</span>
              <input className="input" placeholder="ул. Примерная, 1" value={address} onChange={(e) => changeAddress(e.target.value)} />
              {addressText && !addressFromPoint && (
                <span className="hint">
                  {lookup.state === 'searching'
                    ? 'Ищем адрес на карте…'
                    : lookup.state === 'found'
                      ? point
                        ? mismatch
                          ? null
                          : '✓ Адрес совпадает с точкой на карте'
                        : '✓ Адрес найден — точка поставлена по адресу'
                      : lookup.state === 'missing'
                        ? point
                          ? 'Адрес не нашли на карте — место возьмём по отмеченной точке'
                          : 'Адрес не нашли на карте — уточните его или отметьте точку'
                        : null}
                </span>
              )}
              {addressFromPoint && addressText && <span className="hint">Адрес подставлен по точке на карте — можно поправить</span>}
            </label>
            <div className="field">
              <span className="label">Точка на карте {point ? '✓ отмечена' : addressPoint ? '· по адресу' : '— не выбрана'}</span>
              <MapPicker
                value={place}
                caption={addressText || null}
                // Адрес, подставленный по прошлой точке, обновится по новой (эффект выше).
                onPick={setPoint}
              />
            </div>
            {mismatch && (
              <div className="card callout callout-danger place-mismatch">
                <div>
                  Адрес и точка на карте не совпадают — между ними {formatDistance(mismatchKm)}. Что верно?
                </div>
                <div className="sheet-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={pointToAddress}>
                    Верен адрес
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addressToPoint}>
                    Верна точка
                  </button>
                </div>
              </div>
            )}
            <label className="field">
              <span className="label">Название места (необязательно)</span>
              <input className="input" placeholder="Парк, стадион, спорткомплекс" value={venueName} onChange={(e) => setVenueName(e.target.value)} />
            </label>
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

        <button className="btn btn-primary btn-arrow btn-block" disabled={busy || searching || errors.length > 0 || !place}>
          {busy ? 'Публикуем…' : searching ? 'Ищем адрес…' : 'Опубликовать'}
        </button>
      </form>

      <LevelsInfoSheet open={levelsOpen} onClose={() => setLevelsOpen(false)} initialSport={sport} />

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} reason="Войдите, чтобы создать событие" />
    </div>
  );
}

function sportMeta(id: SportId) {
  return SPORTS.find((s) => s.id === id) ?? SPORTS[0];
}
