import { Plus, SlidersHorizontal, TelegramLogo, UsersThree } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { LoginSheet } from '../components/LoginSheet';
import { Sheet } from '../components/Sheet';
import { SportIcon } from '../components/SportIcon';
import { SportPicker } from '../components/SportPicker';
import { TopBar, TopBarButton } from '../components/TopBar';
import { CITIES } from '../domain/cities';
import { normalizeTgLink, plural } from '../domain/people';
import { levelLabel, LEVELS, sportMeta } from '../domain/sports';
import type { Community, Level, SportId } from '../domain/types';
import { platform } from '../platforms';
import { useCity, useToast } from '../state';

function membersLabel(n: number) {
  return `${n} ${plural(n, 'участник', 'участника', 'участников')}`;
}

/** Комьюнити: каталог Telegram-чатов по виду спорта, городу и уровню. Общение — в Telegram. */
export function CommunitiesPage() {
  const { user } = useAuth();
  const { city } = useCity();
  const toast = useToast();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<SportId | null>(null);
  const [list, setList] = useState<Community[] | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Community | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [all, my] = await Promise.all([api.listCommunities(), user ? api.myCommunityIds(user.id) : Promise.resolve(new Set<string>())]);
    setList(all);
    setMine(my);
  }, [user]);

  useEffect(() => {
    load().catch(() => setList([]));
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list ?? []).filter(
      (c) =>
        (tab === 'mine' ? mine.has(c.id) : c.city === city) &&
        (!sport || c.sport === sport) &&
        (!q || `${c.title} ${c.description}`.toLowerCase().includes(q)),
    );
  }, [list, mine, tab, city, sport, query]);

  const startCreate = () => {
    if (!user) return setLoginOpen(true);
    setCreateOpen(true);
  };

  const join = async (c: Community) => {
    if (!user) return setLoginOpen(true);
    setBusy(true);
    try {
      if (!mine.has(c.id)) {
        await api.joinCommunity(c.id, user);
        setMine((s) => new Set(s).add(c.id));
        setList((l) => l?.map((x) => (x.id === c.id ? { ...x, membersCount: x.membersCount + 1 } : x)) ?? l);
      }
      if (c.tgLink) platform.openLink(c.tgLink);
      else toast('В демо-режиме у комьюнити нет настоящего чата', 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const leave = async (c: Community) => {
    if (!user) return;
    setBusy(true);
    try {
      await api.leaveCommunity(c.id, user);
      setMine((s) => {
        const n = new Set(s);
        n.delete(c.id);
        return n;
      });
      setList((l) => l?.map((x) => (x.id === c.id ? { ...x, membersCount: Math.max(0, x.membersCount - 1) } : x)) ?? l);
      setOpen(null);
      toast('Вы вышли из комьюнити. Из чата Telegram выйдите в самом Telegram.', 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Community) => {
    setBusy(true);
    try {
      await api.deleteCommunity(c.id);
      setOpen(null);
      await load();
      toast('Комьюнити удалено', 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page communities-page">
      <TopBar
        title="Комьюнити"
        bell={false}
        actions={
          <>
            <TopBarButton label="Фильтр по виду спорта" onClick={() => setFiltersOpen(true)} active={!!sport}>
              <SlidersHorizontal size={22} />
            </TopBarButton>
            <TopBarButton label="Создать комьюнити" onClick={startCreate}>
              <Plus size={22} weight="bold" />
            </TopBarButton>
          </>
        }
      />

      <div className="segmented full">
        <button className={tab === 'all' ? 'is-on' : ''} onClick={() => setTab('all')}>
          Все
        </button>
        <button className={tab === 'mine' ? 'is-on' : ''} onClick={() => setTab('mine')}>
          Мои
        </button>
      </div>

      <label className="search-box">
        <Icon name="search" size={22} weight="bold" />
        <input className="input" type="search" placeholder="Поиск комьюнити" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      {sport && (
        <div className="chips-wrap">
          <button className="chip is-on" onClick={() => setSport(null)}>
            {sportMeta(sport).label} ✕
          </button>
        </div>
      )}

      {list === null && [0, 1, 2].map((i) => <div key={i} className="card skeleton" />)}
      {list !== null && visible.length === 0 && (
        <div className="empty">
          <div className="empty-emoji">
            <UsersThree size={44} weight="fill" />
          </div>
          <p>{tab === 'mine' ? 'Вы пока не вступили ни в одно комьюнити.' : `В городе ${city} пока нет комьюнити${sport ? ` по виду «${sportMeta(sport).label}»` : ''}.`}</p>
          <button className="btn btn-ghost" onClick={startCreate}>
            Создать комьюнити
          </button>
        </div>
      )}

      <div className="stack">
        {visible.map((c) => (
          <button key={c.id} type="button" className="card community-row" onClick={() => setOpen(c)}>
            <span className="community-icon" style={{ ['--sport' as string]: c.sport ? sportMeta(c.sport).color : 'var(--primary)' }}>
              {c.sport ? <SportIcon sport={c.sport} size={24} color="#fff" /> : <UsersThree size={24} weight="fill" color="#fff" />}
            </span>
            <span className="community-body">
              <span className="community-title">{c.title}</span>
              <span className="community-level">{c.level === 'any' ? 'Для всех уровней' : levelLabel(c.level)}</span>
              <span className="community-members">{membersLabel(c.membersCount)}</span>
            </span>
            {mine.has(c.id) && <span className="badge badge-ok">Вы в чате</span>}
            <Icon name="chevron" size={18} weight="bold" className="muted" />
          </button>
        ))}
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title}>
        {open && (
          <>
            <div className="chips-wrap">
              {open.sport && (
                <span className="chip-sm">
                  <SportIcon sport={open.sport} size={14} color={sportMeta(open.sport).color} /> {sportMeta(open.sport).label}
                </span>
              )}
              <span className="chip-sm">{open.city}</span>
              <span className="chip-sm">{open.level === 'any' ? 'Все уровни' : levelLabel(open.level)}</span>
              <span className="chip-sm">{membersLabel(open.membersCount)}</span>
            </div>
            {open.description && <p className="prewrap">{open.description}</p>}
            <p className="hint">Общение идёт в Telegram-чате комьюнити — там договариваются об играх и тренировках.</p>
            <button className="btn btn-primary btn-arrow" disabled={busy} onClick={() => join(open)}>
              <TelegramLogo size={20} weight="fill" />
              {mine.has(open.id) ? 'Открыть чат в Telegram' : 'Вступить и открыть чат'}
            </button>
            {mine.has(open.id) && open.createdBy !== user?.id && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => leave(open)}>
                Выйти из комьюнити
              </button>
            )}
            {user && (open.createdBy === user.id || user.role === 'admin') && (
              <button className="btn btn-danger" disabled={busy} onClick={() => remove(open)}>
                Удалить комьюнити
              </button>
            )}
          </>
        )}
      </Sheet>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Вид спорта">
        <SportPicker value={sport} onChange={(s) => setSport(s)} allowNone />
        <button className="btn btn-primary btn-arrow" onClick={() => setFiltersOpen(false)}>
          Показать
        </button>
      </Sheet>

      <CreateCommunitySheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false);
          setTab('mine');
          await load();
        }}
      />
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} reason="Войдите, чтобы вступать в комьюнити" />
    </div>
  );
}

function CreateCommunitySheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const { city: currentCity } = useCity();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState<SportId | null>(null);
  const [city, setCity] = useState(currentCity);
  const [level, setLevel] = useState<Level>('any');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setCity(currentCity);
  }, [open, currentCity]);

  const tgLink = normalizeTgLink(link);
  const valid = title.trim().length >= 3 && !!tgLink;

  const submit = async () => {
    if (!user || !tgLink) return;
    setBusy(true);
    try {
      await api.createCommunity({ title, description, sport, city, level, tgLink }, user);
      toast('Комьюнити создано', 'success');
      setTitle('');
      setDescription('');
      setLink('');
      onCreated();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Новое комьюнити">
      <label className="field">
        <span className="label">Название</span>
        <input className="input" maxLength={80} placeholder="Например: Падел Минск — общий сбор" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        <span className="label">Ссылка на Telegram-чат</span>
        <input className="input" placeholder="https://t.me/… или @chat" value={link} onChange={(e) => setLink(e.target.value)} />
        <span className="hint">{link && !tgLink ? 'Нужна ссылка вида t.me/имя_чата или приглашение t.me/+…' : 'Создайте группу в Telegram и вставьте ссылку-приглашение.'}</span>
      </label>
      <div className="field">
        <div className="label">Вид спорта</div>
        <SportPicker value={sport} onChange={setSport} allowNone />
      </div>
      <div className="field">
        <div className="label">Уровень</div>
        <div className="chips-wrap">
          {LEVELS.map((l) => (
            <button key={l.id} type="button" className={`chip${level === l.id ? ' is-on' : ''}`} onClick={() => setLevel(l.id)}>
              {l.id === 'any' ? 'Все уровни' : l.label}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="label">Город</span>
        <select className="input" value={city} onChange={(e) => setCity(e.target.value)}>
          {CITIES.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Описание</span>
        <textarea className="input" rows={3} maxLength={500} placeholder="Кого ждём, как часто играем, правила чата" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <button className="btn btn-primary btn-arrow" disabled={!valid || busy} onClick={submit}>
        {busy ? 'Создаём…' : 'Создать'}
      </button>
    </Sheet>
  );
}
