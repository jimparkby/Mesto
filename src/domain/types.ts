/** id вида спорта из каталога (domain/sports.ts); хранится в БД строкой. */
export type SportId = string;

/** Уровень: Novice → Pro. 'any' — «любой» у события / «не указан» у человека. */
export type Level = 'any' | 'beginner' | 'amateur' | 'intermediate' | 'advanced' | 'pro';

export type EventType = 'training' | 'game';

export type EventStatus = 'published' | 'hidden' | 'cancelled';

export type Gender = 'male' | 'female';

/** Роль в спортивном паспорте: игрок ищет партнёров, тренер — учеников. */
export type PassportRole = 'player' | 'coach';

/** Средние оценки человека после игр и тренировок (1–5). */
export interface Ratings {
  /** Атмосфера: приятно ли играть с человеком. */
  vibe: number | null;
  /** Насколько заявленный уровень совпал с реальным. */
  levelFit: number | null;
  /** Эффективность тренировки — оценка тренера учениками. */
  effectiveness: number | null;
  /** Сколько оценок получено. */
  count: number;
}

export interface SportEvent {
  id: string;
  title: string;
  sport: SportId;
  eventType: EventType;
  description: string;
  startsAt: string; // ISO
  durationMin: number;
  venueName: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  /** Общий уровень (минимальный из levels) — для старых фильтров и импортных событий. */
  level: Level;
  /** Подходящие уровни участников; пусто — любой. */
  levels: Level[];
  price: number; // BYN, 0 = бесплатно
  /** Всего нужно участников. */
  capacity: number;
  /** Места, уже занятые вне приложения (организатор пришёл с друзьями). */
  reserved: number;
  registeredCount: number;
  organizerId: string;
  organizerName: string;
  /** @username организатора в Telegram (без @), если есть — чтобы ему написать. */
  organizerUsername?: string | null;
  organizerPhotoUrl?: string | null;
  /** Организатор — тренер: событие попадает в «Занятия с тренером». */
  organizerIsCoach?: boolean;
  /** Общий рейтинг организатора (1–5), null — оценок ещё нет. */
  organizerRating?: number | null;
  status: EventStatus;
  createdAt: string;
  /** Ссылка на исходный анонс, если событие импортировано из Telegram/Instagram/сайта. */
  sourceUrl?: string | null;
  /** Занятие выставлено из расписания тренера (слот шаблона). */
  slotId?: string | null;
  /** Моментальная запись: заявка принимается без подтверждения. */
  autoApprove?: boolean;
}

export type NewEventInput = Pick<
  SportEvent,
  | 'title'
  | 'sport'
  | 'eventType'
  | 'description'
  | 'startsAt'
  | 'durationMin'
  | 'venueName'
  | 'address'
  | 'city'
  | 'lat'
  | 'lng'
  | 'level'
  | 'levels'
  | 'price'
  | 'capacity'
  | 'reserved'
>;

export type AuthProviderKind = 'telegram' | 'guest';

/** Вид спорта в паспорте: уровень игрока; у тренера ещё стаж и цена занятия. */
export interface SportSkill {
  sport: SportId;
  level: Level;
  /** Тренер: сколько лет обучает. */
  years?: number;
  /** Тренер: цена занятия, BYN. */
  price?: number;
}

/** Спортивный паспорт — то, что заполняется при регистрации и видно другим. */
export interface Passport {
  /** Роль в паспорте: тренер ищет учеников, игрок — партнёров. */
  isCoach: boolean;
  gender: Gender | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
  city: string;
  languages: string[];
  bio: string;
  skills: SportSkill[];
  photos: string[];
  videos: string[];
}

/** Заявка на участие: ждёт организатора, принята или отклонена. */
export type RegStatus = 'pending' | 'approved' | 'rejected';

/** Профиль человека — то, что видно другим (участникам, в поиске, организатору). */
export interface PublicProfile extends Passport {
  id: string;
  name: string;
  username?: string | null;
  photoUrl?: string | null;
  /** Паспорт заполнен (регистрация пройдена). */
  onboarded: boolean;
  lastSeenAt: string | null;
  ratings: Ratings;
  createdAt?: string;
}

export interface AppUser extends PublicProfile {
  telegramId?: number | null;
  role: 'user' | 'admin';
  provider: AuthProviderKind;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface EventComment {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string | null;
  text: string;
  createdAt: string;
}

/** Оценка одного участника после события. */
export interface RatingInput {
  rateeId: string;
  vibe?: number | null;
  levelFit?: number | null;
  effectiveness?: number | null;
}

/** Событие, которое прошло и ждёт подтверждения и оценки от меня. */
export interface PendingReview {
  event: SportEvent;
  /** С кем оценивать: другие принятые участники (у тренировки тренера — сам тренер). */
  people: { id: string; name: string; photoUrl?: string | null; isCoach: boolean; skillLevel: Level }[];
}

export interface Community {
  id: string;
  title: string;
  description: string;
  sport: SportId | null;
  city: string;
  level: Level;
  /** Ссылка на Telegram-чат — общение идёт там. */
  tgLink: string;
  photoUrl?: string | null;
  createdBy: string | null;
  membersCount: number;
  createdAt: string;
}

export type NewCommunityInput = Pick<Community, 'title' | 'description' | 'sport' | 'city' | 'level' | 'tgLink'>;

export type NotificationKind =
  | 'welcome'
  | 'request_new'
  | 'request_approved'
  | 'request_rejected'
  | 'comment'
  | 'rate_reminder'
  | 'event_cancelled'
  | 'booking_new'
  | 'booking_cancelled';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Путь внутри приложения: /event/<id>, /user/<id>, /rate/<id>. */
  link: string | null;
  read: boolean;
  createdAt: string;
}

export type PeopleSort = 'rating' | 'new' | 'price';

export interface PeopleFilters {
  query: string;
  /** Кого ищем: игроков или тренеров. */
  role: PassportRole;
  city: string | null;
  sport: SportId | null;
  level: Level | 'all';
  gender: Gender | null;
  sort: PeopleSort;
}

/** Статистика тренера за период: графики и воронка. */
export interface CoachStats {
  days: { date: string; income: number; bookings: number; sessions: number }[];
  funnel: { views: number; requests: number; bookings: number; held: number };
  prevFunnel: { views: number; requests: number; bookings: number; held: number };
  income: number;
  prevIncome: number;
  totalIncome: number;
}

/** День недели ISO: 1 — понедельник … 7 — воскресенье. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Слот расписания тренера: повторяется каждую неделю, занятия по нему выставляются автоматически. */
export interface CoachSlot {
  id: string;
  coachId: string;
  weekdays: Weekday[];
  /** HH:MM, время Минска. */
  startTime: string;
  durationMin: number;
  sport: SportId;
  title: string;
  description: string;
  venueName: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  levels: Level[];
  price: number;
  /** Мест для клиентов (сам тренер не считается). */
  spots: number;
  /** Моментальная запись без подтверждения тренера. */
  autoApprove: boolean;
  active: boolean;
  /** YYYY-MM-DD */
  validFrom: string;
  validUntil: string | null;
}

export type CoachSlotInput = Omit<CoachSlot, 'id' | 'coachId' | 'validFrom'>;
