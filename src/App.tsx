import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginSheet } from './components/LoginSheet';
import { Onboarding } from './components/Onboarding';
import { AdminPage } from './pages/AdminPage';
import { CreateEventPage } from './pages/CreateEventPage';
import { EventPage } from './pages/EventPage';
import { HomePage } from './pages/HomePage';
import { MapPage } from './pages/MapPage';
import { ProfilePage } from './pages/ProfilePage';
import { platform } from './platforms';
import { FiltersProvider, ToastProvider } from './state';

/** Ссылка вида t.me/<bot>/<app>?startapp=event_<id> сразу открывает карточку события. */
function StartParamRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const p = platform.startParam();
    if (p?.startsWith('event_')) navigate(`/event/${p.slice('event_'.length)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Сразу после онбординга в APK и браузере предлагаем войти, как в макете (Walkthrough → Login). */
function LoginAfterOnboarding() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(true);
  if (platform.kind === 'telegram' || loading || user) return null;
  return <LoginSheet open={open} onClose={() => setOpen(false)} />;
}

const ONBOARDED_KEY = 'onboarded:v1';

/** Онбординг показываем один раз; по прямой ссылке на событие — сразу к событию. */
function useOnboarding() {
  const [justFinished, setJustFinished] = useState(false);
  const [state, setState] = useState<'checking' | 'show' | 'done'>(() =>
    platform.startParam()?.startsWith('event_') ? 'done' : 'checking',
  );
  useEffect(() => {
    if (state !== 'checking') return;
    platform
      .storageGet(ONBOARDED_KEY)
      .then((v) => setState(v ? 'done' : 'show'))
      .catch(() => setState('show'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const finish = () => {
    setState('done');
    setJustFinished(true);
    platform.storageSet(ONBOARDED_KEY, '1').catch(() => {});
  };
  return { state, finish, justFinished };
}

export function App() {
  const onboarding = useOnboarding();
  if (onboarding.state === 'checking') return null;
  if (onboarding.state === 'show') return <Onboarding onDone={onboarding.finish} />;

  return (
    // HashRouter: работает без настройки сервера — на GitHub Pages, в Telegram и в Capacitor (file://).
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <FiltersProvider>
            <StartParamRedirect />
            {onboarding.justFinished && <LoginAfterOnboarding />}
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="map" element={<MapPage />} />
                <Route path="create" element={<CreateEventPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="event/:id" element={<EventPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </FiltersProvider>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
