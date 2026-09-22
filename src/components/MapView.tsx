import { useEffect, useRef, useState } from 'react';
import { MINSK_CENTER, sportMeta } from '../domain/sports';
import type { LatLng, SportEvent } from '../domain/types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

// Общий минимум API, который одинаково есть у mapbox-gl и maplibre-gl.
interface GlMarker {
  setLngLat(ll: [number, number]): GlMarker;
  addTo(map: GlMap): GlMarker;
  remove(): void;
  getElement(): HTMLElement;
}
interface GlMap {
  on(ev: string, cb: (e: { lngLat: { lng: number; lat: number } }) => void): void;
  getStyle(): { layers: { id: string; type: string; layout?: Record<string, unknown> }[] };
  setLayoutProperty(layer: string, name: string, value: unknown): void;
  setPaintProperty(layer: string, name: string, value: unknown): void;
  flyTo(opts: { center: [number, number]; zoom?: number }): void;
  remove(): void;
  resize(): void;
  getZoom(): number;
}
interface GlLib {
  Map: new (opts: Record<string, unknown>) => GlMap;
  Marker: new (opts?: Record<string, unknown>) => GlMarker;
}

function isDark(): boolean {
  const scheme = document.documentElement.dataset.scheme; // выставляет Telegram-платформа
  if (scheme) return scheme === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Фирменный вид карты «СпортРядом» поверх Mapbox Standard (без Mapbox Studio — всё в коде):
 * парки и зелёные зоны подсвечены (там проходит большинство тренировок), лишние POI и транспорт
 * приглушены, чтобы метки событий читались лучше.
 * https://docs.mapbox.com/map-styles/standard/api/
 */
function mapboxBasemapConfig(dark: boolean): Record<string, unknown> {
  return {
    lightPreset: dark ? 'night' : 'day',
    theme: 'faded',
    showPointOfInterestLabels: true,
    densityPointOfInterestLabels: 1,
    showTransitLabels: false,
    showPedestrianRoads: true,
    show3dObjects: true,
    showLandmarkIcons: true,
    colorGreenspace: dark ? '#1f4d33' : '#b7ebc6',
    colorWater: dark ? '#1b2f4a' : '#a5d4f5',
    colorLand: dark ? '#141821' : '#f6f7f2',
    colorMotorways: dark ? '#6b5a2e' : '#ffe08a',
    colorTrunks: dark ? '#5a4e30' : '#ffeab0',
    colorRoads: dark ? '#2a303b' : '#ffffff',
    colorPlaceLabels: dark ? '#e5e7eb' : '#1f2937',
    colorRoadLabels: dark ? '#9ca3af' : '#6b7280',
    colorPointOfInterestLabels: dark ? '#86efac' : '#15803d',
    colorModePointOfInterestLabels: 'single',
  };
}

/** Mapbox при наличии токена, иначе MapLibre + бесплатные векторные тайлы OpenFreeMap — карта работает и без ключей. */
/** OpenFreeMap: русские подписи и фирменные цвета парков/воды, как в стиле Mapbox. */
function customizeOpenFreeMap(map: GlMap, dark: boolean) {
  for (const layer of map.getStyle().layers) {
    const text = layer.layout?.['text-field'];
    if (layer.type === 'symbol' && text && JSON.stringify(text).includes('name')) {
      map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ru'], ['get', 'name']]);
    }
    if (layer.type !== 'fill') continue;
    if (/park|wood|grass|landcover_wood|landuse_park/.test(layer.id)) {
      map.setPaintProperty(layer.id, 'fill-color', dark ? '#1f4d33' : '#b7ebc6');
    } else if (/^water/.test(layer.id)) {
      map.setPaintProperty(layer.id, 'fill-color', dark ? '#1b2f4a' : '#a5d4f5');
    }
  }
}

async function loadGl(): Promise<{
  lib: GlLib;
  style: unknown;
  extra: Record<string, unknown>;
  onLoad?: (map: GlMap) => void;
}> {
  const dark = isDark();
  if (MAPBOX_TOKEN) {
    const [{ default: mapboxgl }] = await Promise.all([
      import('mapbox-gl'),
      import('mapbox-gl/dist/mapbox-gl.css'),
    ]);
    mapboxgl.accessToken = MAPBOX_TOKEN;
    return {
      lib: mapboxgl as unknown as GlLib,
      style: 'mapbox://styles/mapbox/standard',
      extra: { language: 'ru', config: { basemap: mapboxBasemapConfig(dark) }, pitch: 30 },
    };
  }
  const [maplibre] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]);
  return {
    lib: ((maplibre as { default?: unknown }).default ?? maplibre) as GlLib,
    style: `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'liberty'}`,
    extra: {},
    onLoad: (map) => customizeOpenFreeMap(map, dark),
  };
}

