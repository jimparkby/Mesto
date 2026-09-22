import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_FILTERS, type EventFilters, type SortMode } from './domain/filters';
import { platform, type HapticKind } from './platforms';

// ---------- Фильтры: общие для списка и карты ----------

interface FiltersState {
  filters: EventFilters;
  setFilters: (f: EventFilters | ((prev: EventFilters) => EventFilters)) => void;
  sort: SortMode;
  setSort: (s: SortMode) => void;
}

const FiltersCtx = createContext<FiltersState | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortMode>('time');
  const value = useMemo(() => ({ filters, setFilters, sort, setSort }), [filters, sort]);
  return <FiltersCtx.Provider value={value}>{children}</FiltersCtx.Provider>;
}

export function useFilters(): FiltersState {
  const ctx = useContext(FiltersCtx);
  if (!ctx) throw new Error('useFilters outside FiltersProvider');
  return ctx;
}

// ---------- Всплывающие уведомления ----------

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'error';
}

const ToastCtx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const show = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++seq.current;
    const haptic: Record<Toast['kind'], HapticKind> = { info: 'light', success: 'success', error: 'error' };
    platform.haptic(haptic[kind]);
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
