import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_CITY } from '../domain/cities';
import { prepareImage } from '../domain/media';
import { EMPTY_RATINGS, overallRating } from '../domain/people';
import type {
  AppNotification,
  AppUser,
  CoachStats,
  Community,
  EventComment,
  EventType,
  Gender,
  Level,
  NotificationKind,
  PendingReview,
  PublicProfile,
  Ratings,
  RegStatus,
  SportEvent,
  SportId,
  SportSkill,
} from '../domain/types';
import { platform } from '../platforms';
import { buildReview, sortPeople } from './shared';
import type { Backend, Participant } from './types';

interface OrganizerEmbed {
  username: string | null;
  is_coach?: boolean;
  photo_url?: string | null;
  premium_until?: string | null;
  rating_vibe?: number | string | null;
  rating_level_fit?: number | string | null;
  rating_effectiveness?: number | string | null;
  rating_count?: number | null;
}

interface EventRow {
  id: string;
  title: string;
  sport: SportId;
  event_type: EventType;
  description: string;
  starts_at: string;
  duration_min: number;
  venue_name: string;
  address: string;
  city?: string;
  lat: number;
  lng: number;
  level: Level;
  levels?: Level[];
  price: number | string;
  capacity: number;
  reserved?: number;
  registered_count: number;
  organizer_id: string | null;
  organizer_name: string;
  status: SportEvent['status'];
  created_at: string;
  source_url: string | null;
  organizer?: OrganizerEmbed | null;
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
  gender?: Gender | null;
  birth_date?: string | null;
  city?: string;
  languages?: string[];
  skills?: SportSkill[];
  photos?: string[];
  videos?: string[];
  onboarded?: boolean;
  premium_until?: string | null;
  last_seen_at?: string | null;
  rating_vibe?: number | string | null;
  rating_level_fit?: number | string | null;
  rating_effectiveness?: number | string | null;
  rating_count?: number | null;
  created_at?: string;
}

const EVENT_EMBED_FULL =
  '*, organizer:profiles(username, is_coach, photo_url, premium_until, rating_vibe, rating_level_fit, rating_effectiveness, rating_count)';
const EVENT_EMBED_LEGACY = '*, organizer:profiles(username, is_coach)';

const num = (x: number | string | null | undefined): number | null => (x === null || x === undefined ? null : Number(x));

function ratingsOf(r: {
  rating_vibe?: number | string | null;
  rating_level_fit?: number | string | null;
  rating_effectiveness?: number | string | null;
  rating_count?: number | null;
}): Ratings {
  return {
    vibe: num(r.rating_vibe),
    levelFit: num(r.rating_level_fit),
    effectiveness: num(r.rating_effectiveness),
    count: r.rating_count ?? 0,
  };
}

const isPremiumUntil = (until: string | null | undefined) => !!until && new Date(until).getTime() > Date.now();

function toEvent(r: EventRow): SportEvent {
  const o = r.organizer;
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
    city: r.city ?? DEFAULT_CITY,
    lat: r.lat,
    lng: r.lng,
    level: r.level,
    levels: r.levels ?? (r.level !== 'any' ? [r.level] : []),
    price: Number(r.price),
    capacity: r.capacity,
    reserved: r.reserved ?? 0,
    registeredCount: r.registered_count,
    organizerId: r.organizer_id ?? '',
    organizerName: r.organizer_name,
    organizerUsername: o?.username ?? null,
    organizerPhotoUrl: o?.photo_url ?? null,
    organizerIsCoach: o?.is_coach ?? false,
    organizerPremium: isPremiumUntil(o?.premium_until),
    organizerRating: o ? overallRating(ratingsOf(o)) : null,
    status: r.status,
    createdAt: r.created_at,
    sourceUrl: r.source_url,
  };
}

/** Старые профили без колонки skills: собираем паспорт из «О себе» и профиля тренера. */
function skillsOf(p: ProfileRow): SportSkill[] {
  if (Array.isArray(p.skills)) return p.skills.filter((s) => s && typeof s.sport === 'string');
  const sports = [...new Set([...(p.fav_sports ?? []), ...(p.coach_sports ?? [])])];
  return sports.map((sport) => ({
    sport,
    level: p.skill_level && p.skill_level !== 'any' ? p.skill_level : 'amateur',
    ...(p.is_coach && p.coach_years ? { years: p.coach_years } : {}),
  }));
}

