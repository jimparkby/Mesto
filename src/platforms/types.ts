export type PlatformKind = 'telegram' | 'native' | 'web';

export type HapticKind = 'light' | 'medium' | 'success' | 'error' | 'selection';

export interface TelegramUserInfo {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

/**
 * Всё, что зависит от оболочки (Telegram / Android / браузер), живёт за этим интерфейсом.
 * Страницы и компоненты работают только с ним и ничего не знают про Telegram или Capacitor.
 */
export interface Platform {
  kind: PlatformKind;
  init(): Promise<void>;
  /** Показать системную кнопку «Назад» (null — скрыть). Возвращает функцию отписки. */
  setBackHandler(handler: (() => void) | null): () => void;
  haptic(kind: HapticKind): void;
  share(url: string, text: string): Promise<void>;
  openLink(url: string): void;
  storageGet(key: string): Promise<string | null>;
  storageSet(key: string, value: string | null): Promise<void>;
  /** Подписанные данные запуска Telegram (для проверки на сервере). */
  telegramInitData(): string | null;
  telegramUser(): TelegramUserInfo | null;
  /** Параметр ?startapp=… из ссылки на Mini App. */
  startParam(): string | null;
}