interface Props {
  events?: SportEvent[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  userLocation?: LatLng | null;
  /** Режим выбора точки (создание события) */
  pick?: { value: LatLng | null; onPick: (p: LatLng) => void };
  center?: LatLng;
  zoom?: number;
  className?: string;
}

export function MapView({ events = [], selectedId, onSelect, userLocation, pick, center, zoom = 11, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: GlMap; lib: GlLib } | null>(null);
  const markersRef = useRef<GlMarker[]>([]);
  const userMarkerRef = useRef<GlMarker | null>(null);
  const pickMarkerRef = useRef<GlMarker | null>(null);
  const handlersRef = useRef({ onSelect, onPick: pick?.onPick });
  handlersRef.current = { onSelect, onPick: pick?.onPick };
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Инициализация карты — один раз.
  useEffect(() => {
    let disposed = false;
    const start = center ?? pick?.value ?? MINSK_CENTER;
    loadGl()
      .then(({ lib, style, extra, onLoad }) => {
        if (disposed || !containerRef.current) return;
        const map = new lib.Map({
          container: containerRef.current,
          style,
          center: [start.lng, start.lat],
          zoom,
          attributionControl: true,
          ...extra,
        });
        map.on('click', (e) => {
          if (handlersRef.current.onPick) handlersRef.current.onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          else handlersRef.current.onSelect?.(null);
        });
        map.on('load', () => {
          map.resize();
          try {
            onLoad?.(map);
          } catch (err) {
            console.warn('map customization failed', err);
          }
        });
        mapRef.current = { map, lib };
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      mapRef.current?.map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Маркеры событий.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = events.map((e) => {
      const meta = sportMeta(e.sport);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'map-pin' + (e.id === selectedId ? ' is-selected' : '');
      el.style.setProperty('--pin', meta.color);
      el.innerHTML = `<span>${meta.emoji}</span>`;
      el.setAttribute('aria-label', e.title);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        handlersRef.current.onSelect?.(e.id);
      });
      return new m.lib.Marker({ element: el, anchor: 'bottom' }).setLngLat([e.lng, e.lat]).addTo(m.map);
    });
  }, [ready, events, selectedId]);

  // Точка «я здесь».
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (userLocation) {
      const el = document.createElement('div');
      el.className = 'map-me';
      userMarkerRef.current = new m.lib.Marker({ element: el }).setLngLat([userLocation.lng, userLocation.lat]).addTo(m.map);
    }
  }, [ready, userLocation]);

  // Выбранная точка в режиме создания события.
  const pickValue = pick?.value;
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    pickMarkerRef.current?.remove();
    pickMarkerRef.current = null;
    if (pickValue) {
      const el = document.createElement('div');
      el.className = 'map-pin is-selected';
      el.innerHTML = '<span>📍</span>';
      pickMarkerRef.current = new m.lib.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pickValue.lng, pickValue.lat])
        .addTo(m.map);
    }
  }, [ready, pickValue]);

  // Перелёт к выбранному событию.
  useEffect(() => {
    const m = mapRef.current;
    const e = events.find((x) => x.id === selectedId);
    if (ready && m && e) m.map.flyTo({ center: [e.lng, e.lat], zoom: Math.max(m.map.getZoom(), 13) });
  }, [ready, selectedId, events]);

  useEffect(() => {
    const m = mapRef.current;
    if (ready && m && center) m.map.flyTo({ center: [center.lng, center.lat], zoom: 13 });
  }, [ready, center]);

  return (
    <div className={`map ${className ?? ''}`}>
      <div ref={containerRef} className="map-canvas" />
      {!ready && !failed && <div className="map-overlay">Загружаем карту…</div>}
      {failed && <div className="map-overlay">Не удалось загрузить карту. Проверьте интернет.</div>}
    </div>
  );
}
