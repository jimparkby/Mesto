import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { LoginSheet } from '../components/LoginSheet';
import { PageHeader } from '../components/PageHeader';
import { MapView } from '../components/MapView';
import { LEVELS, SPORTS } from '../domain/sports';
import type { LatLng, Level, SportId } from '../domain/types';
import { useToast } from '../state';

function defaultDateTime(): string {
  const d = new Date(Date.now() + 24 * 3600_000);
  d.setMinutes(0, 0, 0);
  d.setHours(19);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateEventPage() {
  const { user, refreshMyEvents } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [sport, setSport] = useState<SportId>('football');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [when, setWhen] = useState(defaultDateTime);
  const [durationMin, setDuration] = useState(90);
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [level, setLevel] = useState<Level>('any');
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
          title: title.trim(),
          sport,
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
      toast('Событие опубликовано 🎉', 'success');
      navigate(`/event/${created.id}`, { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

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

      <form className="form" onSubmit={submit}>
        <div className="field">
          <div className="label">Вид спорта</div>
          <div className="chips-wrap">
            {SPORTS.map((s) => (
              <button
                type="button"
                key={s.id}
                className={`chip${sport === s.id ? ' is-on' : ''}`}
                onClick={() => setSport(s.id)}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="label">Название</span>
          <input className="input" maxLength={120} placeholder="Например: Футбол 5×5 после работы" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <div className="grid-2">
          <label className="field">
            <span className="label">Дата и время</span>
            <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Длительность</span>
            <select className="input" value={durationMin} onChange={(e) => setDuration(Number(e.target.value))}>
              {[30, 45, 60, 90, 120, 150, 180].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} мин` : `${m / 60} ч`.replace('.5', ',5')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="label">Место</span>
          <input className="input" placeholder="Парк, стадион, спорткомплекс" value={venueName} onChange={(e) => setVenueName(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Адрес (необязательно)</span>
          <input className="input" placeholder="ул. Примерная, 1" value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>

        <div className="field">
          <span className="label">Точка на карте {point ? '✓' : '— нажмите на карту'}</span>
          <div className="card no-pad">
            <MapView pick={{ value: point, onPick: setPoint }} className="map-pick" zoom={11} />
          </div>
        </div>

        <div className="field">
          <div className="label">Уровень</div>
          <div className="chips-wrap">
            {LEVELS.map((l) => (
              <button type="button" key={l.id} className={`chip${level === l.id ? ' is-on' : ''}`} onClick={() => setLevel(l.id)}>
                {l.label}
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
            rows={4}
            placeholder="Что взять с собой, где встречаемся, какой темп…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Публикуем…' : 'Опубликовать'}
        </button>
      </form>

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} reason="Имя увидят участники вашего события." />
    </div>
  );
}
