import type { AppUser, EventStatus, NewEventInput, SportEvent } from '../domain/types';
import type { TelegramUserInfo } from '../platforms';

export interface Participant {
  userId: string;
  name: string;
  photoUrl?: string | null;
}

/** Единый контракт данных. Реализации: Supabase (прод) и localStorage (демо без бэкенда). */
export interface Backend {
  mode: 'supabase' | 'demo';

  // --- auth ---
  restoreSession(): Promise<AppUser | null>;
  signInWithTelegram(initData: string, tgUser: TelegramUserInfo | null): Promise<AppUser>;
  signInAsGuest(name: string): Promise<AppUser>;
  signOut(): Promise<void>;

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
