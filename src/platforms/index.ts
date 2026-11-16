import { Capacitor } from '@capacitor/core';
import { createNativePlatform } from './native';
import { createTelegramPlatform, getTelegramWebApp } from './telegram';
import type { Platform } from './types';
import { createWebPlatform } from './web';

export type { Platform, PlatformKind, HapticKind, TelegramUserInfo } from './types';

function detect(): Platform {
  const tg = getTelegramWebApp();
  if (tg) return createTelegramPlatform(tg);
  if (Capacitor.isNativePlatform()) return createNativePlatform();
  return createWebPlatform();
}

export const platform: Platform = detect();
