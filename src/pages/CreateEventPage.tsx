import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from '@phosphor-icons/react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { LevelsInfoSheet } from '../components/LevelsInfoSheet';
import { LoginSheet } from '../components/LoginSheet';
import { MapPicker } from '../components/MapPicker';
import { PageHeader } from '../components/PageHeader';
import { SportIcon } from '../components/SportIcon';
import { SportPicker } from '../components/SportPicker';
import { nearestCity } from '../domain/cities';
import { distanceKm, formatDistance } from '../domain/events';
import { geocodeAddress, reverseGeocode, SAME_PLACE_M } from '../domain/geocode';
import { scaleFor, withDivisionTag } from '../domain/levels';
import { skillFor } from '../domain/people';
import { EVENT_TYPES, levelRank, levelsLabel, SKILL_LEVELS, sportMeta } from '../domain/sports';
import type { EventType, LatLng, Level, SportId } from '../domain/types';
import { platform } from '../platforms';
import { useCity, useToast } from '../state';

/** Поиск координат по адресу: идёт, нашли, не нашли. */
type AddressLookup = { state: 'idle' } | { state: 'searching' } | { state: 'found'; point: LatLng } | { state: 'missing' };

const pad = (n: number) => String(n).padStart(2, '0');

function defaultDate(): string {
  const d = new Date(Date.now() + 24 * 3600_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Создание события по шагам, как регистрация: одно окно — один вопрос. */
const STEPS = [
  { id: 'sport', title: 'Какой вид спорта?' },
  { id: 'when', title: 'Дата и время' },
  { id: 'where', title: 'Место' },
  { id: 'people', title: 'Участники и уровень' },
  { id: 'details', title: 'Последние детали' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

function minutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function CreateEventPage() {
  const { user, refreshMyEvents } = useAuth();
  const { city: selectedCity } = useCity();
  const navigate = useNavigate();
  const toast = useToast();
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  // Тренер выставляет занятие по своему виду спорта.
  const [sport, setSport] = useState<SportId>(() => user?.skills[0]?.sport ?? 'football');
  const [eventType, setEventType] = useState<EventType>(() => (user?.isCoach ? 'training' : 'game'));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState('19:00');
  const [end, setEnd] = useState('20:30');
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  /** Точка, отмеченная на карте вручную. */
  const [point, setPoint] = useState<LatLng | null>(null);
  /** Адрес подставлен по точке — сверять его с точкой не нужно. */
  const [addressFromPoint, setAddressFromPoint] = useState(false);
  const [lookup, setLookup] = useState<AddressLookup>({ state: 'idle' });
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  /** Метка дивизиона («Д3») — только у волейбола. */
  const [division, setDivision] = useState<string | null>(null);
  const [price, setPrice] = useState(() => (user?.isCoach ? user.skills[0]?.price ?? 0 : 0));
  const [capacity, setCapacity] = useState(4);
  const [free, setFree] = useState(3);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // Тренеру подставляем цену занятия из паспорта для выбранного вида спорта.
  useEffect(() => {
    if (user?.isCoach) setPrice(skillFor(user, sport)?.price ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport]);

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
  const searching = !point && lookup.state === 'searching';

  // Конец позже начала; если меньше — значит, после полуночи.
  const durationMin = (() => {
    const d = minutes(end) - minutes(start);
    return d > 0 ? d : d + 24 * 60;
  })();
  const startsAt = new Date(`${date}T${start}`);
  const taken = Math.max(0, capacity - free);

  const stepError = (id: StepId): string | null => {
    if (id === 'when') {
      if (Number.isNaN(startsAt.getTime())) return 'Выберите дату и время начала';
      if (startsAt.getTime() < Date.now()) return 'Выберите дату и время в будущем';
      if (durationMin < 15 || durationMin > 720) return 'Событие должно длиться от 15 минут до 12 часов';
    }
    if (id === 'where') {
      if (!point && !addressText) return 'Укажите адрес или отметьте точку на карте';
      if (searching) return 'Ищем адрес на карте…';
      if (!point && lookup.state === 'missing') return 'Адрес не нашли на карте — уточните его или отметьте точку';
      if (mismatch) return 'Адрес и точка на карте не совпадают — выберите, что верно';
      if (!place) return 'Укажите адрес или отметьте точку на карте';
    }
    if (id === 'people') {
      if (capacity < 2 || capacity > 500) return 'Всего участников — от 2 до 500';
      if (free < 1 || free > capacity - 1) return `Свободных мест — от 1 до ${capacity - 1} (одно место ваше)`;
    }
    return null;
  };

  const current = STEPS[step];
  const currentError = stepError(current.id);
  const last = step === STEPS.length - 1;

  const go = (next: number) => {
    platform.haptic('selection');
    setStep(next);
  };

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

  const chooseSport = (id: SportId | null) => {
    if (!id) return;
    if (id !== sport) {
      setSport(id);
      setDivision(null);
      setLevels([]);
    }
    go(1);
  };

  const toggleLevel = (l: Level) => {
    setDivision(null);
    setLevels((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]).sort((a, b) => levelRank(a) - levelRank(b)));
  };

  const meta = sportMeta(sport);
  // Дивизионы вместо общей шкалы — там, где по ним реально собирают игры (волейбол: Д1–Д5).
  const divisionScale = sport === 'volleyball' ? scaleFor(sport) : undefined;
  const autoTitle = `${meta.label}${eventType === 'training' ? ': тренировка' : ''}${levels.length ? ` · ${levelsLabel(levels)}` : ''}`;
  const finalTitle = withDivisionTag((title.trim() || autoTitle).slice(0, 110), sport, division);

  const whenLabel = Number.isNaN(startsAt.getTime())
    ? ''
    : `${startsAt.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}, ${start}–${end}`;

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!last) {
      if (!currentError) go(step + 1);
      return;
    }
    if (!user) {
      setLoginOpen(true);
      return;
    }
    // Все шаги ещё раз: вдруг дата успела уйти в прошлое, пока заполняли.
    const bad = STEPS.findIndex((s) => stepError(s.id));
    if (bad !== -1 || !place) {
      if (bad !== -1) {
        toast(stepError(STEPS[bad].id)!, 'error');
        setStep(bad);
      }
      return;
    }
    setBusy(true);
    try {
      const created = await api.createEvent(
        {
          title: finalTitle,
          sport,
          eventType,
          description: description.trim(),
          startsAt: startsAt.toISOString(),
          durationMin,
          venueName: venueName.trim() || addressText || 'Точка на карте',
          address: addressText,
          city: nearestCity(place) || selectedCity,
          lat: place.lat,
          lng: place.lng,
          level: levels[0] ?? 'any',
          levels,
          price,
          capacity,
          reserved: Math.max(0, taken - 1),
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

  return (
    <div className="page">
      <PageHeader eyebrow={`Шаг ${step + 1} из ${STEPS.length}`} title={current.title}>
        <div className="wizard-progress" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.id} className={i <= step ? 'is-on' : ''} />
          ))}
        </div>
      </PageHeader>

      {!user && (
        <div className="card callout">
          Чтобы опубликовать событие, нужно представиться.{' '}
          <button type="button" className="link" onClick={() => setLoginOpen(true)}>
            Войти
          </button>
        </div>
      )}

      <form className="form create-form" onSubmit={submit}>
        {current.id === 'sport' && (
          <>
            {user?.isCoach && user.skills.length > 0 && (
              <>
                <p className="hint">Ваши виды спорта</p>
                <div className="sport-grid">
                  {user.skills.map((s) => {
                    const m = sportMeta(s.sport);
                    return (
                      <button
                        type="button"
                        key={s.sport}
                        className={`sport-tile${sport === s.sport ? ' is-on' : ''}`}
                        style={{ ['--sport' as string]: m.color }}
                        onClick={() => chooseSport(s.sport)}
                      >
                        <span className="sport-tile-icon">
                          <SportIcon sport={s.sport} size={28} color={m.color} />
                        </span>
                        <span className="sport-tile-label">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <p className="hint">Выберите, во что играем или чем занимаемся.</p>
            <SportPicker value={sport} onChange={chooseSport} />
          </>
        )}

        {current.id === 'when' && (
          <>
            <div className="wizard-sport">
              <SportIcon sport={sport} size={22} color={meta.color} />
              {meta.label}
              <button type="button" className="link" onClick={() => go(0)}>
                Изменить
              </button>
            </div>
            <label className="field">
              <span className="label">Дата</span>
              <input className="input" type="date" value={date} min={todayDate()} onChange={(e) => setDate(e.target.value)} />
            </label>
            <div className="grid-2">
              <label className="field">
                <span className="label">Начало</span>
                <input className="input" type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="field">
                <span className="label">Конец</span>
                <input className="input" type="time" step={300} value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            {whenLabel && (
              <span className="hint">
                {whenLabel} · {durationMin >= 60 ? `${Math.floor(durationMin / 60)} ч ${durationMin % 60 ? `${durationMin % 60} мин` : ''}` : `${durationMin} мин`}
              </span>
            )}
          </>
        )}

        {current.id === 'where' && (
          <>
            <p className="hint">Введите название места или адрес, отметьте точку на карте — или и то и другое.</p>
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
              <MapPicker value={place} caption={addressText || null} onPick={setPoint} />
            </div>
            {mismatch && (
              <div className="card callout callout-danger place-mismatch">
                <div>Адрес и точка на карте не совпадают — между ними {formatDistance(mismatchKm)}. Что верно?</div>
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
              <input className="input" placeholder="Корт, стадион, спорткомплекс" value={venueName} onChange={(e) => setVenueName(e.target.value)} />
            </label>
          </>
        )}

        {current.id === 'people' && (
          <>
            <div className="grid-2">
              <label className="field">
                <span className="label">Всего нужно</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={500}
                  value={capacity || ''}
                  onChange={(e) => {
                    const c = Math.max(0, Math.min(500, parseInt(e.target.value, 10) || 0));
                    setCapacity(c);
                    if (free > c - 1) setFree(Math.max(1, c - 1));
                  }}
                />
              </label>
              <label className="field">
                <span className="label">Свободно мест</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={Math.max(1, capacity - 1)}
                  value={free || ''}
                  onChange={(e) => setFree(Math.max(0, Math.min(500, parseInt(e.target.value, 10) || 0)))}
                />
              </label>
            </div>
            <span className="hint">
              Уже есть: {taken} {taken === 1 ? '(вы)' : `(вы и ещё ${taken - 1})`}. В приложении наберём {free}.
            </span>

            <div className="field">
              <div className="label label-row">
                {divisionScale ? `Уровень участников · ${divisionScale.title}` : 'Уровень участников'}
                <button type="button" className="label-info" aria-label={`Что значат уровни: ${meta.label}`} onClick={() => setLevelsOpen(true)}>
                  <Info size={14} weight="fill" />
                </button>
              </div>
              <div className="level-grid">
                {SKILL_LEVELS.map((l) => (
                  <button
                    type="button"
                    key={l.id}
                    className={`level-btn${levels.includes(l.id) ? ' is-on' : ''}`}
                    onClick={() => toggleLevel(l.id)}
                  >
                    <b>{l.short}</b>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
              <span className="hint">{levels.length ? `Подходит: ${levelsLabel(levels)}` : 'Ничего не выбрано — подойдёт любой уровень'}</span>
              {divisionScale && (
                <div className="chips-wrap">
                  {divisionScale.divisions.map((d) => (
                    <button
                      type="button"
                      key={d.tag}
                      title={d.label}
                      className={`chip${division === d.tag ? ' is-on' : ''}`}
                      onClick={() => {
                        setDivision(division === d.tag ? null : d.tag);
                        setLevels(division === d.tag ? [] : [d.level]);
                      }}
                    >
                      {d.tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {current.id === 'details' && (
          <>
            <div className="field">
              <div className="label">Тип события</div>
              <div className="chips-wrap">
                {EVENT_TYPES.map((t) => (
                  <button type="button" key={t.id} className={`chip${eventType === t.id ? ' is-on' : ''}`} onClick={() => setEventType(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span className="label">Название (необязательно)</span>
              <input className="input" maxLength={110} placeholder={autoTitle} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">{user?.isCoach && eventType === 'training' ? 'Цена занятия, BYN' : 'Цена с человека, BYN'}</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={price || ''}
                placeholder="0"
                onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
              />
              <span className="hint">{price ? 'Оплата на месте — приложение деньги не принимает' : '0 — бесплатно'}</span>
            </label>
            <label className="field">
              <span className="label">Описание для участников</span>
              <textarea
                className="input"
                rows={4}
                placeholder={eventType === 'training' ? 'Что будем отрабатывать, что взять с собой' : 'Ищу напарника на игру. Корт оплачен. Уровень уверенный средний.'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="card wizard-summary">
              <div className="section-title">Проверьте</div>
              <SummaryRow label="Спорт" value={meta.label} onEdit={() => go(0)} />
              <SummaryRow label="Когда" value={whenLabel} onEdit={() => go(1)} />
              <SummaryRow label="Где" value={venueName.trim() || addressText || 'Точка на карте'} onEdit={() => go(2)} />
              <SummaryRow label="Участники" value={`${taken}/${capacity} · ${levelsLabel(levels)}`} onEdit={() => go(3)} />
              <SummaryRow label="Название" value={finalTitle} onEdit={() => undefined} />
            </div>
          </>
        )}

        {current.id !== 'sport' && (
          <>
            {currentError && <div className="error-banner">{currentError}</div>}
            <div className="wizard-actions">
              <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}>
                Назад
              </button>
              <button className="btn btn-primary btn-arrow btn-grow" disabled={busy || !!currentError}>
                {last ? (busy ? 'Публикуем…' : user?.isCoach && eventType === 'training' ? 'Создать занятие' : 'Найти партнёров') : 'Далее'}
              </button>
            </div>
          </>
        )}
      </form>

      <LevelsInfoSheet open={levelsOpen} onClose={() => setLevelsOpen(false)} initialSport={sport} lockSport />

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} reason="Войдите, чтобы создать событие" />
    </div>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <button type="button" className="summary-row" onClick={onEdit}>
      <span className="summary-label">{label}</span>
      <span className="summary-value">{value}</span>
    </button>
  );
}
