import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { LatLng, SportEvent } from './domain/types';

export function useEvents(opts?: { includeHidden?: boolean }) {
  const includeHidden = !!opts?.includeHidden;
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setEvents(await api.listEvents({ includeHidden }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [includeHidden]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { events, loading, error, reload };
}

type GeoStatus = 'idle' | 'pending' | 'granted' | 'denied';

let cachedLocation: LatLng | null = null;

/** Геопозиция пользователя (запрашивается по кнопке, результат кешируется на сессию). */
export function useGeolocation() {
  const [location, setLocation] = useState<LatLng | null>(cachedLocation);
  const [status, setStatus] = useState<GeoStatus>(cachedLocation ? 'granted' : 'idle');

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('denied');
      return;
    }
    setStatus('pending');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(cachedLocation);
        setStatus('granted');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  return { location, status, request };
}
