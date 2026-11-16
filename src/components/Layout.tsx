import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CaretLeft, House, MagnifyingGlass, MapTrifold, SoccerBall, UserCircle, UsersThree, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthContext';
import { platform } from '../platforms';
import { useCity } from '../state';

const TABS: { to: string; label: string; Glyph: PhosphorIcon }[] = [
  { to: '/', label: 'События', Glyph: SoccerBall },
  { to: '/search', label: 'Поиск', Glyph: MagnifyingGlass },
  { to: '/map', label: 'Карта', Glyph: MapTrifold },
  { to: '/communities', label: 'Комьюнити', Glyph: UsersThree },
  { to: '/profile', label: 'Профиль', Glyph: UserCircle },
];

const ROOTS = new Set(TABS.map((t) => t.to));
/** Экраны со своей навигацией — без общей капсулы «Назад / На главную». */
const OWN_NAV = new Set(['/passport']);

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { chosen: cityChosen, setCity } = useCity();
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

  // Регистрация — это спортивный паспорт: после входа сначала заполняем его.
  const needsPassport = !!user && !user.onboarded;
  useEffect(() => {
    if (needsPassport && location.pathname !== '/passport') navigate('/passport?first=1', { replace: true });
  }, [needsPassport, location.pathname, navigate]);

  // Город из паспорта — по умолчанию для ленты, если пользователь не выбрал другой.
  useEffect(() => {
    if (user?.onboarded && !cityChosen && user.city) setCity(user.city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.onboarded]);

  const goBack = () => {
    platform.haptic('selection');
    if (location.key === 'default') navigate('/', { replace: true });
    else navigate(-1);
  };
  const goHome = () => {
    platform.haptic('selection');
    navigate('/');
  };

  return (
    <div className={`app${location.pathname === '/map' ? ' is-fullbleed' : ''}`}>
      {/* На внутренних страницах (событие, профиль участника) — свои «Назад» и «На главную»:
          в браузере и не во всех клиентах Telegram системной кнопки нет. */}
      {!isRoot && !OWN_NAV.has(location.pathname) && (
        <div className="subnav">
          <button type="button" className="subnav-btn" onClick={goBack} aria-label="Назад">
            <CaretLeft size={20} weight="bold" />
          </button>
          <button type="button" className="subnav-btn" onClick={goHome} aria-label="На главную">
            <House size={20} weight="fill" />
          </button>
        </div>
      )}
      <main className="app-main">
        <Outlet />
      </main>
      {isRoot && (
        <nav className="tabbar">
          {TABS.map(({ to, label, Glyph }) => (
            <NavLink
              key={to}
              to={to}
              end
              data-tour={to === '/map' ? 'tab-map' : to === '/search' ? 'tab-search' : undefined}
              className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}
              onClick={() => platform.haptic('selection')}
            >
              {({ isActive }) => (
                <>
                  <span className="tab-icon">
                    <Glyph size={24} weight={isActive ? 'fill' : 'regular'} />
                  </span>
                  <span className="tab-label">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
