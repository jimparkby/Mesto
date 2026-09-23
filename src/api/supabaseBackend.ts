import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, Level, SportEvent, SportId } from '../domain/types';
import { platform } from '../platforms';
import type { Backend, Participant } from './types';

interface EventRow {
  id: string;
  title: string;
  sport: SportEvent['sport'];
  description: string;
  starts_at: string;
  duration_min: number;
  venue_name: string;
  address: string;
  lat: number;
  lng: number;
  level: SportEvent['level'];
  price: number | string;
  capacity: number;
  registered_count: number;
  organizer_id: string | null;
  organizer_name: string;
  status: SportEvent['status'];
  created_at: string;
}

interface ProfileRow {
  id: string;
  name: string;
  username: string | null;
  photo_url: string | null;
  telegram_id: number | null;
  role: 'user' | 'admin';
  bio: string;
  fav_sports: SportId[];
  skill_level: Level;
}

function toEvent(r: EventRow): SportEvent {
  return {
    id: r.id,
    title: r.title,
    sport: r.sport,
    description: r.description,
    startsAt: r.starts_at,
    durationMin: r.duration_min,
    venueName: r.venue_name,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    level: r.level,
    price: Number(r.price),
    capacity: r.capacity,
    registeredCount: r.registered_count,
    organizerId: r.organizer_id ?? '',
    organizerName: r.organizer_name,
    status: r.status,
    createdAt: r.created_at,
  };
}

function toUser(p: ProfileRow): AppUser {
  return {
    id: p.id,
    name: p.name,
    username: p.username,
    photoUrl: p.photo_url,
    telegramId: p.telegram_id,
    role: p.role,
    provider: p.telegram_id ? 'telegram' : 'guest',
    about: { bio: p.bio ?? '', sports: p.fav_sports ?? [], level: p.skill_level ?? 'any' },
  };
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error('Пустой ответ сервера');
  return res.data;
}

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  // В APK сессию храним в нативных Preferences — они надёжнее localStorage в WebView.
  const storage =
    platform.kind === 'native'
      ? {
          getItem: (k: string) => platform.storageGet(k),
          setItem: (k: string, v: string) => platform.storageSet(k, v),
          removeItem: (k: string) => platform.storageSet(k, null),
        }
      : undefined;

  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  /** Вызов telegram-code-auth; текст ошибки берём из ответа функции. */
  async function codeAuth<T = unknown>(body: Record<string, string>): Promise<T> {
    const { data, error } = await sb.functions.invoke<T>('telegram-code-auth', { body });
    if (!error && data) return data;
    const res = (error as { context?: Response } | null)?.context;
    const payload = res ? await res.json().catch(() => null) : null;
    throw new Error(payload?.message ?? 'Не удалось связаться с сервером. Проверьте интернет.');
  }

  async function loadProfile(id: string): Promise<AppUser> {
    const p = check(await sb.from('profiles').select('*').eq('id', id).single<ProfileRow>());
    return toUser(p);
  }

  return {
    mode: 'supabase',

    async restoreSession() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      try {
        return await loadProfile(data.session.user.id);
      } catch {
        return null;
      }
    },

    async signInWithTelegram(initData) {
      const { data, error } = await sb.functions.invoke<{ access_token: string; refresh_token: string }>(
        'telegram-auth',
        { body: { initData } },
      );
      if (error || !data) throw new Error(error?.message ?? 'Не удалось войти через Telegram');
      const { data: s, error: e2 } = await sb.auth.setSession(data);
      if (e2 || !s.user) throw new Error(e2?.message ?? 'Нет сессии');
      return loadProfile(s.user.id);
    },

    async startTelegramLogin() {
      return codeAuth<{ token: string; bot: string }>({ action: 'start' });
    },

    async resendTelegramCode(token) {
      await codeAuth({ action: 'resend', token });
    },

    async signInWithTelegramCode(token, code) {
      const tokens = await codeAuth<{ access_token: string; refresh_token: string }>({ action: 'verify', token, code });
      const { data: s, error } = await sb.auth.setSession(tokens);
      if (error || !s.user) throw new Error(error?.message ?? 'Нет сессии');
      return loadProfile(s.user.id);
    },

    async signInAsGuest(name) {
      const { data, error } = await sb.auth.signInAnonymously({ options: { data: { name } } });
      if (error || !data.user) throw new Error(error?.message ?? 'Не удалось войти');
      return loadProfile(data.user.id);
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async updateAbout(user, about) {
      const { error } = await sb
        .from('profiles')
        .update({ bio: about.bio, fav_sports: about.sports, skill_level: about.level })
        .eq('id', user.id);
      if (error) throw new Error(error.message);
      return { ...user, about };
    },

    async listEvents(opts) {
      let q = sb
        .from('events')
        .select('*')
        .gte('starts_at', new Date(Date.now() - 12 * 3600_000).toISOString())
        .order('starts_at')
        .limit(500);
      if (!opts?.includeHidden) q = q.eq('status', 'published');
      return check(await q.returns<EventRow[]>()).map(toEvent);
    },

    async getEvent(id) {
      const { data, error } = await sb.from('events').select('*').eq('id', id).maybeSingle<EventRow>();
      if (error) throw new Error(error.message);
      return data ? toEvent(data) : null;
    },

    async createEvent(input, organizer) {
      const row = check(
        await sb
          .from('events')
          .insert({
            title: input.title,
            sport: input.sport,
            description: input.description,
            starts_at: input.startsAt,
            duration_min: input.durationMin,
            venue_name: input.venueName,
            address: input.address,
            lat: input.lat,
            lng: input.lng,
            level: input.level,
            price: input.price,
            capacity: input.capacity,
            organizer_id: organizer.id,
            organizer_name: organizer.name,
          })
          .select('*')
          .single<EventRow>(),
      );
      // registered_count обновил триггер авторегистрации организатора — перечитываем.
      return (await this.getEvent(row.id)) ?? toEvent(row);
    },

    async setEventStatus(id, status) {
      const { error } = await sb.from('events').update({ status }).eq('id', id);
      if (error) throw new Error(error.message);
    },

    async myRegistrationIds(userId) {
      const rows = check(
        await sb.from('registrations').select('event_id').eq('user_id', userId).returns<{ event_id: string }[]>(),
      );
      return new Set(rows.map((r) => r.event_id));
    },

    async register(eventId, user) {
      const { error } = await sb.from('registrations').insert({ event_id: eventId, user_id: user.id });
      if (error && error.code !== '23505') throw new Error(error.message);
    },

    async unregister(eventId, user) {
      const { error } = await sb.from('registrations').delete().eq('event_id', eventId).eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },

    async participants(eventId) {
      const rows = check(
        await sb
          .from('registrations')
          .select('user_id, profiles(name, photo_url)')
          .eq('event_id', eventId)
          .order('created_at')
          .returns<{ user_id: string; profiles: { name: string; photo_url: string | null } | null }[]>(),
      );
      return rows.map<Participant>((r) => ({
        userId: r.user_id,
        name: r.profiles?.name ?? 'Участник',
        photoUrl: r.profiles?.photo_url,
      }));
    },
  };
}
