import type { LatLng } from './types';

export interface City {
  name: string;
  center: LatLng;
}

/** Города Беларуси: выбор города в шапке, в паспорте и при создании события. */
export const CITIES: City[] = [
  { name: 'Минск', center: { lat: 53.9023, lng: 27.5619 } },
  { name: 'Брест', center: { lat: 52.0976, lng: 23.7341 } },
  { name: 'Витебск', center: { lat: 55.1904, lng: 30.2049 } },
  { name: 'Гомель', center: { lat: 52.4412, lng: 30.9878 } },
  { name: 'Гродно', center: { lat: 53.6694, lng: 23.8131 } },
  { name: 'Могилёв', center: { lat: 53.9007, lng: 30.3313 } },
  { name: 'Бобруйск', center: { lat: 53.1384, lng: 29.2214 } },
  { name: 'Барановичи', center: { lat: 53.1327, lng: 26.0139 } },
  { name: 'Борисов', center: { lat: 54.2279, lng: 28.5050 } },
  { name: 'Пинск', center: { lat: 52.1229, lng: 26.0951 } },
  { name: 'Орша', center: { lat: 54.5081, lng: 30.4172 } },
  { name: 'Мозырь', center: { lat: 52.0495, lng: 29.2456 } },
  { name: 'Солигорск', center: { lat: 52.7876, lng: 27.5415 } },
  { name: 'Новополоцк', center: { lat: 55.5318, lng: 28.5989 } },
  { name: 'Лида', center: { lat: 53.8885, lng: 25.2846 } },
  { name: 'Молодечно', center: { lat: 54.3104, lng: 26.8519 } },
  { name: 'Полоцк', center: { lat: 55.4879, lng: 28.7856 } },
  { name: 'Жлобин', center: { lat: 52.8926, lng: 30.0240 } },
  { name: 'Светлогорск', center: { lat: 52.6329, lng: 29.7389 } },
  { name: 'Речица', center: { lat: 52.3617, lng: 30.3916 } },
  { name: 'Слуцк', center: { lat: 53.0274, lng: 27.5597 } },
  { name: 'Жодино', center: { lat: 54.0985, lng: 28.3331 } },
];

export const DEFAULT_CITY = 'Минск';

export function cityCenter(name: string | null | undefined): LatLng {
  return (CITIES.find((c) => c.name === name) ?? CITIES[0]).center;
}

/** Ближайший город к точке — чтобы событие само получило город по месту на карте. */
export function nearestCity(p: LatLng): string {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = (c.center.lat - p.lat) ** 2 + ((c.center.lng - p.lng) * Math.cos((p.lat * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.name;
}

/** Языки в спортивном паспорте. */
export const LANGUAGES = ['Русский', 'Беларуская', 'English', 'Polski', 'Українська', 'Deutsch', 'Español', 'Français', 'Italiano', '中文'];
