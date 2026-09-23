import type { Platform, TelegramUserInfo } from './types';

// Минимальная типизация того, что нам нужно из Telegram.WebApp.
interface TgButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramUserInfo; start_param?: string };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  isVersionAtLeast(v: string): boolean;
  disableVerticalSwipes?: () => void;
  requestFullscreen?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  setBottomBarColor?: (c: string) => void;
  onEvent(event: 'themeChanged', cb: () => void): void;
  BackButton: TgButton;
  HapticFeedback?: {
    impactOccurred(s: 'light' | 'medium' | 'heavy'): void;
    notificationOccurred(t: 'success' | 'error' | 'warning'): void;
    selectionChanged(): void;
  };
  openLink(url: string): void;
  openTelegramLink(url: string): void;
  CloudStorage?: {
    getItem(key: string, cb: (err: unknown, value?: string) => void): void;
    setItem(key: string, value: string, cb?: (err: unknown) => void): void;
    removeItem(key: string, cb?: (err: unknown) => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

const CLOUD_TIMEOUT_MS = 1500;

/** CloudStorage принимает ключи только из A-Z, a-z, 0-9, _ и -. */
function cloudKey(key: string): string {
  return key.replace(/[^A-Za-z0-9_-]/g, '_');
}

/** Mini App запущен внутри Telegram, если SDK получил initData. */
export function getTelegramWebApp(): TgWebApp | null {
  const tg = window.Telegram?.WebApp;
  return tg && tg.initData ? tg : null;
}

export function createTelegramPlatform(tg: TgWebApp): Platform {
  return {
    kind: 'telegram',
    async init() {
      tg.ready();
      tg.expand();
      if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes?.();
      // На телефонах — во весь экран; на десктопе это развернуло бы всё окно Telegram.
      if ((tg.platform === 'ios' || tg.platform === 'android') && tg.isVersionAtLeast('8.0')) {
        tg.requestFullscreen?.();
      }
      document.documentElement.dataset.platform = 'telegram';
      // Палитра своя, от Telegram берём только светлую/тёмную схему.
      const applyScheme = () => {
        document.documentElement.dataset.scheme = tg.colorScheme;
        const bg = tg.colorScheme === 'dark' ? '#140a0c' : '#f6f1ef';
        if (tg.isVersionAtLeast('6.1')) {
          tg.setHeaderColor?.(bg);
          tg.setBackgroundColor?.(bg);
        }
        if (tg.isVersionAtLeast('7.10')) tg.setBottomBarColor?.(bg);
      };
      applyScheme();
      tg.onEvent('themeChanged', applyScheme);
    },
    setBackHandler(handler) {
      if (!handler) {
        tg.BackButton.hide();
        return () => {};
      }
      tg.BackButton.onClick(handler);
      tg.BackButton.show();
      return () => {
        tg.BackButton.offClick(handler);
        tg.BackButton.hide();
      };
    },
    haptic(kind) {
      const h = tg.HapticFeedback;
      if (!h) return;
      if (kind === 'success' || kind === 'error') h.notificationOccurred(kind);
      else if (kind === 'selection') h.selectionChanged();
      else h.impactOccurred(kind);
    },
    async share(url, text) {
      const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
      tg.openTelegramLink(link);
    },
    openLink(url) {
      if (url.startsWith('https://t.me/')) tg.openTelegramLink(url);
      else tg.openLink(url);
    },
    // CloudStorage синхронизируется между устройствами пользователя; localStorage — запасной вариант.
    // Мобильные клиенты иногда не отвечают на запрос — тогда по таймауту берём localStorage.
    storageGet(key) {
      const cs = tg.CloudStorage;
      const local = () => localStorage.getItem(key);
      if (!cs || !tg.isVersionAtLeast('6.9')) return Promise.resolve(local());
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(local()), CLOUD_TIMEOUT_MS);
        try {
          cs.getItem(cloudKey(key), (err, value) => {
            clearTimeout(timer);
            resolve(err ? local() : value || local());
          });
        } catch {
          clearTimeout(timer);
          resolve(local());
        }
      });
    },
    async storageSet(key, value) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      const cs = tg.CloudStorage;
      if (!cs || !tg.isVersionAtLeast('6.9')) return;
      if (value === null) cs.removeItem(cloudKey(key));
      else cs.setItem(cloudKey(key), value);
    },
    telegramInitData: () => tg.initData,
    telegramUser: () => tg.initDataUnsafe.user ?? null,
    // start_param приходит при запуске по прямой ссылке t.me/<bot>/<app>?startapp=…,
    // а при открытии из inline-кнопки бота параметр остаётся в URL.
    startParam: () =>
      tg.initDataUnsafe.start_param ?? new URLSearchParams(location.search).get('startapp'),
  };
}
