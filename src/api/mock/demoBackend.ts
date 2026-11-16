import { DEFAULT_CITY } from '../../domain/cities';
import { fileToDataUrl, prepareImage } from '../../domain/media';
import { EMPTY_RATINGS } from '../../domain/people';
import type {
  AppNotification,
  AppUser,
  Community,
  EventComment,
  NotificationKind,
  PublicProfile,
  Ratings,
  RegStatus,
  SportEvent,
} from '../../domain/types';
import { platform } from '../../platforms';
import { buildReview, sortPeople } from '../shared';
import type { Backend, Participant } from '../types';
import { DEMO_COMMUNITIES, DEMO_PARTICIPANT_NAMES, DEMO_PEOPLE, generateSeedEvents } from './seed';

/**
 * Демо-бэкенд без сервера: данные в localStorage.
 * Нужен, чтобы приложение можно было показать сразу — в браузере, в Telegram и в APK.
 */

const STATE_KEY = 'sr_demo_state_v3';
const USER_KEY = 'sr_demo_user_v2';
const PREMIUM_DAYS = 30;

interface Registration {
  eventId: string;
  userId: string;
  name: string;
  photoUrl?: string | null;
  status?: RegStatus;
  reviewed?: boolean;
}

interface Rating {
  eventId: string;
  raterId: string;
  rateeId: string;
  vibe?: number | null;
  levelFit?: number | null;
  effectiveness?: number | null;
}

interface StoredNotification extends AppNotification {
  userId: string;
}

interface State {
  seedDay: string;
  /** registeredCount здесь — «базовое» число участников без локальных записей. */
  events: SportEvent[];
  registrations: Registration[];
  comments: EventComment[];
  ratings: Rating[];
  communities: Community[];
  members: { communityId: string; userId: string }[];
  notifications: StoredNotification[];
  views: { profileId: string; viewerId: string; day: string }[];
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function fresh(): State {
  return {
    seedDay: today(),
    events: generateSeedEvents(),
    registrations: [],
    comments: [
      {
        id: 'c-1',
        eventId: 'seed-4',
        userId: 'person-2',
        userName: 'Алексей Мартынов',
        text: 'Супер, я буду!',
        createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      },
    ],
    ratings: [],
    communities: DEMO_COMMUNITIES,
    members: [],
    notifications: [],
    views: [],
  };
}

function load(): State {
  let state: State | null = null;
  try {
    state = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null');
  } catch {
    state = null;
  }
  if (!state) {
    state = fresh();
    save(state);
  } else if (state.seedDay !== today()) {
    // Раз в день пересобираем демо-события, чтобы они не уходили в прошлое.
    const own = state.events.filter((e) => !e.id.startsWith('seed-'));
    state = { ...state, seedDay: today(), events: [...generateSeedEvents(), ...own] };
    save(state);
  }
  return state;
}

function save(state: State) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    throw new Error('В демо-режиме закончилось место на устройстве — удалите несколько фото или видео.');
  }
}

function withCounts(state: State, e: SportEvent): SportEvent {
  const local = state.registrations.filter((r) => r.eventId === e.id && (r.status ?? 'approved') === 'approved').length;
  return { ...e, registeredCount: e.registeredCount + local };
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyUser(base: Pick<AppUser, 'id' | 'name' | 'provider'> & Partial<AppUser>): AppUser {
  return {
    role: 'admin',
    username: null,
    photoUrl: null,
    telegramId: null,
    // Спортивный паспорт
    gender: null,
    birthDate: null,
    city: DEFAULT_CITY,
    languages: [],
    bio: '',
    skills: [],
    photos: [],
    videos: [],
    isCoach: false,
    premium: false,
    premiumUntil: null,
    onboarded: false,
    lastSeenAt: new Date().toISOString(),
    ratings: EMPTY_RATINGS,
    createdAt: new Date().toISOString(),
    ...base,
    // role — права в приложении: в демо каждый может посмотреть модерацию.
  } as AppUser;
}

async function readUser(): Promise<AppUser | null> {
  const raw = await platform.storageGet(USER_KEY);
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as AppUser;
    return { ...u, premium: !!u.premiumUntil && new Date(u.premiumUntil).getTime() > Date.now() };
  } catch {
    return null;
  }
}

async function persistUser(user: AppUser | null) {
  await platform.storageSet(USER_KEY, user ? JSON.stringify(user) : null);
}