function toPublic(p: ProfileRow): PublicProfile {
  const skills = skillsOf(p);
  return {
    id: p.id,
    name: p.name,
    username: p.username,
    photoUrl: p.photo_url ?? p.photos?.[0] ?? null,
    isCoach: !!p.is_coach,
    gender: p.gender ?? null,
    birthDate: p.birth_date ?? null,
    city: p.city ?? DEFAULT_CITY,
    languages: p.languages ?? [],
    bio: p.bio || (p.is_coach ? p.coach_bio ?? '' : ''),
    skills,
    photos: p.photos ?? [],
    videos: p.videos ?? [],
    onboarded: p.onboarded ?? skills.length > 0,
    premium: isPremiumUntil(p.premium_until),
    lastSeenAt: p.last_seen_at ?? null,
    ratings: p.rating_count !== undefined ? ratingsOf(p) : EMPTY_RATINGS,
    createdAt: p.created_at,
  };
}

function toUser(p: ProfileRow): AppUser {
  return {
    ...toPublic(p),
    telegramId: p.telegram_id,
    role: p.role,
    provider: p.telegram_id ? 'telegram' : 'guest',
    premiumUntil: p.premium_until ?? null,
  };
}

/** Технические ответы PostgREST/Postgres → понятный текст для тоста. */
function friendlyError(err: { message: string; code?: string }): string {
  const m = err.message ?? '';
  if (err.code === 'PGRST204' || err.code === 'PGRST202' || /schema cache/i.test(m))
    return 'Сервер обновляется. Попробуйте ещё раз через минуту.';
  if (err.code === '42501' || /row-level security|permission denied/i.test(m))
    return 'Нет прав на это действие. Войдите заново и попробуйте ещё раз.';
  if (err.code === '23514' || /violates check constraint/i.test(m))
    return 'Проверьте поля: что-то заполнено не так (длина текста, число мест или ссылка).';
  if (/JWT|token/i.test(m)) return 'Сессия истекла. Войдите заново.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Нет связи с сервером. Проверьте интернет.';
  return m || 'Что-то пошло не так. Попробуйте ещё раз.';
}

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(friendlyError(res.error));
  if (res.data === null) throw new Error('Пустой ответ сервера');
  return res.data;
}

