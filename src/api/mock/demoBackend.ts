import type { AppUser, SportEvent } from '../../domain/types';
import { platform } from '../../platforms';
import type { Backend, Participant } from '../types';
import { DEMO_PARTICIPANT_NAMES, generateSeedEvents } from './seed';

/**
 * Демо-бэкенд без сервера: данные в localStorage.
 * Нужен, чтобы MVP можно было показать сразу — в браузере, в Telegram и в APK.
 */

const STATE_KEY = 'sr_demo_state_v1';
const USER_KEY = 'sr_demo_user_v1';

interface Registration {
  eventId: string;
  userId: string;
  name: string;
  photoUrl?: string | null;
}

interface State {
  seedDay: string;
  /** registeredCount здесь — «базовое» число участников без локальных записей. */
  events: SportEvent[];
  registrations: Registration[];
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function load(): State {
  let state: State | null = null;
  try {
    state = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null');
  } catch {
    state = null;
  }
  if (!state) {
    state = { seedDay: today(), events: generateSeedEvents(), registrations: [] };
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
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function withCounts(state: State, e: SportEvent): SportEvent {
  const local = state.registrations.filter((r) => r.eventId === e.id).length;
  return { ...e, registeredCount: e.registeredCount + local };
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function persistUser(user: AppUser | null) {
  await platform.storageSet(USER_KEY, user ? JSON.stringify(user) : null);
}

export function createDemoBackend(): Backend {
  return {
    mode: 'demo',

    async restoreSession() {
      const raw = await platform.storageGet(USER_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as AppUser;
      } catch {
        return null;
      }
    },

    async signInWithTelegram(_initData, tg) {
      if (!tg) throw new Error('Нет данных пользователя Telegram');
      // В демо-режиме подпись initData не проверяется — это делает Edge Function в Supabase.
      const user: AppUser = {
        id: `tg-${tg.id}`,
        name: [tg.first_name, tg.last_name].filter(Boolean).join(' '),
        username: tg.username ?? null,
        photoUrl: tg.photo_url ?? null,
        telegramId: tg.id,
        role: 'admin', // в демо каждый может посмотреть модерацию
        provider: 'telegram',
      };
      await persistUser(user);
      return user;
    },

    async signInAsGuest(name) {
      const user: AppUser = { id: uid('guest'), name, role: 'admin', provider: 'guest' };
      await persistUser(user);
      return user;
    },

    async signOut() {
      await persistUser(null);
    },

    async listEvents(opts) {
      const s = load();
      return s.events
        .filter((e) => opts?.includeHidden || e.status === 'published')
        .map((e) => withCounts(s, e));
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
        status: 'published',
        createdAt: new Date().toISOString(),
      };
      s.events.push(event);
      // Организатор автоматически участвует в своём событии.
      s.registrations.push({ eventId: event.id, userId: organizer.id, name: organizer.name, photoUrl: organizer.photoUrl });
      save(s);
      return withCounts(s, event);
    },

    async setEventStatus(id, status) {
      const s = load();
      const e = s.events.find((x) => x.id === id);
      if (e) e.status = status;
      save(s);
    },

    async myRegistrationIds(userId) {
      const s = load();
      return new Set(s.registrations.filter((r) => r.userId === userId).map((r) => r.eventId));
    },

    async register(eventId, user) {
      const s = load();
      const e = s.events.find((x) => x.id === eventId);
      if (!e) throw new Error('Событие не найдено');
      if (s.registrations.some((r) => r.eventId === eventId && r.userId === user.id)) return;
      const ev = withCounts(s, e);
      if (ev.registeredCount >= ev.capacity) throw new Error('Мест больше нет');
      s.registrations.push({ eventId, userId: user.id, name: user.name, photoUrl: user.photoUrl });
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
      const fake: Participant[] = Array.from({ length: e.registeredCount }, (_, i) => ({
        userId: `demo-${eventId}-${i}`,
        name: DEMO_PARTICIPANT_NAMES[(i + seedNum * 3) % DEMO_PARTICIPANT_NAMES.length],
      }));
      const real: Participant[] = s.registrations
        .filter((r) => r.eventId === eventId)
        .map((r) => ({ userId: r.userId, name: r.name, photoUrl: r.photoUrl }));
      return [...real, ...fake];
    },
  };
}
