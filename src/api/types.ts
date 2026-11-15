import type { AboutMe, AppUser, CoachProfile, EventStatus, NewEventInput, PublicProfile, RegStatus, SportEvent } from '../domain/types';
import type { TelegramUserInfo } from '../platforms';

export interface Participant {
  userId: string;
  name: string;
  photoUrl?: string | null;
  /** pending — заявка ждёт решения организатора. */
  status: RegStatus;
}

export interface TelegramLoginRequest {
  token: string;
  /** Username бота без @ */
  bot: string;
}

/** Единый контракт данных. Реализации: Supabase (прод) и localStorage (демо без бэкенда). */
export interface Backend {
  mode: 'supabase' | 'demo';

  // --- auth ---
  restoreSession(): Promise<AppUser | null>;
  signInWithTelegram(initData: string, tgUser: TelegramUserInfo | null): Promise<AppUser>;
  signInAsGuest(name: string): Promise<AppUser>;
  /** Вход по коду от бота (APK, браузер): запрос → ссылка на бота → код. */
  startTelegramLogin(): Promise<TelegramLoginRequest>;
  resendTelegramCode(token: string): Promise<void>;
  signInWithTelegramCode(token: string, code: string): Promise<AppUser>;
  signOut(): Promise<void>;
  updateAbout(user: AppUser, about: AboutMe): Promise<AppUser>;
  /** null — выключить профиль тренера. */
  updateCoach(user: AppUser, coach: CoachProfile | null): Promise<AppUser>;
  /** Профиль другого пользователя (участника, организатора). */
  getProfile(id: string): Promise<PublicProfile | null>;

  // --- events ---
  listEvents(opts?: { includeHidden?: boolean }): Promise<SportEvent[]>;
  getEvent(id: string): Promise<SportEvent | null>;
  createEvent(input: NewEventInput, organizer: AppUser): Promise<SportEvent>;
  setEventStatus(id: string, status: EventStatus): Promise<void>;

  // --- registrations ---
  /** Мои заявки: id события → статус. */
  myRegistrations(userId: string): Promise<Map<string, RegStatus>>;
  /** Подать заявку; возвращает статус (организатор своего события и импортные события — сразу approved). */
  register(eventId: string, user: AppUser): Promise<RegStatus>;
  unregister(eventId: string, user: AppUser): Promise<void>;
  /** Решение организатора по заявке. */
  decideRegistration(eventId: string, userId: string, approve: boolean): Promise<void>;
  participants(eventId: string): Promise<Participant[]>;
}
