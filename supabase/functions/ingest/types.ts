// Общие типы воркера. Значения sport/level совпадают с CHECK-ограничениями в public.events.

export const SPORTS = [
  'football', 'running', 'basketball', 'volleyball', 'tennis', 'yoga',
  'cycling', 'workout', 'swimming', 'hockey', 'other',
] as const;
export type SportId = (typeof SPORTS)[number];

export const LEVELS = ['any', 'beginner', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];

/** Пост из любого источника. */
export interface SourcePost {
  source: 'telegram' | 'probeg';
  /** Уникален в пределах источника, например 'minskafisha/1234'. */
  postId: string;
  url: string;
  postedAt: string | null;
  text: string;
  /** Название канала/аккаунта — станет «организатором» события. */
  sourceName: string;
  /** Вид спорта тематического канала, если задан в настройках. */
  defaultSport?: SportId;
  /** Структурированные источники (сайты-календари) сразу отдают события — текстовые правила не нужны. */
  events?: ExtractedEvent[];
  /** Почему событий нет (для структурированных источников). */
  reason?: string;
  /** Не помечать разобранным: данных пока не хватает, посмотрим в следующий проход. */
  retryLater?: boolean;
}

/** Событие, распознанное в посте (время — местное, Europe/Minsk). */
export interface ExtractedEvent {
  title: string;
  sport: SportId;
  description: string;
  starts_at_local: string; // 'YYYY-MM-DDTHH:mm'
  duration_min: number | null;
  venue_name: string;
  address: string;
  level: Level;
  price_byn: number | null;
  capacity: number | null;
  organizer: string;
  /** Координаты, если место из справочника известных мест; иначе — геокодер. */
  lat?: number;
  lng?: number;
  /** false — распознано не уверенно, событие уйдёт на модерацию скрытым. */
  confident: boolean;
}
