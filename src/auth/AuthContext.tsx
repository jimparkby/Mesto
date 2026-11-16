import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type MediaKind, type PassportUpdate, type TelegramLoginRequest } from '../api';
import type { AppNotification, AppUser, PendingReview, RegStatus } from '../domain/types';
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
  /** Сохранить спортивный паспорт (регистрация и редактирование профиля). */
  savePassport(update: PassportUpdate): Promise<AppUser>;
  uploadMedia(file: File, kind: MediaKind): Promise<string>;
  /** Перечитать профиль с сервера. */
  reloadMe(): Promise<void>;
  refreshMyEvents(): Promise<void>;
  /** Возвращает статус заявки после записи (null — запись отменена). */
  toggleRegistration(eventId: string, join: boolean): Promise<RegStatus | null>;

  notifications: AppNotification[];
  unreadCount: number;
  refreshNotifications(): Promise<void>;
  markNotificationsRead(): Promise<void>;
  /** Прошедшие события, ждущие подтверждения и оценки. */
  pendingReviews: PendingReview[];
  refreshReviews(): Promise<void>;
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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
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

  const userId = user?.id;

  // «Онлайн»: отмечаемся при входе и раз в 2 минуты, пока приложение открыто.
  useEffect(() => {
    if (!userId) return;
    const touch = () => {
      if (document.visibilityState === 'visible') api.touchLastSeen().catch(() => {});
    };
    touch();
    const t = setInterval(touch, 120_000);
    document.addEventListener('visibilitychange', touch);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', touch);
    };
  }, [userId]);

  const refreshMyEvents = useCallback(async () => {
    setMyRequests(userId ? await api.myRegistrations(userId) : new Map());
  }, [userId]);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setNotifications(await api.listNotifications(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const refreshReviews = useCallback(async () => {
    if (!user) {
      setPendingReviews([]);
      return;
    }
    setPendingReviews(await api.pendingReviews(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    refreshMyEvents().catch(() => {});
    refreshNotifications().catch(() => {});
    refreshReviews().catch(() => {});
    if (!userId) return;
    // Уведомления подтягиваем раз в минуту — новые заявки и ответы организаторов.
    const t = setInterval(() => refreshNotifications().catch(() => {}), 60_000);
    return () => clearInterval(t);
  }, [userId, refreshMyEvents, refreshNotifications, refreshReviews]);

  const markNotificationsRead = useCallback(async () => {
    if (!user) return;
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    await api.markNotificationsRead(user).catch(() => {});
  }, [user]);

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

  const savePassport = useCallback(
    async (update: PassportUpdate) => {
      if (!user) throw new Error('Нужно войти');
      const next = await api.updatePassport(user, update);
      setUser(next);
      return next;
    },
    [user],
  );

  const uploadMedia = useCallback(
    async (file: File, kind: MediaKind) => {
      if (!user) throw new Error('Нужно войти');
      return api.uploadMedia(user, file, kind);
    },
    [user],
  );

  const reloadMe = useCallback(async () => {
    if (!user) return;
    setUser(await api.reloadMe(user));
  }, [user]);

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

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

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
      savePassport,
      uploadMedia,
      reloadMe,
      refreshMyEvents,
      toggleRegistration,
      notifications,
      unreadCount,
      refreshNotifications,
      markNotificationsRead,
      pendingReviews,
      refreshReviews,
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
      savePassport,
      uploadMedia,
      reloadMe,
      refreshMyEvents,
      toggleRegistration,
      notifications,
      unreadCount,
      refreshNotifications,
      markNotificationsRead,
      pendingReviews,
      refreshReviews,
    ],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
