import type { Platform } from './types';

export async function webShare(url: string, text: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'СпортРядом', text, url });
      return;
    } catch {
      // пользователь закрыл диалог — переходим к копированию
    }
  }
  await navigator.clipboard?.writeText(`${text}\n${url}`);
}

export function createWebPlatform(): Platform {
  return {
    kind: 'web',
    async init() {},
    setBackHandler() {
      return () => {};
    },
    haptic(kind) {
      if (kind === 'error') navigator.vibrate?.([30, 40, 30]);
    },
    share: webShare,
    openLink(url) {
      window.open(url, '_blank', 'noopener');
    },
    async storageGet(key) {
      return localStorage.getItem(key);
    },
    async storageSet(key, value) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    },
    telegramInitData: () => null,
    telegramUser: () => null,
    startParam: () => new URLSearchParams(location.search).get('startapp'),
  };
}
