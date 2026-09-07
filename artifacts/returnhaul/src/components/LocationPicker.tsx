import { useEffect, useRef, useState } from "react";
import { Check, Crosshair, MapPinned, Search, X } from "lucide-react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { EAC_LOCATIONS, type LocationPoint } from "@/lib/locations";

type LocationPickerProps = {
  label: string;
  value?: LocationPoint;
  countryCode?: string;
  onChange: (location: LocationPoint) => void;
  onLabelChange?: (label: string) => void;
};

const LOCATION_API_ROOT = (() => {
  const value = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
  if (!value) return "";
  return value.endsWith("/api") ? value : `${value}/api`;
})();

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

export function LocationPicker({ label, value, countryCode, onChange, onLabelChange }: LocationPickerProps) {
  const [query, setQuery] = useState(value?.city || "");
  const [open, setOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [gpsState, setGpsState] = useState<"idle" | "loading" | "error">("idle");
  const [suggestions, setSuggestions] = useState<LocationPoint[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const mapLocation = value || suggestions[0] || nearestLocation(0.3476, 32.5825, countryCode);
  const center: [number, number] = [mapLocation.latitude, mapLocation.longitude];

  useEffect(() => {
    if (!mapOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mapOpen]);

  useEffect(() => {
    setQuery(value?.city || "");
    setOpen(false);
    setSuggestions([]);
    inputRef.current?.setCustomValidity("");
  }, [countryCode]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
      setSearchState("idle");
      return;
    }
    if (!LOCATION_API_ROOT) {
      setSuggestions([]);
      setSearchState("error");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchState("loading");
      try {
        const params = new URLSearchParams({ q: normalized });
        if (countryCode) params.set("countryCode", countryCode);
        const response = await fetch(`${LOCATION_API_ROOT}/locations/search?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Location search failed");
        const body = await response.json();
        if (!controller.signal.aborted) {
          setSuggestions(Array.isArray(body) ? body.slice(0, 3) : []);
          setSearchState("idle");
        }
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSearchState("error");
        }
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [countryCode, query]);

  const choose = (location: LocationPoint) => {
    setQuery(location.city);
    setOpen(false);
    setSuggestions([]);
    setGpsState("idle");
    inputRef.current?.setCustomValidity("");
    onChange(location);
  };

  const pin = (latitude: number, longitude: number) => {
    const nearest = nearestLocation(latitude, longitude, countryCode);
    choose({
      ...nearest,
      city: query.trim() || `Near ${nearest.city}`,
      latitude,
      longitude,
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsState("error");
      return;
    }
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGpsState("idle");
        pin(coords.latitude, coords.longitude);
      },
      () => setGpsState("error"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  return (
    <div className="block">
      <span className="mb-1.5 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">
        {label} <span className="text-accent-foreground">*</span>
      </span>
      <div className="relative" onBlur={() => window.setTimeout(() => setOpen(false), 120)}>
        <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 shadow-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            required
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            value={query}
            placeholder="Search a location or landmark"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open && suggestions.length > 0}
            autoComplete="off"
            onFocus={() => setOpen(query.trim().length >= 2 && suggestions.length > 0)}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              setSuggestions([]);
              setOpen(nextQuery.trim().length >= 2);
              event.currentTarget.setCustomValidity(nextQuery.trim() ? "Choose a location from the map results, or use GPS." : "");
              onLabelChange?.(nextQuery.trim());
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (event.key === "Enter" && open && suggestions[0]) {
                event.preventDefault();
                choose(suggestions[0]);
              }
            }}
          />
          {value && <Check size={16} className="shrink-0 text-primary" aria-label="Location selected" />}
          <button
            type="button"
            onClick={() => { setOpen(false); setMapOpen(true); }}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-secondary px-2.5 text-[10px] font-bold text-secondary-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            <MapPinned size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Open map</span>
            <span className="sm:hidden">Map</span>
          </button>
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute inset-x-0 top-[3.35rem] z-[1000] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="border-b border-border px-3 py-2 font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">Map results · choose one to confirm</div>
            {suggestions.map((location) => (
              <button
                key={`${location.countryCode}-${location.city}`}
                type="button"
                className="group flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(location)}
              >
                <span>
                  <span className="block max-w-[calc(100vw-8rem)] truncate text-xs font-bold">{location.city}</span>
                  <span className="block text-[10px] text-muted-foreground">{location.countryName} · real map location</span>
                </span>
                <Check size={14} className="text-primary opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
              </button>
            ))}
            <div className="border-t border-border px-3 py-1.5 text-[9px] text-muted-foreground">Powered by OpenStreetMap</div>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px]">
        <span className="min-w-0 truncate text-muted-foreground">
          {value ? `Location confirmed · coordinates saved` : searchState === "loading" ? "Looking across the map…" : searchState === "error" ? "Map search unavailable · use GPS or try again" : query.trim() ? "Choose a map result to confirm this location" : "Search a real place, landmark, or road area"}
        </span>
        {value && (
          <button type="button" onClick={() => setMapOpen(true)} className="shrink-0 font-bold text-primary hover:underline">
            Refine pin
          </button>
        )}
      </div>

      {mapOpen && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-foreground/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={`${label.replace(/\s+/g, "-").toLowerCase()}-map-title`}>
          <div className="w-full max-w-2xl overflow-hidden rounded-t-[1.5rem] border border-border bg-card shadow-2xl sm:rounded-[1.5rem]">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                  <MapPinned size={19} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-muted-foreground">Location precision</p>
                  <h3 id={`${label.replace(/\s+/g, "-").toLowerCase()}-map-title`} className="mt-1 truncate font-display text-xl font-semibold">Pin the {label.toLowerCase()}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Tap the map or use your phone’s location. We’ll keep the nearest area name for matching.</p>
                </div>
              </div>
              <button type="button" onClick={() => setMapOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close map">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold">{value?.city || mapLocation.city}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{value ? `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}` : "No exact point selected yet"}</p>
                </div>
                <button type="button" onClick={useCurrentLocation} disabled={gpsState === "loading"} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/25 px-3 text-[10px] font-bold text-primary transition hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60">
                  <Crosshair size={14} aria-hidden="true" />
                  {gpsState === "loading" ? "Locating…" : "Use my GPS"}
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-border shadow-inner">
                <MapContainer center={center} zoom={7} scrollWheelZoom className="h-[min(52vh,360px)] w-full" zoomControl attributionControl>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapClick onPick={pin} />
                  <RecenterMap center={center} />
                  {value && <CircleMarker center={[value.latitude, value.longitude]} radius={9} pathOptions={{ color: "#bc4612", fillColor: "#f26522", fillOpacity: 1, weight: 3 }} />}
                </MapContainer>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] text-muted-foreground">Click anywhere to move the pin.</p>
                {gpsState === "error" && <p className="text-right text-[10px] font-semibold text-destructive">GPS unavailable — tap the map instead.</p>}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
              <p className="min-w-0 text-[10px] text-muted-foreground">{value ? "This exact point will be saved with your booking." : "Select a point to continue."}</p>
              <button type="button" onClick={() => setMapOpen(false)} disabled={!value} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-[10px] font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45">
                <Check size={14} aria-hidden="true" /> Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}