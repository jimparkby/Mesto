import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { EventCard } from '../components/EventCard';
import { FilterBar } from '../components/FilterBar';
import { Icon } from '../components/Icon';
import { MapView } from '../components/MapView';
import { isPast } from '../domain/events';
import { applyFilters } from '../domain/filters';
import { useEvents, useGeolocation } from '../hooks';
import { useFilters } from '../state';

export function MapPage() {
  const { events } = useEvents();
  const { myEventIds } = useAuth();
  const { filters } = useFilters();
  const geo = useGeolocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(
    () => applyFilters(events.filter((e) => !isPast(e)), filters, geo.location),
    [events, filters, geo.location],
  );
  const selected = visible.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="map-page">
      <MapView
        events={visible}
        selectedId={selectedId}
        onSelect={setSelectedId}
        userLocation={geo.location}
        center={geo.location ?? undefined}
        className="map-full"
      />
      <div className="map-top">
        <FilterBar location={geo.location} onRequestLocation={geo.request} geoPending={geo.status === 'pending'} />
      </div>
      <button className="fab-locate" onClick={geo.request} aria-label="Где я">
        <Icon name="near" size={22} className={geo.status === 'pending' ? 'is-pending' : undefined} />
      </button>
      {selected && (
        <div className="map-bottom">
          <EventCard event={selected} location={geo.location} joined={myEventIds.has(selected.id)} />
        </div>
      )}
      {!selected && (
        <div className="map-count">
          {visible.length ? `${visible.length} событий на карте` : 'Нет событий по фильтрам'}
        </div>
      )}
    </div>
  );
}
