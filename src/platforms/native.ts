import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { Platform } from './types';

/** Дубль ключа из src/theme.tsx (без импорта, чтобы не зацикливать платформу и тему). */
const THEME_STORAGE_KEY = 'theme:v1';

function applyStatusBar(scheme: 'light' | 'dark') {
  StatusBar.setStyle({ style: scheme === 'dark' ? Style.Dark : Style.Light }).catch(() => {});
  StatusBar.setBackgroundColor({ color: scheme === 'dark' ? '#140a0c' : '#ffffff' }).catch(() => {});
}

/** Android-оболочка на Capacitor. */
export function createNativePlatform(): Platform {
  let backHandler: (() => void) | null = null;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  return {
    kind: 'native',
    async init() {
      document.documentElement.dataset.platform = 'native';
      // До первого рендера: по умолчанию белая; тёмная — только явный выбор.
      const stored = (await Preferences.get({ key: THEME_STORAGE_KEY }).catch(() => ({ value: null }))).value;
      const scheme: 'light' | 'dark' = stored === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.scheme = scheme;
      applyStatusBar(scheme);

      // Аппаратная кнопка «Назад»: сначала внутренняя навигация, на корневом экране — выход.
      await App.addListener('backButton', () => {
        if (backHandler) backHandler();
        else App.exitApp();
      });
      await SplashScreen.hide().catch(() => {});
    },
    setBackHandler(handler) {
      backHandler = handler;
      return () => {
        if (backHandler === handler) backHandler = null;
      };
    },
    haptic() {
      // Для MVP без @capacitor/haptics — достаточно визуального отклика.
    },
    async share(url, text) {
      await Share.share({ title: 'Mesto', text, url, dialogTitle: 'Поделиться событием' });
    },
    openLink(url) {
      window.open(url, '_system');
    },
    async storageGet(key) {
      return (await Preferences.get({ key })).value;
    },
    async storageSet(key, value) {
      if (value === null) await Preferences.remove({ key });
      else await Preferences.set({ key, value });
    },
    systemScheme: () => 'light' as const,
    onSystemSchemeChange(cb) {
      media.addEventListener('change', cb);
      return () => media.removeEventListener('change', cb);
    },
    setAppScheme: applyStatusBar,
    telegramInitData: () => null,
    telegramUser: () => null,
    startParam: () => null,
  };
}
