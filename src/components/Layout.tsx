import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { platform } from '../platforms';
import { Icon, type IconName } from './Icon';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/create', label: 'Создать', icon: 'plus' },
  { to: '/events', label: 'События', icon: 'events' },
  { to: '/map', label: 'Карта', icon: 'map' },
  { to: '/profile', label: 'Профиль', icon: 'user' },
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
    <div
      className={`app${location.pathname === '/map' ? ' is-fullbleed' : ''}${
        location.pathname === '/' ? ' is-start' : ''
      }`}
    >
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
              data-tour={t.to === '/map' ? 'tab-map' : t.to === '/create' ? 'tab-create' : undefined}
              className={({ isActive }) =>
                `tab${t.to === '/events' ? ' tab-fab' : ''}${isActive ? ' is-active' : ''}`
              }
              onClick={() => platform.haptic('selection')}
            >
              {({ isActive }) => (
                <>
                  <span className="tab-icon">
                    {t.to === '/events' ? (
                      <Icon name="events" size={20} weight="fill" />
                    ) : (
                      <Icon name={t.icon} size={24} weight={isActive ? 'fill' : 'regular'} />
                    )}
                  </span>
                  <span className="tab-label">{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
