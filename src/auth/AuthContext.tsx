import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type TelegramLoginRequest } from '../api';
import type { AboutMe, AppUser, CoachProfile, RegStatus } from '../domain/types';
import { platform } from '../platforms';

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  /** id событий, на которые текущий пользователь записан (заявка принята) */
  myEventIds: Set<string>;
  /** Все мои заявки: id события → статус (pending / approved / rejected). */
  myRequests: Map<string, RegStatus>;
  signInAsGuest(name: string): Promise<void>;
  startTelegramLogin(): Promise<TelegramLoginRequest>;
  resendTelegramCode(token: string): Promise<void>;
  signInWithTelegramCode(token: string, code: string): Promise<AppUser>;
  signOut(): Promise<void>;
  updateAbout(about: AboutMe): Promise<void>;
  updateCoach(coach: CoachProfile | null): Promise<void>;
  refreshMyEvents(): Promise<void>;
  /** Возвращает статус заявки после записи (null — запись отменена). */
  toggleRegistration(eventId: string, join: boolean): Promise<RegStatus | null>;
}

const AuthCtx = createContext<AuthState | null>(null);

/**
 * Адаптер авторизации:
 *  - telegram: автоматический вход по Telegram.WebApp.initData (подпись проверяет сервер);
 *  - telegram-код: вне Telegram (APK, браузер) бот присылает код, его вводят в приложении;
 *  - guest: вход по имени в браузере и APK (в Supabase — анонимный пользователь).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myRequests, setMyRequests] = useState<Map<string, RegStatus>>(new Map());
  const myEventIds = useMemo(
    () => new Set([...myRequests].filter(([, st]) => st === 'approved').map(([id]) => id)),
    [myRequests],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let u = await api.restoreSession();
        const initData = platform.telegramInitData();
        const tgUser = platform.telegramUser();
        // В Telegram всегда входим под текущим аккаунтом Telegram, даже если сохранена другая сессия.
        if (initData && (!u || u.telegramId !== tgUser?.id)) {
          u = await api.signInWithTelegram(initData, tgUser);
        }
        if (!cancelled) setUser(u);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshMyEvents = useCallback(async () => {
    setMyRequests(user ? await api.myRegistrations(user.id) : new Map());
  }, [user]);

  useEffect(() => {
    refreshMyEvents().catch(() => {});
  }, [refreshMyEvents]);

  const signInAsGuest = useCallback(async (name: string) => {
    setError(null);
    const u = await api.signInAsGuest(name.trim() || 'Спортсмен');
    setUser(u);
  }, []);

  const startTelegramLogin = useCallback(() => {
    setError(null);
    return api.startTelegramLogin();
  }, []);

  const resendTelegramCode = useCallback((token: string) => api.resendTelegramCode(token), []);

  const signInWithTelegramCode = useCallback(async (token: string, code: string) => {
    const u = await api.signInWithTelegramCode(token, code);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    setUser(null);
  }, []);

  const updateAbout = useCallback(
    async (about: AboutMe) => {
      if (!user) throw new Error('Нужно войти');
      setUser(await api.updateAbout(user, about));
    },
    [user],
  );

  const updateCoach = useCallback(
    async (coach: CoachProfile | null) => {
      if (!user) throw new Error('Нужно войти');
      setUser(await api.updateCoach(user, coach));
    },
    [user],
  );

  const toggleRegistration = useCallback(
    async (eventId: string, join: boolean) => {
      if (!user) throw new Error('Нужно войти');
      const status = join ? await api.register(eventId, user) : null;
      if (!join) await api.unregister(eventId, user);
      setMyRequests((prev) => {
        const next = new Map(prev);
        if (status) next.set(eventId, status);
        else next.delete(eventId);
        return next;
      });
      return status;
    },
    [user],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      error,
      myEventIds,
      myRequests,
      signInAsGuest,
      startTelegramLogin,
      resendTelegramCode,
      signInWithTelegramCode,
      signOut,
      updateAbout,
      updateCoach,
      refreshMyEvents,
      toggleRegistration,
    }),
    [
      user,
      loading,
      error,
      myEventIds,
      myRequests,
      signInAsGuest,
      startTelegramLogin,
      resendTelegramCode,
      signInWithTelegramCode,
      signOut,
      updateAbout,
      updateCoach,
      refreshMyEvents,
      toggleRegistration,
    ],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
