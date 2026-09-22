export type SportId =
  | 'football'
  | 'running'
  | 'basketball'
  | 'volleyball'
  | 'tennis'
  | 'yoga'
  | 'cycling'
  | 'workout'
  | 'swimming'
  | 'hockey'
  | 'other';

export type Level = 'any' | 'beginner' | 'intermediate' | 'advanced';

export type EventStatus = 'published' | 'hidden' | 'cancelled';

export interface SportEvent {
  id: string;
  title: string;
  sport: SportId;
  description: string;
  startsAt: string; // ISO
  durationMin: number;
  venueName: string;
  address: string;
  lat: number;
  lng: number;
  level: Level;
  price: number; // BYN, 0 = бесплатно
  capacity: number;
  registeredCount: number;
  organizerId: string;
  organizerName: string;
  status: EventStatus;
  createdAt: string;
}

export type NewEventInput = Pick<
  SportEvent,
  | 'title'
  | 'sport'
  | 'description'
  | 'startsAt'
  | 'durationMin'
  | 'venueName'
  | 'address'
  | 'lat'
  | 'lng'
  | 'level'
  | 'price'
  | 'capacity'
>;

export type AuthProviderKind = 'telegram' | 'guest';

export interface AppUser {
  id: string;
  name: string;
  username?: string | null;
  photoUrl?: string | null;
  telegramId?: number | null;
  role: 'user' | 'admin';
  provider: AuthProviderKind;
}

export interface LatLng {
  lat: number;
  lng: number;
}
