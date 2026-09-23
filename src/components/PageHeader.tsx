import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Кнопки верхней панели: при прокрутке собираются в капсулу с блюром. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** Увеличенный заголовок One UI: крупное название сверху, при прокрутке контент уходит под градиент. */
export function PageHeader({ eyebrow, title, actions, children }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div className={`appbar${scrolled ? ' is-scrolled' : ''}`}>
        {actions && <div className="appbar-actions">{actions}</div>}
      </div>
      <header className="big-header">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="big-title">{title}</h1>
        {children && <div className="big-extra">{children}</div>}
      </header>
    </>
  );
}
