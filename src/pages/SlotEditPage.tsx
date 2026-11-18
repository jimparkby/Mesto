import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { MapPicker } from '../components/MapPicker';
import { PageHeader } from '../components/PageHeader';
import { Sheet } from '../components/Sheet';
import { SportIcon } from '../components/SportIcon';
import { SportPicker } from '../components/SportPicker';
import { nearestCity } from '../domain/cities';
import { geocodeAddress, reverseGeocode } from '../domain/geocode';
import { skillFor } from '../domain/people';
import { addMinutes, BOOKING_HORIZON_DAYS, dayKey, durationLabel, WEEKDAYS, weekdaysLabel } from '../domain/schedule';
import { levelRank, levelsLabel, SKILL_LEVELS, sportMeta } from '../domain/sports';
import type { CoachSlot, LatLng, Level, SportId, Weekday } from '../domain/types';
import { useCity, useToast } from '../state';

const DURATIONS = [45, 60, 90, 120];

function minutesBetween(start: string, end: string): number {
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  const d = h2 * 60 + m2 - (h1 * 60 + m1);
  return d > 0 ? d : d + 1440;
}

/** Слот недельного шаблона: дни, время, место, места и цена. Сохранение сразу перевыставляет занятия. */
export function SlotEditPage() {
  const { id = 'new' } = useParams();
  const isNew = id === 'new';
  const { user } = useAuth();
  const { city: selectedCity } = useCity();
  const navigate = useNavigate();
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [existing, setExisting] = useState<CoachSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sportOpen, setSportOpen] = useState(false);

  const [sport, setSport] = useState<SportId>(() => user?.skills[0]?.sport ?? 'football');
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [start, setStart] = useState('19:00');
  const [end, setEnd] = useState('20:00');
  const [spots, setSpots] = useState(1);
  const [price, setPrice] = useState(() => user?.skills[0]?.price ?? 0);
  const [levels, setLevels] = useState<Level[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [addressPoint, setAddressPoint] = useState<LatLng | null>(null);
  const [lookup, setLookup] = useState<'idle' | 'searching' | 'found' | 'missing'>('idle');
  const [autoApprove, setAutoApprove] = useState(true);
  const [active, setActive] = useState(true);
  const [until, setUntil] = useState('');

  // Новый слот: место берём из последнего слота — обычно тренер работает в одном зале.
  useEffect(() => {
    if (!user) return;
    api.listCoachSlots(user.id).then((list) => {
      const s = isNew ? list[list.length - 1] : list.find((x) => x.id === id);
      if (!isNew && !s) {
        toast('Слот не найден', 'error');
        navigate('/schedule', { replace: true });
        return;
      }
      if (s) {
        setVenueName(s.venueName);
        setAddress(s.address);
        setPoint({ lat: s.lat, lng: s.lng });
        if (!isNew) {
          setExisting(s);
          setSport(s.sport);
          setWeekdays(s.weekdays);
          setStart(s.startTime);
          setEnd(addMinutes(s.startTime, s.durationMin));
          setSpots(s.spots);
          setPrice(s.price);
          setLevels(s.levels);
          setTitle(s.title);
          setDescription(s.description);
          setAutoApprove(s.autoApprove);
          setActive(s.active);
          setUntil(s.validUntil ?? '');
        }
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id]);

  // Адрес → точка (с паузой после ввода), если точку ещё не ставили вручную.
  const addressText = address.trim();
  useEffect(() => {
    if (addressText.length < 4 || point) {
      setLookup('idle');
      return;
    }
    setLookup('searching');
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      geocodeAddress(addressText, ctrl.signal)
        .then((p) => {
          setAddressPoint(p);
          setLookup(p ? 'found' : 'missing');
        })
        .catch(() => !ctrl.signal.aborted && setLookup('missing'));
    }, 800);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [addressText, point]);

  const pick = (p: LatLng) => {
    setPoint(p);
    if (!addressText)
      reverseGeocode(p)
        .then((a) => a && setAddress(a))
        .catch(() => {});
  };

  const place = point ?? addressPoint;
  const durationMin = minutesBetween(start, end);
  const meta = sportMeta(sport);
  const autoTitle = `${meta.label}: ${spots === 1 ? 'индивидуальная тренировка' : 'групповая тренировка'}`;
  const finalTitle = (title.trim() || autoTitle).slice(0, 120);

  const error = useMemo(() => {
    if (weekdays.length === 0) return 'Выберите дни недели';
    if (durationMin < 15 || durationMin > 720) return 'Занятие — от 15 минут до 12 часов';
    if (spots < 1 || spots > 200) return 'Мест — от 1 до 200';
    if (!place) return lookup === 'searching' ? 'Ищем адрес на карте…' : 'Укажите адрес или отметьте точку на карте';
    if (until && until < dayKey(new Date())) return 'Дата окончания уже прошла';
    return null;
  }, [weekdays, durationMin, spots, place, lookup, until]);

  if (!user || !user.isCoach)
    return (
      <div className="page empty">
        <p>Расписание доступно тренерам.</p>
      </div>
    );

  const toggleDay = (d: Weekday) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort((a, b) => a - b)));
  const toggleLevel = (l: Level) =>
    setLevels((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]).sort((a, b) => levelRank(a) - levelRank(b)));

  const chooseSport = (s: SportId | null) => {
    if (!s) return;
    setSport(s);
    const p = skillFor(user, s)?.price;
    if (p !== undefined) setPrice(p);
    setSportOpen(false);
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (error || !place) {
      if (error) toast(error, 'error');
      return;
    }
    setBusy(true);
    try {
      await api.saveCoachSlot(
        {
          weekdays,
          startTime: start,
          durationMin,
          sport,
          title: finalTitle,
          description: description.trim(),
          venueName: venueName.trim(),
          address: addressText,
          city: nearestCity(place) || selectedCity,
          lat: place.lat,
          lng: place.lng,
          levels,
          price,
          spots,
          autoApprove,
          active,
          validUntil: until || null,
        },
        user,
        existing?.id,
      );
      toast(isNew ? 'Слот добавлен — занятия выставлены' : 'Расписание обновлено', 'success');
      navigate('/schedule', { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await api.deleteCoachSlot(existing.id, user);
      toast('Слот удалён', 'info');
      navigate('/schedule', { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(false);
    }
  };

  if (!loaded)
    return (
      <div className="page">
        <div className="card skeleton tall" />
      </div>
    );

  return (
    <div className="page">
      <PageHeader eyebrow="Расписание" title={isNew ? 'Новый слот' : 'Слот'} />
      <form className="form create-form" onSubmit={submit}>
        <div className="field">
          <span className="label">Вид спорта</span>
          <div className="chips-wrap">
            {user.skills.map((s) => (
              <button type="button" key={s.sport} className={`chip${sport === s.sport ? ' is-on' : ''}`} onClick={() => chooseSport(s.sport)}>
                <SportIcon sport={s.sport} size={16} color={sport === s.sport ? '#fff' : sportMeta(s.sport).color} />
                {sportMeta(s.sport).label}
              </button>
            ))}
            {!user.skills.some((s) => s.sport === sport) && (
              <button type="button" className="chip is-on">
                {meta.label}
              </button>
            )}
            <button type="button" className="chip chip-more" onClick={() => setSportOpen(true)}>
              Другой…
            </button>
          </div>
        </div>

        <div className="field">
          <span className="label">Дни недели</span>
          <div className="weekday-picker">
            {WEEKDAYS.map((w) => (
              <button
                type="button"
                key={w.id}
                aria-label={w.label}
                className={`weekday-btn${weekdays.includes(w.id) ? ' is-on' : ''}`}
                onClick={() => toggleDay(w.id)}
              >
                {w.short}
              </button>
            ))}
          </div>
          <div className="chips-wrap">
            <button type="button" className="chip chip-sm" onClick={() => setWeekdays([1, 2, 3, 4, 5])}>
              Будни
            </button>
            <button type="button" className="chip chip-sm" onClick={() => setWeekdays([6, 7])}>
              Выходные
            </button>
            <button type="button" className="chip chip-sm" onClick={() => setWeekdays([1, 2, 3, 4, 5, 6, 7])}>
              Каждый день
            </button>
          </div>
        </div>

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
        <div className="chips-wrap">
          {DURATIONS.map((d) => (
            <button
              type="button"
              key={d}
              className={`chip chip-sm${durationMin === d ? ' is-on' : ''}`}
              onClick={() => setEnd(addMinutes(start, d))}
            >
              {durationLabel(d)}
            </button>
          ))}
        </div>

        <div className="grid-2">
          <label className="field">
            <span className="label">Мест для клиентов</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              value={spots || ''}
              onChange={(e) => setSpots(Math.max(0, Math.min(200, parseInt(e.target.value, 10) || 0)))}
            />
          </label>
          <label className="field">
            <span className="label">Цена, BYN</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              value={price || ''}
              placeholder="0"
              onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
        </div>
        <span className="hint">{spots === 1 ? 'Индивидуальное занятие — один клиент.' : `Группа до ${spots} человек.`} Оплата на месте.</span>

        <div className="field">
          <span className="label">Адрес</span>
          <input
            className="input"
            placeholder="ул. Примерная, 1"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setAddressPoint(null);
            }}
          />
          {addressText && !point && (
            <span className="hint">
              {lookup === 'searching' ? 'Ищем адрес на карте…' : lookup === 'found' ? '✓ Адрес найден на карте' : lookup === 'missing' ? 'Адрес не нашли — отметьте точку на карте' : null}
            </span>
          )}
        </div>
        <div className="field">
          <span className="label">Точка на карте {point ? '✓ отмечена' : addressPoint ? '· по адресу' : '— не выбрана'}</span>
          <MapPicker value={place} caption={addressText || null} onPick={pick} />
        </div>
        <label className="field">
          <span className="label">Название места (необязательно)</span>
          <input className="input" placeholder="Зал, корт, спорткомплекс" value={venueName} onChange={(e) => setVenueName(e.target.value)} />
        </label>

        <div className="field">
          <span className="label">Уровень клиентов</span>
          <div className="level-grid">
            {SKILL_LEVELS.map((l) => (
              <button type="button" key={l.id} className={`level-btn${levels.includes(l.id) ? ' is-on' : ''}`} onClick={() => toggleLevel(l.id)}>
                <b>{l.short}</b>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
          <span className="hint">{levels.length ? `Подходит: ${levelsLabel(levels)}` : 'Ничего не выбрано — любой уровень'}</span>
        </div>

        <label className="field">
          <span className="label">Название (необязательно)</span>
          <input className="input" maxLength={120} placeholder={autoTitle} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Описание для клиентов</span>
          <textarea
            className="input"
            rows={3}
            maxLength={2000}
            placeholder="Что будем отрабатывать, что взять с собой"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <section className="card settings">
          <label className="switch-row">
            <span>
              Моментальная запись
              <span className="hint block">
                {autoApprove ? 'Клиент записывается сразу, вы получаете уведомление.' : 'Каждую заявку подтверждаете вы.'}
              </span>
            </span>
            <input type="checkbox" className="switch" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
          </label>
          <label className="switch-row">
            <span>
              Запись открыта
              <span className="hint block">{active ? `Занятия выставляются на ${BOOKING_HORIZON_DAYS / 7} недели вперёд.` : 'Слот на паузе — новых занятий нет.'}</span>
            </span>
            <input type="checkbox" className="switch" checked={active} onChange={(e) => setActive(e.target.checked)} />
          </label>
          <label className="field">
            <span className="label">Действует до (необязательно)</span>
            <input className="input" type="date" min={dayKey(new Date())} value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
        </section>

        <div className="card wizard-summary">
          <div className="section-title">Итого</div>
          <div className="summary-row">
            <span className="summary-label">Когда</span>
            <span className="summary-value">
              {weekdays.length ? weekdaysLabel(weekdays) : '—'}, {start}–{end}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Занятие</span>
            <span className="summary-value">{finalTitle}</span>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}
        <div className="wizard-actions">
          {existing && (
            <button type="button" className="btn btn-ghost danger" onClick={() => setDeleteOpen(true)}>
              Удалить
            </button>
          )}
          <button className="btn btn-primary btn-arrow btn-grow" disabled={busy || !!error}>
            {busy ? 'Сохраняем…' : isNew ? 'Добавить в расписание' : 'Сохранить'}
          </button>
        </div>
      </form>

      <Sheet open={sportOpen} onClose={() => setSportOpen(false)} title="Вид спорта">
        <SportPicker value={sport} onChange={chooseSport} />
      </Sheet>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Удалить слот?">
        <p className="muted">Свободные будущие занятия этого слота исчезнут. Занятия, на которые уже записались, останутся — их можно отменить в календаре.</p>
        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteOpen(false)}>
            Оставить
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={remove}>
            Удалить
          </button>
        </div>
      </Sheet>
    </div>
  );
}
