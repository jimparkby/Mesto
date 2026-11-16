import { CaretDown } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { sportMeta } from '../domain/sports';
import type { CoachStats } from '../domain/types';

const PERIODS = [
  { days: 7, label: 'Последние 7 дней' },
  { days: 30, label: 'Последние 30 дней' },
  { days: 90, label: 'Последние 90 дней' },
];

const METRICS = [
  { id: 'income', label: 'Доход', unit: ' BYN' },
  { id: 'bookings', label: 'Брони', unit: '' },
  { id: 'sessions', label: 'Занятия', unit: '' },
] as const;
type Metric = (typeof METRICS)[number]['id'];

/** Статистика тренера: графики (доход, брони, занятия) и воронка «просмотры → заявки → брони → проведено». */
export function StatsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'charts' | 'funnel'>('charts');
  const [days, setDays] = useState(7);
  const [sport, setSport] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('income');
  const [stats, setStats] = useState<CoachStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setError(null);
    api
      .coachStats(user, days, sport)
      .then(setStats)
      .catch((e) => setError((e as Error).message));
  }, [user, days, sport]);

  if (!user || !user.isCoach)
    return (
      <div className="page empty">
        <p>Статистика доступна в профиле тренера. Выберите роль «Тренер» в спортивном паспорте.</p>
      </div>
    );

  const m = METRICS.find((x) => x.id === metric)!;
  const total = stats ? (metric === 'income' ? stats.income : stats.days.reduce((a, d) => a + d[metric], 0)) : 0;

  return (
    <div className="page stats-page">
      <h1 className="page-title">Статистика</h1>
      <div className="segmented full">
        <button className={tab === 'charts' ? 'is-on' : ''} onClick={() => setTab('charts')}>
          Графики
        </button>
        <button className={tab === 'funnel' ? 'is-on' : ''} onClick={() => setTab('funnel')}>
          Воронка
        </button>
      </div>

      <label className="select-card">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {PERIODS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </select>
        <CaretDown size={18} weight="bold" />
      </label>
      <label className="select-card">
        <select value={sport ?? ''} onChange={(e) => setSport(e.target.value || null)}>
          <option value="">Все виды спорта</option>
          {user.skills.map((s) => (
            <option key={s.sport} value={s.sport}>
              {sportMeta(s.sport).label}
            </option>
          ))}
        </select>
        <CaretDown size={18} weight="bold" />
      </label>

      {error && <div className="card callout callout-danger">{error}</div>}
      {!stats && !error && <div className="card skeleton tall" />}

      {stats && tab === 'charts' && (
        <section className="card chart-card">
          <div className="chart-head">
            <label className="chart-metric">
              <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
                {METRICS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <CaretDown size={14} weight="bold" />
            </label>
            <span className="chart-legend">
              <i /> {m.label}
            </span>
          </div>
          <div className="chart-total">
            {total}
            {m.unit}
          </div>
          <LineChart points={stats.days.map((d) => ({ label: d.date, value: d[metric] }))} unit={m.unit} />
          {metric === 'income' && (
            <p className="hint">
              Доход считается по принятым заявкам на ваши прошедшие занятия — по цене занятия. За всё время: <b>{stats.totalIncome} BYN</b>.
            </p>
          )}
        </section>
      )}

      {stats && tab === 'funnel' && <Funnel stats={stats} />}
    </div>
  );
}

function Funnel({ stats }: { stats: CoachStats }) {
  const f = stats.funnel;
  const p = stats.prevFunnel;
  const steps = [
    { label: 'Просмотры профиля', value: f.views, prev: p.views },
    { label: 'Запросы', value: f.requests, prev: p.requests },
    { label: 'Брони', value: f.bookings, prev: p.bookings },
    { label: 'Проведено', value: f.held, prev: p.held },
  ];
  return (
    <section className="card funnel">
      {steps.map((s, i) => {
        const delta = s.value - s.prev;
        const next = steps[i + 1];
        return (
          <div key={s.label}>
            <div className="funnel-step">
              <span className="muted">{s.label}</span>
              <b>{s.value}</b>
              <span className={delta >= 0 ? 'funnel-up' : 'funnel-down'}>
                {delta >= 0 ? '+' : ''}
                {delta} <span className="muted">с прошлого периода</span>
              </span>
            </div>
            {next && (
              <div className="funnel-conv">
                <span />
                <b>▼ {s.value > 0 ? Math.round((next.value / s.value) * 100) : 0}%</b>
                <span />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** Линейный график с заливкой — без библиотек, чистый SVG. */
function LineChart({ points }: { points: { label: string; value: number }[]; unit?: string }) {
  const W = 320;
  const H = 180;
  const pad = { l: 40, r: 10, t: 10, b: 26 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const nice = useMemo(() => {
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    const top = Math.ceil(max / step) * step;
    return top;
  }, [max]);
  const x = (i: number) => pad.l + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((k) => Math.round(nice * k)))];
  const every = Math.max(1, Math.ceil(points.length / 7));

  return (
    <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="График за период">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">
            {t}
          </text>
        </g>
      ))}
      {points.length > 0 && <path d={area} fill="url(#chartFill)" />}
      {points.length > 0 && <path d={line} className="chart-line" />}
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.value)} r={3.5} className="chart-dot" />
          {i % every === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" className="chart-axis">
              {p.label.slice(8, 10)}/{p.label.slice(5, 7)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
