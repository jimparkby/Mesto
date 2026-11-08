import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, CoachProfile, EventType, Level, SportEvent, SportId } from '../domain/types';
import { platform } from '../platforms';
import type { Backend, Participant } from './types';

interface EventRow {
  id: string;
  title: string;
  sport: SportEvent['sport'];
  event_type: EventType;
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
  source_url: string | null;
  /** Встраивается в getEvent: profiles по organizer_id. */
  organizer?: { username: string | null; is_coach?: boolean } | null;
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
  is_coach?: boolean;
  coach_bio?: string;
  coach_sports?: SportId[];
  coach_years?: number;
}

function toEvent(r: EventRow): SportEvent {
  return {
    id: r.id,
    title: r.title,
    sport: r.sport,
    eventType: r.event_type ?? 'game',
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
    organizerUsername: r.organizer?.username ?? null,
    organizerIsCoach: r.organizer?.is_coach ?? false,
    status: r.status,
    createdAt: r.created_at,
    sourceUrl: r.source_url,
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
    coach: p.is_coach ? { bio: p.coach_bio ?? '', sports: p.coach_sports ?? [], years: p.coach_years ?? 0 } : null,
  };
}

/** Технические ответы PostgREST/Postgres → понятный текст для тоста. */
function friendlyError(err: { message: string; code?: string }): string {
  const m = err.message ?? '';
  if (err.code === 'PGRST204' || /schema cache/i.test(m))
    return 'Сервер обновляется. Попробуйте ещё раз через минуту.';
  if (err.code === '42501' || /row-level security|permission denied/i.test(m))
    return 'Нет прав на это действие. Войдите заново и попробуйте ещё раз.';
  if (err.code === '23514' || /violates check constraint/i.test(m))
    return 'Проверьте поля: название от 3 символов, длительность от 15 минут, участников от 1.';
  if (/JWT|token/i.test(m)) return 'Сессия истекла. Войдите заново.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Нет связи с сервером. Проверьте интернет.';
  return m || 'Что-то пошло не так. Попробуйте ещё раз.';
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
    const user = toUser(p);
    // База без миграции coach_profile: профиль тренера лежит в user_metadata (см. updateCoach).
    if (p.is_coach === undefined) {
      const { data } = await sb.auth.getSession();
      user.coach = (data.session?.user.user_metadata?.coach as CoachProfile | undefined) ?? null;
    }
    return user;
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

    async updateCoach(user, coach) {
      const { error } = await sb
        .from('profiles')
        .update(
          coach
            ? { is_coach: true, coach_bio: coach.bio, coach_sports: coach.sports, coach_years: coach.years }
            : { is_coach: false },
        )
        .eq('id', user.id);
      if (error && (error.code === 'PGRST204' || /is_coach|coach_/.test(error.message))) {
        console.warn('profiles.is_coach отсутствует в БД — примените миграцию 20261108000000_coach_profile.sql');
        const res = await sb.auth.updateUser({ data: { coach } });
        if (res.error) throw new Error(friendlyError(res.error));
        return { ...user, coach };
      }
      if (error) throw new Error(friendlyError(error));
      return { ...user, coach };
    },

    async listEvents(opts) {
      const query = (columns: string) => {
        let q = sb
          .from('events')
          .select(columns)
          .gte('starts_at', new Date(Date.now() - 12 * 3600_000).toISOString())
          .order('starts_at')
          .limit(500);
        if (!opts?.includeHidden) q = q.eq('status', 'published');
        return q.returns<EventRow[]>();
      };
      // Отметка «Тренер» — из профиля организатора; без миграции coach_profile берём события без неё.
      let res = await query('*, organizer:profiles(username, is_coach)');
      if (res.error) res = await query('*');
      return check(res).map(toEvent);
    },

    async getEvent(id) {
      // Вместе с событием берём @username организатора — чтобы ему можно было написать в Telegram.
      let res = await sb
        .from('events')
        .select('*, organizer:profiles(username, is_coach)')
        .eq('id', id)
        .maybeSingle<EventRow>();
      if (res.error) res = await sb.from('events').select('*').eq('id', id).maybeSingle<EventRow>();
      if (res.error) throw new Error(friendlyError(res.error));
      return res.data ? toEvent(res.data) : null;
    },

    async createEvent(input, organizer) {
      const base = {
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
      };
      const insert = (values: Record<string, unknown>) =>
        sb.from('events').insert(values).select('*').single<EventRow>();

      let res = await insert({ ...base, event_type: input.eventType });
      // База без миграции event_type (PGRST204 «Could not find the 'event_type' column»):
      // публикуем без типа, чтобы создание события не ломалось.
      if (res.error && (res.error.code === 'PGRST204' || /event_type/.test(res.error.message))) {
        console.warn('events.event_type отсутствует в БД — примените миграцию 20261019000000_event_type.sql');
        res = await insert(base);
      }
      if (res.error) throw new Error(friendlyError(res.error));
      const row = check(res);
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
