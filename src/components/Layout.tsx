import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { platform } from '../platforms';

const TABS = [
  { to: '/', label: 'События', icon: '🏟️' },
  { to: '/map', label: 'Карта', icon: '🗺️' },
  { to: '/create', label: 'Создать', icon: '➕' },
  { to: '/profile', label: 'Профиль', icon: '👤' },
];

const ROOTS = new Set(TABS.map((t) => t.to));

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isRoot = ROOTS.has(location.pathname);

  // Кнопка «Назад»: Telegram BackButton / аппаратная кнопка Android.
  useEffect(() => {
    if (isRoot) {
      // На вкладках, кроме главной, «Назад» ведёт на главную; на главной — выход (Android) / скрыта (Telegram).
      if (location.pathname === '/') return platform.setBackHandler(null);
      return platform.setBackHandler(() => navigate('/'));
    }
    return platform.setBackHandler(() => {
      if (location.key === 'default') navigate('/', { replace: true });
      else navigate(-1);
    });
  }, [isRoot, location.pathname, location.key, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className={`app${location.pathname === '/map' ? ' is-fullbleed' : ''}`}>
      <main className="app-main">
        <Outlet />
      </main>
      {isRoot && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end
              className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}
              onClick={() => platform.haptic('selection')}
            >
              <span className="tab-icon" aria-hidden>
                {t.icon}
              </span>
              <span className="tab-label">{t.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
