import type {
  AppNotification,
  AppUser,
  CoachSlot,
  CoachSlotInput,
  CoachStats,
  Community,
  EventComment,
  EventStatus,
  NewCommunityInput,
  NewEventInput,
  Passport,
  PeopleFilters,
  PendingReview,
  PublicProfile,
  RatingInput,
  RegStatus,
  SportEvent,
} from '../domain/types';
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

/** Паспорт вместе с именем и аватаром — то, что пользователь редактирует сам. */
export interface PassportUpdate extends Passport {
  name: string;
  photoUrl: string | null;
}

export type MediaKind = 'photo' | 'video' | 'avatar';

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
  /** Перечитать свой профиль с сервера. */
  reloadMe(user: AppUser): Promise<AppUser>;

  // --- спортивный паспорт и люди ---
  /** Сохранить паспорт; отмечает регистрацию пройденной. */
  updatePassport(user: AppUser, update: PassportUpdate): Promise<AppUser>;
  /** Загрузить фото/видео в профиль; возвращает публичную ссылку. */
  uploadMedia(user: AppUser, file: File, kind: MediaKind): Promise<string>;
  /** Удалить файл из хранилища (ссылку из паспорта убирает updatePassport). */
  deleteMedia(user: AppUser, url: string): Promise<void>;
  touchLastSeen(): Promise<void>;
  getProfile(id: string): Promise<PublicProfile | null>;
  trackProfileView(id: string): Promise<void>;
  searchPeople(filters: PeopleFilters): Promise<PublicProfile[]>;

  // --- events ---
  listEvents(opts?: { includeHidden?: boolean }): Promise<SportEvent[]>;
  getEvent(id: string): Promise<SportEvent | null>;
  createEvent(input: NewEventInput, organizer: AppUser): Promise<SportEvent>;
  setEventStatus(id: string, status: EventStatus): Promise<void>;

  // --- comments ---
  listComments(eventId: string): Promise<EventComment[]>;
  addComment(eventId: string, text: string, user: AppUser): Promise<EventComment>;
  deleteComment(id: string): Promise<void>;

  // --- registrations ---
  /** Мои заявки: id события → статус. */
  myRegistrations(userId: string): Promise<Map<string, RegStatus>>;
  /** Подать заявку; возвращает статус (организатор своего события и импортные события — сразу approved). */
  register(eventId: string, user: AppUser): Promise<RegStatus>;
  unregister(eventId: string, user: AppUser): Promise<void>;
  /** Решение организатора по заявке. */
  decideRegistration(eventId: string, userId: string, approve: boolean): Promise<void>;
  participants(eventId: string): Promise<Participant[]>;

  // --- подтверждение игры и оценки ---
  /** Прошедшие события, которые я ещё не подтвердил и не оценил. */
  pendingReviews(user: AppUser): Promise<PendingReview[]>;
  /** Данные для экрана оценки конкретного события (null — оценивать нечего). */
  reviewFor(eventId: string, user: AppUser): Promise<PendingReview | null>;
  submitReview(eventId: string, happened: boolean, ratings: RatingInput[], user: AppUser): Promise<void>;

  // --- комьюнити ---
  listCommunities(): Promise<Community[]>;
  myCommunityIds(userId: string): Promise<Set<string>>;
  joinCommunity(id: string, user: AppUser): Promise<void>;
  leaveCommunity(id: string, user: AppUser): Promise<void>;
  createCommunity(input: NewCommunityInput, user: AppUser): Promise<Community>;
  deleteCommunity(id: string): Promise<void>;

  // --- уведомления ---
  listNotifications(user: AppUser): Promise<AppNotification[]>;
  markNotificationsRead(user: AppUser): Promise<void>;

  // --- тренер ---
  coachStats(user: AppUser, days: number, sport: string | null): Promise<CoachStats>;

  // --- расписание тренера ---
  /** Недельный шаблон тренера. */
  listCoachSlots(coachId: string): Promise<CoachSlot[]>;
  /** Создать (без id) или изменить слот; сервер сам перевыставит будущие занятия без записей. */
  saveCoachSlot(input: CoachSlotInput, user: AppUser, id?: string): Promise<CoachSlot>;
  deleteCoachSlot(id: string, user: AppUser): Promise<void>;
  /** Занятия тренера в диапазоне дат (владельцу — и отменённые). */
  coachSessions(coachId: string, fromIso: string, toIso: string): Promise<SportEvent[]>;
}
