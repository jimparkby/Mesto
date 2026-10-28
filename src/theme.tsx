import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { platform } from './platforms';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

export const THEME_KEY = 'theme:v1';

/**
 * Владелец data-scheme на <html>: пользовательский выбор (Светлая/Тёмная) перекрывает систему,
 * при «Система» следуем за ОС или темой Telegram. Цвета хрома (статус-бар) синхронизируем через платформу.
 */
function applyScheme(scheme: Scheme): Scheme {
  document.documentElement.dataset.scheme = scheme;
  platform.setAppScheme(scheme);
  return scheme;
}

/** Синхронный отклик до первого рендера: по умолчанию белая; тёмная — только явный выбор. */
export function applyStoredThemeSync() {
  const v = localStorage.getItem(THEME_KEY);
  applyScheme(v === 'dark' ? 'dark' : 'light');
}

interface ThemeState {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  /** Какая схема применена прямо сейчас. */
  scheme: Scheme;
}

const ThemeCtx = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [system, setSystem] = useState<Scheme>(() => platform.systemScheme());
  const [scheme, setScheme] = useState<Scheme>(() => (localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'));

  // Смена системной темы / темы Telegram — учитываем только если пользователь выбрал «Система».
  useEffect(() => platform.onSystemSchemeChange(() => setSystem(platform.systemScheme())), []);

  // Восстановление выбора пользователя: без явного «dark» всегда белая.
  useEffect(() => {
    platform
      .storageGet(THEME_KEY)
      .then((v) => setModeState(v === 'dark' || v === 'light' ? v : 'light'))
      .catch(() => {});
  }, []);

  useLayoutEffect(() => {
    setScheme(applyScheme(mode === 'system' ? system : mode === 'dark' ? 'dark' : 'light'));
  }, [mode, system]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    platform.haptic('selection');
    platform.storageSet(THEME_KEY, m === 'system' ? null : m).catch(() => {});
  }, []);

  const value = useMemo(() => ({ mode, setMode, scheme }), [mode, setMode, scheme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