/** Колонки, которых нет в БД до миграции, — чтобы старая схема не ломала запись. */
const isMissingColumn = (e: { code?: string; message: string } | null, cols: string[]) =>
  !!e && (e.code === 'PGRST204' || cols.some((c) => e.message.includes(c)));

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

  /** Вызов Edge Function; текст ошибки берём из ответа функции. */
  async function invoke<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.functions.invoke<T>(name, { body });
    if (!error && data) return data;
    const res = (error as { context?: Response } | null)?.context;
    const payload = res ? await res.json().catch(() => null) : null;
    throw new Error(payload?.message ?? 'Не удалось связаться с сервером. Проверьте интернет.');
  }

  async function loadProfile(id: string): Promise<AppUser> {
    return toUser(check(await sb.from('profiles').select('*').eq('id', id).single<ProfileRow>()));
  }

  async function profilesByIds(ids: string[]): Promise<Map<string, PublicProfile>> {
    if (!ids.length) return new Map();
    const rows = check(await sb.from('profiles').select('*').in('id', ids).returns<ProfileRow[]>());
    return new Map(rows.map((r) => [r.id, toPublic(r)]));
  }

  async function selectEvents(build: (columns: string) => PromiseLike<{ data: EventRow[] | null; error: { message: string; code?: string } | null }>) {
    // Без миграции нет части колонок профиля организатора — пробуем проще.
    let res = await build(EVENT_EMBED_FULL);
    if (res.error) res = await build(EVENT_EMBED_LEGACY);
    if (res.error) res = await build('*');
    return check(res).map(toEvent);
  }

  const api: Backend = {
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
      const tokens = await invoke<{ access_token: string; refresh_token: string }>('telegram-auth', { initData });
      const { data: s, error } = await sb.auth.setSession(tokens);
      if (error || !s.user) throw new Error(error?.message ?? 'Нет сессии');
      return loadProfile(s.user.id);
    },

    async startTelegramLogin() {
      return invoke<{ token: string; bot: string }>('telegram-code-auth', { action: 'start' });
    },

    async resendTelegramCode(token) {
      await invoke('telegram-code-auth', { action: 'resend', token });
    },

    async signInWithTelegramCode(token, code) {
      const tokens = await invoke<{ access_token: string; refresh_token: string }>('telegram-code-auth', {
        action: 'verify',
        token,
        code,
      });
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

    async reloadMe(user) {
      return loadProfile(user.id);
    },

    async updatePassport(user, u) {
      const isCoach = u.isCoach;
      const values = {
        name: u.name.trim() || user.name,
        photo_url: u.photoUrl,
        gender: u.gender,
        birth_date: u.birthDate,
        city: u.city,
        languages: u.languages,
        bio: u.bio.trim(),
        skills: u.skills.map((s) => ({
          sport: s.sport,
          level: s.level,
          ...(isCoach && s.years ? { years: s.years } : {}),
          ...(isCoach && s.price ? { price: s.price } : {}),
        })),
        photos: u.photos,
        videos: u.videos,
        is_coach: isCoach,
        coach_bio: isCoach ? u.bio.trim().slice(0, 500) : '',
        onboarded: true,
      };
      const { error } = await sb.from('profiles').update(values).eq('id', user.id);
      if (error) throw new Error(friendlyError(error));
      return loadProfile(user.id);
    },

    async uploadMedia(user, file, kind) {
      const prepared = kind === 'video' ? file : await prepareImage(file);
      const ext = (prepared.name.split('.').pop() || (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase();
      const path = `${user.id}/${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await sb.storage.from('media').upload(path, prepared, {
        contentType: prepared.type || undefined,
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) {
        if (/exceeded|too large|size/i.test(error.message)) throw new Error('Файл слишком большой: до 50 МБ');
        if (/mime|type/i.test(error.message)) throw new Error('Такой формат не поддерживается: JPG, PNG, WEBP, MP4, MOV');
        throw new Error(friendlyError(error));
      }
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    },

    async deleteMedia(user, fileUrl) {
      const marker = '/object/public/media/';
      const i = fileUrl.indexOf(marker);
      if (i === -1) return;
      const path = decodeURIComponent(fileUrl.slice(i + marker.length).split('?')[0]);
      if (!path.startsWith(`${user.id}/`)) return;
      await sb.storage.from('media').remove([path]);
    },

    async touchLastSeen() {
      await sb.rpc('touch_last_seen');
    },

    async getProfile(id) {
      const { data, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle<ProfileRow>();
      if (error) throw new Error(friendlyError(error));
      return data ? toPublic(data) : null;
    },

    async trackProfileView(id) {
      await sb.rpc('track_profile_view', { p_profile: id });
    },

    async searchPeople(f) {
      let q = sb
        .from('profiles')
        .select('*')
        .eq('onboarded', true)
        .eq('is_coach', f.role === 'coach')
        .order('last_seen_at', { ascending: false, nullsFirst: false })
        .limit(300);
      if (f.city) q = q.eq('city', f.city);
      if (f.sport) q = q.contains('fav_sports', [f.sport]);
      if (f.gender) q = q.eq('gender', f.gender);
      const text = f.query.trim();
      if (text) q = q.ilike('name', `%${text.replace(/[%_]/g, '')}%`);
      const rows = check(await q.returns<ProfileRow[]>());
      return sortPeople(rows.map(toPublic), f);
    },

    async listEvents(opts) {
      return selectEvents((columns) => {
        let q = sb
          .from('events')
          .select(columns)
          .gte('starts_at', new Date(Date.now() - 12 * 3600_000).toISOString())
          .order('starts_at')
          .limit(500);
        if (!opts?.includeHidden) q = q.eq('status', 'published');
        return q.returns<EventRow[]>();
      });
    },

    async getEvent(id) {
      const list = await selectEvents((columns) => sb.from('events').select(columns).eq('id', id).limit(1).returns<EventRow[]>());
      return list[0] ?? null;
    },

    async createEvent(input, organizer) {
      const base = {
        title: input.title,
        sport: input.sport,
        event_type: input.eventType,
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
      const insert = (values: Record<string, unknown>) => sb.from('events').insert(values).select('id').single<{ id: string }>();
      let res = await insert({ ...base, levels: input.levels, reserved: input.reserved, city: input.city });
      if (isMissingColumn(res.error, ['levels', 'reserved', 'city'])) {
        console.warn('events.levels/reserved/city отсутствуют — примените миграцию 20261116100000_sport_passport.sql');
        res = await insert(base);
      }
      if (res.error) throw new Error(friendlyError(res.error));
      const created = await api.getEvent(check(res).id);
      if (!created) throw new Error('Событие создано, но не загрузилось — обновите ленту');
      return created;
    },

    async setEventStatus(id, status) {
      const { error } = await sb.from('events').update({ status }).eq('id', id);
      if (error) throw new Error(friendlyError(error));
    },

    async listComments(eventId) {
      type Row = { id: string; event_id: string; user_id: string; text: string; created_at: string; profiles: { name: string; photo_url: string | null } | null };
      const { data, error } = await sb
        .from('event_comments')
        .select('id, event_id, user_id, text, created_at, profiles(name, photo_url)')
        .eq('event_id', eventId)
        .order('created_at')
        .returns<Row[]>();
      // До миграции таблицы нет — комментариев просто нет.
      if (error) return [];
      return (data ?? []).map<EventComment>((r) => ({
        id: r.id,
        eventId: r.event_id,
        userId: r.user_id,
        userName: r.profiles?.name ?? 'Участник',
        userPhotoUrl: r.profiles?.photo_url,
        text: r.text,
        createdAt: r.created_at,
      }));
    },

    async addComment(eventId, text, user) {
      const { data, error } = await sb
        .from('event_comments')
        .insert({ event_id: eventId, user_id: user.id, text: text.trim() })
        .select('id, created_at')
        .single<{ id: string; created_at: string }>();
      if (error) throw new Error(friendlyError(error));
      return { id: data.id, eventId, userId: user.id, userName: user.name, userPhotoUrl: user.photoUrl, text: text.trim(), createdAt: data.created_at };
    },

    async deleteComment(id) {
      const { error } = await sb.from('event_comments').delete().eq('id', id);
      if (error) throw new Error(friendlyError(error));
    },

    async myRegistrations(userId) {
      let res = await sb
        .from('registrations')
        .select('event_id, status')
        .eq('user_id', userId)
        .returns<{ event_id: string; status?: RegStatus }[]>();
      if (res.error) res = await sb.from('registrations').select('event_id').eq('user_id', userId).returns<{ event_id: string }[]>();
      return new Map(check(res).map((r) => [r.event_id, r.status ?? 'approved']));
    },

    async register(eventId, user) {
      const { error } = await sb.from('registrations').insert({ event_id: eventId, user_id: user.id });
      if (error && error.code !== '23505') throw new Error(friendlyError(error));
      const { data } = await sb
        .from('registrations')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle<{ status?: RegStatus }>();
      const status = data?.status ?? 'approved';
      // Сообщение организатору с профилем участника — уведомление не должно ломать запись.
      if (status === 'pending' && !error) {
        sb.functions.invoke('registration-notify', { body: { action: 'new', event_id: eventId } }).catch(() => {});
      }
      return status;
    },

    async unregister(eventId, user) {
      const { error } = await sb.from('registrations').delete().eq('event_id', eventId).eq('user_id', user.id);
      if (error) throw new Error(friendlyError(error));
    },

    async decideRegistration(eventId, userId, approve) {
      const { error } = await sb
        .from('registrations')
        .update({ status: approve ? 'approved' : 'rejected' })
        .eq('event_id', eventId)
        .eq('user_id', userId);
      if (error) throw new Error(/Мест/.test(error.message) ? 'Мест больше нет' : friendlyError(error));
      sb.functions
        .invoke('registration-notify', { body: { action: 'decided', event_id: eventId, user_id: userId } })
        .catch(() => {});
    },

    async participants(eventId) {
      type Row = { user_id: string; status?: RegStatus; profiles: { name: string; photo_url: string | null } | null };
      const query = (columns: string) =>
        sb.from('registrations').select(columns).eq('event_id', eventId).order('created_at').returns<Row[]>();
      let res = await query('user_id, status, profiles(name, photo_url)');
      if (res.error) res = await query('user_id, profiles(name, photo_url)');
      return check(res).map<Participant>((r) => ({
        userId: r.user_id,
        name: r.profiles?.name ?? 'Участник',
        photoUrl: r.profiles?.photo_url,
        status: r.status ?? 'approved',
      }));
    },

    async pendingReviews(user) {
      const { data, error } = await sb.rpc('pending_reviews');
      if (error || !Array.isArray(data)) return [];
      const ids = (data as unknown[]).map((x) => (typeof x === 'string' ? x : (x as { pending_reviews: string }).pending_reviews));
      const out: PendingReview[] = [];
      for (const id of ids.slice(0, 5)) {
        const r = await api.reviewFor(id, user).catch(() => null);
        if (r) out.push(r);
      }
      return out;
    },

    async reviewFor(eventId, user) {
      const event = await api.getEvent(eventId);
      if (!event) return null;
      const { data: mine } = await sb
        .from('registrations')
        .select('status, reviewed_at')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle<{ status: RegStatus; reviewed_at?: string | null }>();
      if (!mine || mine.status !== 'approved' || mine.reviewed_at) return null;
      const people = (await api.participants(eventId)).filter((p) => p.status === 'approved' && p.userId !== user.id);
      const profiles = await profilesByIds(people.map((p) => p.userId));
      return buildReview(event, user, people, profiles);
    },

    async submitReview(eventId, happened, ratings) {
      const { error } = await sb.rpc('submit_review', {
        p_event: eventId,
        p_happened: happened,
        p_ratings: ratings.map((r) => ({
          ratee: r.rateeId,
          vibe: r.vibe ?? null,
          level_fit: r.levelFit ?? null,
          effectiveness: r.effectiveness ?? null,
        })),
      });
      if (error) throw new Error(friendlyError(error));
    },

    async listCommunities() {
      type Row = {
        id: string;
        title: string;
        description: string;
        sport: string | null;
        city: string;
        level: Level;
        tg_link: string;
        photo_url: string | null;
        created_by: string | null;
        members_count: number;
        created_at: string;
      };
      const { data, error } = await sb.from('communities').select('*').order('members_count', { ascending: false }).limit(300).returns<Row[]>();
      if (error) return [];
      return (data ?? []).map<Community>((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        sport: r.sport,
        city: r.city,
        level: r.level,
        tgLink: r.tg_link,
        photoUrl: r.photo_url,
        createdBy: r.created_by,
        membersCount: r.members_count,
        createdAt: r.created_at,
      }));
    },

    async myCommunityIds(userId) {
      const { data, error } = await sb.from('community_members').select('community_id').eq('user_id', userId).returns<{ community_id: string }[]>();
      if (error) return new Set();
      return new Set((data ?? []).map((r) => r.community_id));
    },

    async joinCommunity(id, user) {
      const { error } = await sb.from('community_members').insert({ community_id: id, user_id: user.id });
      if (error && error.code !== '23505') throw new Error(friendlyError(error));
    },

    async leaveCommunity(id, user) {
      const { error } = await sb.from('community_members').delete().eq('community_id', id).eq('user_id', user.id);
      if (error) throw new Error(friendlyError(error));
    },

    async createCommunity(input, user) {
      const { data, error } = await sb
        .from('communities')
        .insert({
          title: input.title.trim(),
          description: input.description.trim(),
          sport: input.sport,
          city: input.city,
          level: input.level,
          tg_link: input.tgLink,
          created_by: user.id,
        })
        .select('*')
        .single<{ id: string; created_at: string }>();
      if (error) {
        if (error.code === '42501' || /row-level security/i.test(error.message))
          throw new Error('Создавать комьюнити можно с Premium');
        throw new Error(friendlyError(error));
      }
      return { ...input, id: data.id, createdBy: user.id, membersCount: 1, createdAt: data.created_at, photoUrl: null };
    },

    async deleteCommunity(id) {
      const { error } = await sb.from('communities').delete().eq('id', id);
      if (error) throw new Error(friendlyError(error));
    },

    async listNotifications() {
      type Row = { id: string; kind: NotificationKind; title: string; body: string; link: string | null; read_at: string | null; created_at: string };
      const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(60).returns<Row[]>();
      if (error) return [];
      return (data ?? []).map<AppNotification>((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        link: r.link,
        read: !!r.read_at,
        createdAt: r.created_at,
      }));
    },

    async markNotificationsRead(user) {
      await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    },

    async coachStats(_user, days, sport) {
      const { data, error } = await sb.rpc('coach_stats', { p_days: days, p_sport: sport });
      if (error) throw new Error(friendlyError(error));
      const s = data as CoachStats;
      return {
        ...s,
        income: Number(s.income),
        prevIncome: Number(s.prevIncome),
        totalIncome: Number(s.totalIncome),
        days: s.days.map((d) => ({ ...d, income: Number(d.income) })),
      };
    },

    async premiumInvoice() {
      return invoke('premium', { action: 'invoice' });
    },

    async adminSetPremium(userId, days) {
      const { error } = await sb.rpc('admin_set_premium', { p_user: userId, p_days: days });
      if (error) throw new Error(friendlyError(error));
    },
  };
  return api;
}

