import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { EAC_LOCATIONS, type LocationPoint } from "@/lib/locations";

type LocationPickerProps = {
  label: string;
  value?: LocationPoint;
  countryCode?: string;
  onChange: (location: LocationPoint) => void;
};

function distanceSquared(latitude: number, longitude: number, point: LocationPoint) {
  return (latitude - point.latitude) ** 2 + (longitude - point.longitude) ** 2;
}

function nearestLocation(latitude: number, longitude: number, countryCode?: string) {
  const candidates = EAC_LOCATIONS.filter((location) => !countryCode || location.countryCode === countryCode);
  return candidates.sort((a, b) => distanceSquared(latitude, longitude, a) - distanceSquared(latitude, longitude, b))[0] || EAC_LOCATIONS[0];
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 7));
  }, [center, map]);
  return null;
}

function MapClick({ onPick }: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

export function LocationPicker({ label, value, countryCode, onChange }: LocationPickerProps) {
  const [query, setQuery] = useState(value?.city || "");
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return EAC_LOCATIONS
      .filter((location) => !countryCode || location.countryCode === countryCode)
      .filter((location) => !normalized || `${location.city} ${location.countryName}`.toLowerCase().includes(normalized))
      .slice(0, 6);
  }, [countryCode, query]);
  const center: [number, number] = value ? [value.latitude, value.longitude] : (() => {
    const fallback = nearestLocation(0.3476, 32.5825, countryCode);
    return [fallback.latitude, fallback.longitude];
  })();

  useEffect(() => {
    setQuery(value?.city || "");
  }, [value?.city]);

  const choose = (location: LocationPoint) => {
    setQuery(location.city);
    setOpen(false);
    onChange(location);
  };

  const pin = (latitude: number, longitude: number) => {
    const nearest = nearestLocation(latitude, longitude, countryCode);
    choose({
      ...nearest,
      city: `Near ${nearest.city}`,
      latitude,
      longitude,
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => pin(coords.latitude, coords.longitude),
      () => setOpen(true),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  return (
    <div className="block">
      <span className="mb-1.5 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">
        {label} <span className="text-accent-foreground">*</span>
      </span>
      <div className="relative">
        <div className="flex gap-2">
          <input
            required
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            value={query}
            placeholder="Search a city or pin the exact area"
            onFocus={() => setOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          />
          <button type="button" onClick={useCurrentLocation} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[10px] font-bold hover:bg-muted" title="Use this device's location">
            <span aria-hidden="true">⌖</span> Use GPS
          </button>
        </div>
        {open && options.length > 0 && (
          <div className="absolute inset-x-0 top-11 z-[1000] overflow-hidden rounded-lg border border-border bg-card shadow-xl">
            {options.map((location) => (
              <button
                key={`${location.countryCode}-${location.city}`}
                type="button"
                className="block w-full border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(location)}
              >
                <span className="block text-xs font-bold">{location.city}</span>
                <span className="block text-[10px] text-muted-foreground">{location.countryName} · choose the exact area on the map below</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 overflow-hidden rounded-lg border border-border">
        <MapContainer center={center} zoom={7} scrollWheelZoom className="h-[170px] w-full" zoomControl attributionControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClick onPick={pin} />
          <RecenterMap center={center} />
          {value && <CircleMarker center={[value.latitude, value.longitude]} radius={9} pathOptions={{ color: "#a96824", fillColor: "#d7984e", fillOpacity: 1, weight: 3 }} />}
        </MapContainer>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        {value ? `Pinned at ${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)} · drag-free map: click a more exact point.` : "Choose a city, then click the map to refine the pickup or delivery area."}
      </p>
    </div>
  );
}