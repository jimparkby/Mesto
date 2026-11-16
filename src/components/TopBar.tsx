import { Bell, CaretDown, MapPin } from '@phosphor-icons/react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { CITIES } from '../domain/cities';
import { platform } from '../platforms';
import { useCity } from '../state';
import { Sheet } from './Sheet';

/** Верхняя панель вкладки: город слева, название по центру, действия справа (колокольчик, фильтры). */
export function TopBar({ title, actions, bell = true }: { title: string; actions?: ReactNode; bell?: boolean }) {
  const { city } = useCity();
  const { unreadCount, user } = useAuth();
  const [cityOpen, setCityOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div className={`topbar${scrolled ? ' is-scrolled' : ''}`}>
        <button type="button" className="topbar-city" onClick={() => setCityOpen(true)} aria-label={`Город: ${city}`}>
          <MapPin size={16} weight="fill" />
          <span>{city}</span>
          <CaretDown size={12} weight="bold" />
        </button>
        <h1 className="topbar-title">{title}</h1>
        <div className="topbar-actions">
          {actions}
          {bell && user && (
            <Link to="/notifications" className="topbar-btn" aria-label={unreadCount ? `Уведомления: ${unreadCount} новых` : 'Уведомления'}>
              <Bell size={22} weight={unreadCount ? 'fill' : 'regular'} />
              {unreadCount > 0 && <span className="topbar-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </Link>
          )}
        </div>
      </div>
      <CitySheet open={cityOpen} onClose={() => setCityOpen(false)} />
    </>
  );
}

export function CitySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { city, setCity } = useCity();
  return (
    <Sheet open={open} onClose={onClose} title="Город">
      <div className="city-list">
        {CITIES.map((c) => (
          <button
            key={c.name}
            type="button"
            className={`city-row${c.name === city ? ' is-on' : ''}`}
            onClick={() => {
              platform.haptic('selection');
              setCity(c.name);
              onClose();
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Кнопка в правой части верхней панели. */
export function TopBarButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button type="button" className={`topbar-btn${active ? ' is-active' : ''}`} onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}
