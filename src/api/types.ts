import type { AboutMe, AppUser, EventStatus, NewEventInput, SportEvent } from '../domain/types';
import type { TelegramUserInfo } from '../platforms';

export interface Participant {
  userId: string;
  name: string;
  photoUrl?: string | null;
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

  // --- events ---
  listEvents(opts?: { includeHidden?: boolean }): Promise<SportEvent[]>;
  getEvent(id: string): Promise<SportEvent | null>;
  createEvent(input: NewEventInput, organizer: AppUser): Promise<SportEvent>;
  setEventStatus(id: string, status: EventStatus): Promise<void>;

  // --- registrations ---
  myRegistrationIds(userId: string): Promise<Set<string>>;
  register(eventId: string, user: AppUser): Promise<void>;
  unregister(eventId: string, user: AppUser): Promise<void>;
  participants(eventId: string): Promise<Participant[]>;
}
