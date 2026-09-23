import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { Platform } from './types';

/** Android-оболочка на Capacitor. */
export function createNativePlatform(): Platform {
  let backHandler: (() => void) | null = null;

  return {
    kind: 'native',
    async init() {
      document.documentElement.dataset.platform = 'native';
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
      await StatusBar.setBackgroundColor({ color: dark ? '#000000' : '#f1f1f3' }).catch(() => {});

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
      await Share.share({ title: 'СпортРядом', text, url, dialogTitle: 'Поделиться событием' });
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
    telegramInitData: () => null,
    telegramUser: () => null,
    startParam: () => null,
  };
}
