import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { Layout } from './components/Layout';
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

export function App() {
  return (
    // HashRouter: работает без настройки сервера — на GitHub Pages, в Telegram и в Capacitor (file://).
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <FiltersProvider>
            <StartParamRedirect />
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