function notify(s: State, userId: string, kind: NotificationKind, title: string, body: string, link: string | null) {
  s.notifications.unshift({ id: uid('n'), userId, kind, title, body, link, read: false, createdAt: new Date().toISOString() });
}

function ratingsFor(s: State, userId: string, base: Ratings): Ratings {
  const mine = s.ratings.filter((r) => r.rateeId === userId);
  if (!mine.length) return base;
  const avg = (xs: (number | null | undefined)[], prev: number | null, prevN: number) => {
    const v = xs.filter((x): x is number => typeof x === 'number');
    if (!v.length) return prev;
    const sum = v.reduce((a, b) => a + b, 0) + (prev ?? 0) * (prev === null ? 0 : prevN);
    return sum / (v.length + (prev === null ? 0 : prevN));
  };
  return {
    vibe: avg(mine.map((r) => r.vibe), base.vibe, base.count),
    levelFit: avg(mine.map((r) => r.levelFit), base.levelFit, base.count),
    effectiveness: avg(mine.map((r) => r.effectiveness), base.effectiveness, base.count),
    count: base.count + mine.length,
  };
}

export function createDemoBackend(): Backend {
  async function signIn(user: AppUser) {
    const s = load();
    if (!s.notifications.some((n) => n.userId === user.id && n.kind === 'welcome')) {
      notify(
        s,
        user.id,
        'welcome',
        'Привет от команды Mesto 👋',
        'Заполните спортивный паспорт, находите партнёров своего уровня и создавайте события. Вопросы и идеи пишите нам в Telegram — читаем всё и отвечаем лично.',
        '/profile',
      );
      save(s);
    }
    await persistUser(user);
    return user;
  }

  async function profileOf(id: string): Promise<PublicProfile | null> {
    const s = load();
    const me = await readUser();
    if (me?.id === id) return { ...me, ratings: ratingsFor(s, id, me.ratings) };
    const demo = DEMO_PEOPLE.find((p) => p.id === id);
    if (demo) return { ...demo, ratings: ratingsFor(s, id, demo.ratings) };
    const reg = s.registrations.find((r) => r.userId === id);
    const name = reg?.name ?? (/^demo-/.test(id) ? DEMO_PARTICIPANT_NAMES[id.length % DEMO_PARTICIPANT_NAMES.length] : null);
    if (!name) return null;
    return {
      ...emptyUser({ id, name, provider: 'guest' }),
      photoUrl: reg?.photoUrl ?? null,
      onboarded: false,
    };
  }

  const api: Backend = {
    mode: 'demo',

    restoreSession: readUser,

    async signInWithTelegram(_initData, tg) {
      if (!tg) throw new Error('Нет данных пользователя Telegram');
      const prev = await readUser();
      if (prev?.telegramId === tg.id) return prev;
      // В демо-режиме подпись initData не проверяется — это делает Edge Function в Supabase.
      return signIn(
        emptyUser({
          id: `tg-${tg.id}`,
          name: [tg.first_name, tg.last_name].filter(Boolean).join(' '),
          username: tg.username ?? null,
          photoUrl: tg.photo_url ?? null,
          telegramId: tg.id,
          provider: 'telegram',
        }),
      );
    },

    // В демо бота нет: подходит код 1234.
    async startTelegramLogin() {
      return { token: uid('login'), bot: 'MestoBot' };
    },

    async resendTelegramCode() {},

    async signInWithTelegramCode(_token, code) {
      if (code !== '1234') throw new Error('Неверный код. В демо-режиме код — 1234.');
      return signIn(emptyUser({ id: 'tg-demo', name: 'Гость Telegram', provider: 'telegram' }));
    },

    async signInAsGuest(name) {
      return signIn(emptyUser({ id: uid('guest'), name, provider: 'guest' }));
    },

    async signOut() {
      await persistUser(null);
    },

    async reloadMe(user) {
      return (await readUser()) ?? user;
    },

    async updatePassport(user, u) {
      const next: AppUser = {
        ...user,
        ...u,
        name: u.name.trim() || user.name,
        bio: u.bio.trim(),
        isCoach: u.isCoach,
        onboarded: true,
      };
      await persistUser(next);
      const s = load();
      for (const e of s.events)
        if (e.organizerId === user.id) {
          e.organizerIsCoach = next.isCoach;
          e.organizerName = next.name;
          e.organizerPhotoUrl = next.photoUrl;
        }
      save(s);
      return next;
    },

    async uploadMedia(_user, file, kind) {
      if (kind === 'video') {
        // Видео в localStorage не помещается — показываем, что в демо их можно только «прикрепить».
        if (file.size > 4 * 1024 * 1024) throw new Error('В демо-режиме видео до 4 МБ. В приложении с сервером — до 50 МБ.');
        return fileToDataUrl(file);
      }
      return fileToDataUrl(await prepareImage(file, kind === 'avatar' ? 480 : 900, 0.8));
    },

    async deleteMedia() {},

    async touchLastSeen() {},

    getProfile: profileOf,

    async trackProfileView(id) {
      const me = await readUser();
      if (!me || me.id === id) return;
      const s = load();
      if (!s.views.some((v) => v.profileId === id && v.viewerId === me.id && v.day === today())) {
        s.views.push({ profileId: id, viewerId: me.id, day: today() });
        save(s);
      }
    },

    async searchPeople(f) {
      const s = load();
      const me = await readUser();
      const all: PublicProfile[] = [
        ...DEMO_PEOPLE.map((p) => ({ ...p, ratings: ratingsFor(s, p.id, p.ratings) })),
        ...(me?.onboarded ? [me] : []),
      ];
      const text = f.query.trim().toLowerCase();
      const list = all.filter(
        (p) =>
          p.isCoach === (f.role === 'coach') &&
          (!f.city || p.city === f.city) &&
          (!f.sport || p.skills.some((x) => x.sport === f.sport)) &&
          (!f.gender || p.gender === f.gender) &&
          (!text || p.name.toLowerCase().includes(text)),
      );
      return sortPeople(list, f);
    },

    async listEvents(opts) {
      const s = load();
      return s.events.filter((e) => opts?.includeHidden || e.status === 'published').map((e) => withCounts(s, e));
    },

    async getEvent(id) {
      const s = load();
      const e = s.events.find((x) => x.id === id);
      return e ? withCounts(s, e) : null;
    },

    async createEvent(input, organizer) {
      const s = load();
      const event: SportEvent = {
        ...input,
        id: uid('ev'),
        registeredCount: 0,
        organizerId: organizer.id,
        organizerName: organizer.name,
        organizerUsername: organizer.username ?? null,
        organizerPhotoUrl: organizer.photoUrl ?? null,
        organizerIsCoach: organizer.isCoach,
        organizerPremium: organizer.premium,
        organizerRating: null,
        status: 'published',
        createdAt: new Date().toISOString(),
      };
      s.events.push(event);
      // Организатор автоматически участвует в своём событии.
      s.registrations.push({ eventId: event.id, userId: organizer.id, name: organizer.name, photoUrl: organizer.photoUrl, status: 'approved' });
      save(s);
      return withCounts(s, event);
    },

    async setEventStatus(id, status) {
      const s = load();
      const e = s.events.find((x) => x.id === id);
      if (e) e.status = status;
      save(s);
    },

    async listComments(eventId) {
      return load().comments.filter((c) => c.eventId === eventId);
    },

    async addComment(eventId, text, user) {
      const s = load();
      const c: EventComment = {
        id: uid('c'),
        eventId,
        userId: user.id,
        userName: user.name,
        userPhotoUrl: user.photoUrl,
        text: text.trim(),
        createdAt: new Date().toISOString(),
      };
      s.comments.push(c);
      save(s);
      return c;
    },

    async deleteComment(id) {
      const s = load();
      s.comments = s.comments.filter((c) => c.id !== id);
      save(s);
    },

    async myRegistrations(userId) {
      const s = load();
      return new Map(s.registrations.filter((r) => r.userId === userId).map((r) => [r.eventId, r.status ?? 'approved']));
    },

    async register(eventId, user) {
      const s = load();
      const e = s.events.find((x) => x.id === eventId);
      if (!e) throw new Error('Событие не найдено');
      const existing = s.registrations.find((r) => r.eventId === eventId && r.userId === user.id);
      if (existing) return existing.status ?? 'approved';
      const ev = withCounts(s, e);
      if (ev.registeredCount + ev.reserved >= ev.capacity) throw new Error('Мест больше нет');
      // Демо-события некому одобрять — запись сразу принята; на чужие локальные — заявка.
      const demoOrganizer = e.organizerId.startsWith('org-') || e.organizerId.startsWith('person-');
      const status: RegStatus = e.organizerId === user.id || demoOrganizer ? 'approved' : 'pending';
      s.registrations.push({ eventId, userId: user.id, name: user.name, photoUrl: user.photoUrl, status });
      if (status === 'pending') notify(s, e.organizerId, 'request_new', 'Новая заявка', `${user.name} хочет на «${e.title}».`, `/event/${e.id}`);
      save(s);
      return status;
    },

    async decideRegistration(eventId, userId, approve) {
      const s = load();
      const r = s.registrations.find((x) => x.eventId === eventId && x.userId === userId);
      if (!r) throw new Error('Заявка не найдена');
      const e = s.events.find((x) => x.id === eventId);
      if (approve && e) {
        const ev = withCounts(s, e);
        if (ev.registeredCount + ev.reserved >= ev.capacity) throw new Error('Мест больше нет');
      }
      r.status = approve ? 'approved' : 'rejected';
      if (e)
        notify(
          s,
          userId,
          approve ? 'request_approved' : 'request_rejected',
          approve ? 'Заявка принята' : 'Заявка отклонена',
          approve ? `Вы записаны на «${e.title}». До встречи!` : `Организатор «${e.title}» не подтвердил заявку.`,
          `/event/${e.id}`,
        );
      save(s);
    },

    async unregister(eventId, user) {
      const s = load();
      s.registrations = s.registrations.filter((r) => !(r.eventId === eventId && r.userId === user.id));
      save(s);
    },

    async participants(eventId) {
      const s = load();
      const e = s.events.find((x) => x.id === eventId);
      if (!e) return [];
      const seedNum = Number(eventId.replace(/\D/g, '')) || 0;
      const organizer = DEMO_PEOPLE.find((p) => p.id === e.organizerId);
      const fakeCount = Math.max(0, e.registeredCount - (organizer ? 1 : 0));
      const fake: Participant[] = Array.from({ length: fakeCount }, (_, i) => ({
        userId: `demo-${eventId}-${i}`,
        name: DEMO_PARTICIPANT_NAMES[(i + seedNum * 3) % DEMO_PARTICIPANT_NAMES.length],
        status: 'approved',
      }));
      const head: Participant[] = organizer ? [{ userId: organizer.id, name: organizer.name, photoUrl: organizer.photoUrl, status: 'approved' }] : [];
      const real: Participant[] = s.registrations
        .filter((r) => r.eventId === eventId)
        .map((r) => ({ userId: r.userId, name: r.name, photoUrl: r.photoUrl, status: r.status ?? 'approved' }));
      return [...head, ...real, ...fake];
    },

    async pendingReviews(user) {
      const s = load();
      const out = [];
      for (const r of s.registrations) {
        if (r.userId !== user.id || r.reviewed || (r.status ?? 'approved') !== 'approved') continue;
        const review = await api.reviewFor(r.eventId, user);
        if (review) out.push(review);
      }
      return out;
    },

    async reviewFor(eventId, user) {
      const s = load();
      const e = s.events.find((x) => x.id === eventId);
      const mine = s.registrations.find((r) => r.eventId === eventId && r.userId === user.id);
      if (!e || !mine || mine.reviewed || (mine.status ?? 'approved') !== 'approved') return null;
      if (new Date(e.startsAt).getTime() + e.durationMin * 60_000 > Date.now()) return null;
      const people = (await api.participants(eventId)).filter((p) => p.status === 'approved');
      const profiles = new Map<string, PublicProfile>();
      for (const p of people) {
        const prof = await profileOf(p.userId);
        if (prof) profiles.set(p.userId, prof);
      }
      return buildReview(withCounts(s, e), user, people, profiles);
    },

    async submitReview(eventId, happened, ratings, user) {
      const s = load();
      const mine = s.registrations.find((r) => r.eventId === eventId && r.userId === user.id);
      if (mine) mine.reviewed = true;
      if (happened)
        for (const r of ratings) {
          s.ratings = s.ratings.filter((x) => !(x.eventId === eventId && x.raterId === user.id && x.rateeId === r.rateeId));
          s.ratings.push({ eventId, raterId: user.id, ...r });
        }
      save(s);
    },

    async listCommunities() {
      const s = load();
      return [...s.communities].sort((a, b) => b.membersCount - a.membersCount);
    },

    async myCommunityIds(userId) {
      return new Set(load().members.filter((m) => m.userId === userId).map((m) => m.communityId));
    },

    async joinCommunity(id, user) {
      const s = load();
      if (s.members.some((m) => m.communityId === id && m.userId === user.id)) return;
      s.members.push({ communityId: id, userId: user.id });
      const c = s.communities.find((x) => x.id === id);
      if (c) c.membersCount++;
      save(s);
    },

    async leaveCommunity(id, user) {
      const s = load();
      const before = s.members.length;
      s.members = s.members.filter((m) => !(m.communityId === id && m.userId === user.id));
      const c = s.communities.find((x) => x.id === id);
      if (c && s.members.length < before) c.membersCount = Math.max(0, c.membersCount - 1);
      save(s);
    },

    async createCommunity(input, user) {
      if (!user.premium && user.role !== 'admin') throw new Error('Создавать комьюнити можно с Premium');
      const s = load();
      const c: Community = { ...input, id: uid('com'), createdBy: user.id, membersCount: 1, createdAt: new Date().toISOString(), photoUrl: null };
      s.communities.unshift(c);
      s.members.push({ communityId: c.id, userId: user.id });
      save(s);
      return c;
    },

    async deleteCommunity(id) {
      const s = load();
      s.communities = s.communities.filter((c) => c.id !== id);
      s.members = s.members.filter((m) => m.communityId !== id);
      save(s);
    },

    async listNotifications(user) {
      const s = load();
      // Напоминания оценить прошедшие события — как это делает cron в Supabase.
      for (const r of await api.pendingReviews(user)) {
        const link = `/rate/${r.event.id}`;
        if (!s.notifications.some((n) => n.userId === user.id && n.link === link)) {
          notify(
            s,
            user.id,
            'rate_reminder',
            r.event.eventType === 'training' ? 'Как прошла тренировка?' : 'Как прошла игра?',
            `Подтвердите «${r.event.title}» и оцените партнёров — это займёт 5 секунд.`,
            link,
          );
        }
      }
      save(s);
      return s.notifications.filter((n) => n.userId === user.id).map(({ userId: _u, ...n }) => n);
    },

    async markNotificationsRead(user) {
      const s = load();
      for (const n of s.notifications) if (n.userId === user.id) n.read = true;
      save(s);
    },

    async coachStats(user, days, sport) {
      const s = load();
      const now = Date.now();
      const t0 = now - days * 86_400_000;
      const tp = now - 2 * days * 86_400_000;
      const evs = s.events.filter((e) => e.organizerId === user.id && (!sport || e.sport === sport));
      const regs = s.registrations
        .filter((r) => r.userId !== user.id)
        .map((r) => ({ r, e: evs.find((e) => e.id === r.eventId) }))
        .filter((x): x is { r: Registration; e: SportEvent } => !!x.e);
      const end = (e: SportEvent) => new Date(e.startsAt).getTime() + e.durationMin * 60_000;
      const ok = (r: Registration) => (r.status ?? 'approved') === 'approved';
      const views = (from: number, to: number) =>
        s.views.filter((v) => v.profileId === user.id && new Date(v.day).getTime() >= from - 86_400_000 && new Date(v.day).getTime() < to).length;
      const funnel = (from: number, to: number) => ({
        views: views(from, to),
        requests: regs.length,
        bookings: regs.filter((x) => ok(x.r)).length,
        held: regs.filter((x) => ok(x.r) && end(x.e) >= from && end(x.e) < to).length,
      });
      const income = (from: number, to: number) =>
        regs.filter((x) => ok(x.r) && end(x.e) >= from && end(x.e) < to).reduce((a, x) => a + x.e.price, 0);
      const series = Array.from({ length: days }, (_, i) => {
        const d = new Date(t0 + (i + 1) * 86_400_000);
        const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const to = from + 86_400_000;
        return {
          date: d.toISOString().slice(0, 10),
          income: income(from, Math.min(to, now)),
          bookings: 0,
          sessions: evs.filter((e) => end(e) >= from && end(e) < Math.min(to, now)).length,
        };
      });
      return {
        days: series,
        funnel: funnel(t0, now),
        prevFunnel: { ...funnel(tp, t0), requests: 0, bookings: 0 },
        income: income(t0, now),
        prevIncome: income(tp, t0),
        totalIncome: income(0, now),
      };
    },

    async premiumInvoice(user) {
      // В демо оплаты нет — Premium включается сразу, чтобы можно было посмотреть, как он работает.
      const until = new Date(Date.now() + PREMIUM_DAYS * 86_400_000).toISOString();
      await persistUser({ ...user, premium: true, premiumUntil: until });
      const s = load();
      notify(s, user.id, 'premium', 'Premium активен ⭐', 'Демо-режим: оплата не списывается.', '/profile');
      save(s);
      return { invoiceUrl: null, botUrl: null, stars: 0, days: PREMIUM_DAYS };
    },

    async adminSetPremium() {},
  };
  return api;
}
