import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { latLngBounds, type LatLngExpression } from "leaflet";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { LocateFixed, X } from "lucide-react";

export type RouteStop = {
  label: string;
  city: string;
  country: string;
  position: [number, number];
  status: "complete" | "active" | "upcoming";
};

type RouteMapProps = {
  stops: RouteStop[];
  className?: string;
  height?: string;
  routing?: boolean;
};

type MapPoint = [number, number];

const countryCenters: Record<string, MapPoint> = {
  BI: [-3.3731, 29.9189],
  CD: [-1.68, 29.23],
  KE: [-1.2921, 36.8219],
  RW: [-1.9441, 30.0619],
  SO: [2.0469, 45.3182],
  SS: [4.8594, 31.5713],
  TZ: [-6.7924, 39.2083],
  UG: [0.3476, 32.5825],
};

const countryNames: Record<string, string> = {
  BI: "Burundi",
  CD: "DRC",
  KE: "Kenya",
  RW: "Rwanda",
  SO: "Somalia",
  SS: "South Sudan",
  TZ: "Tanzania",
  UG: "Uganda",
};

const stopStyles: Record<RouteStop["status"], { fillColor: string; color: string }> = {
  complete: { fillColor: "#304a7a", color: "#1b2d55" },
  active: { fillColor: "#f26522", color: "#bc4612" },
  upcoming: { fillColor: "#9aa4b5", color: "#68738a" },
};

function FitRoute({ positions, focusPoint }: { positions: MapPoint[]; focusPoint?: MapPoint }) {
  const map = useMap();
  const bounds = useMemo(() => latLngBounds(positions), [positions]);

  useEffect(() => {
    if (focusPoint) {
      const nearby = [...positions]
        .sort((first, second) => {
          const firstDistance = Math.abs(Number(first[0]) - focusPoint[0]) + Math.abs(Number(first[1]) - focusPoint[1]);
          const secondDistance = Math.abs(Number(second[0]) - focusPoint[0]) + Math.abs(Number(second[1]) - focusPoint[1]);
          return firstDistance - secondDistance;
        })
        .slice(0, 5);
      map.fitBounds(latLngBounds([focusPoint, ...nearby]), { padding: [34, 34], maxZoom: 7 });
    } else if (positions.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28] });
    } else if (positions.length === 1) {
      map.setView(positions[0], 8);
    }
  }, [bounds, focusPoint, map, positions]);

  return null;
}

type MapShellProps = {
  children: ReactNode;
  height?: string;
  className?: string;
  label?: string;
  onLocate?: () => void;
  locating?: boolean;
};

export function MapShell({ children, height = "360px", className = "", label = "Interactive map", onLocate, locating = false }: MapShellProps) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  const openFullscreen = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, .leaflet-control, a")) return;
    setFullscreen(true);
  };

  const shell = (
    <div className={`map-shell ${fullscreen ? "is-fullscreen" : ""} ${className}`} style={{ height }} onClick={openFullscreen}>
      <div className="map-shell-toolbar">
        <div className="map-shell-label">{label}</div>
        <div className="map-shell-actions">
          {onLocate && <button type="button" onClick={onLocate} disabled={locating} aria-label="Center map near my location" title="Center near me"><LocateFixed size={15} className={locating ? "animate-pulse" : ""} /></button>}
          {fullscreen && <button type="button" onClick={() => setFullscreen(false)} aria-label="Close full-screen map" title="Close map"><X size={17} /></button>}
        </div>
      </div>
      {children}
      {!fullscreen && <div className="map-shell-expand-hint">Tap map to expand</div>}
    </div>
  );

  return fullscreen && typeof document !== "undefined" ? createPortal(shell, document.body) : shell;
}

export function RouteMap({ stops, className = "", height = "360px", routing = false }: RouteMapProps) {
  const positions = useMemo<MapPoint[]>(() => stops.map((stop) => stop.position), [stops]);
  const [routePath, setRoutePath] = useState<LatLngExpression[]>(positions);
  const [locating, setLocating] = useState(false);
  const [userPosition, setUserPosition] = useState<MapPoint | null>(null);
  const [focusPoint, setFocusPoint] = useState<MapPoint | undefined>();

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point: MapPoint = [coords.latitude, coords.longitude];
        setUserPosition(point);
        setFocusPoint(point);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    setRoutePath(positions);
    if (!routing || positions.length < 2) return;
    const controller = new AbortController();
    const coordinates = stops.map((stop) => `${stop.position[1]},${stop.position[0]}`).join(";");
    fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }> }> : Promise.reject(new Error("Route service unavailable")))
      .then((data) => {
        const geometry = data.routes?.[0]?.geometry?.coordinates;
        if (geometry?.length) setRoutePath(geometry.map(([longitude, latitude]) => [latitude, longitude]));
      })
      .catch(() => {
        // The straight corridor remains visible when the free routing service is unavailable.
      });
    return () => controller.abort();
  }, [positions, routing, stops]);

  return (
    <MapShell height={height} className={className} label="Route map" onLocate={requestLocation} locating={locating}>
      <MapContainer
        center={positions[0] || [0.3476, 32.5825]}
        zoom={7}
        scrollWheelZoom
        className="route-map h-full w-full"
        zoomControl
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {routePath.length > 1 && (
          <Polyline
            positions={routePath}
            pathOptions={{ color: "#d7984e", weight: 5, opacity: 0.9, dashArray: "10 9" }}
          />
        )}
        {stops.map((stop) => {
          const style = stopStyles[stop.status];
          return (
            <CircleMarker
              key={`${stop.label}-${stop.position.join("-")}`}
              center={stop.position}
              radius={stop.status === "active" ? 10 : 8}
              pathOptions={{
                color: style.color,
                fillColor: style.fillColor,
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <strong>{stop.label}</strong>
                <br />
                {stop.city}, {stop.country}
              </Tooltip>
            </CircleMarker>
          );
        })}
        {userPosition && <CircleMarker center={userPosition} radius={7} pathOptions={{ color: "#ffffff", fillColor: "#1683d8", fillOpacity: 1, weight: 3 }}><Tooltip direction="top" offset={[0, -6]}>Your location</Tooltip></CircleMarker>}
        <FitRoute positions={positions} focusPoint={focusPoint} />
      </MapContainer>
    </MapShell>
  );
}

const networkStops: RouteStop[] = [
  { label: "Kampala", city: "Kampala", country: "Uganda", position: [0.3476, 32.5825], status: "active" },
  { label: "Malaba", city: "Malaba", country: "Uganda", position: [0.635, 34.255], status: "upcoming" },
  { label: "Mbale", city: "Mbale", country: "Uganda", position: [1.0806, 34.175], status: "upcoming" },
  { label: "Mbarara", city: "Mbarara", country: "Uganda", position: [-0.6072, 30.6545], status: "upcoming" },
  { label: "Gulu", city: "Gulu", country: "Uganda", position: [2.7746, 32.299], status: "upcoming" },
  { label: "Nairobi", city: "Nairobi", country: "Kenya", position: [-1.2921, 36.8219], status: "upcoming" },
  { label: "Kigali", city: "Kigali", country: "Rwanda", position: [-1.9441, 30.0619], status: "upcoming" },
  { label: "Dar es Salaam", city: "Dar es Salaam", country: "Tanzania", position: [-6.7924, 39.2083], status: "upcoming" },
  { label: "Juba", city: "Juba", country: "South Sudan", position: [4.8594, 31.5713], status: "upcoming" },
];

const networkRoutes: [number, number][][] = [
  [networkStops[0].position, networkStops[1].position],
  [networkStops[0].position, networkStops[2].position],
  [networkStops[0].position, networkStops[3].position],
  [networkStops[0].position, networkStops[4].position],
  [networkStops[0].position, networkStops[5].position],
  [networkStops[0].position, networkStops[6].position],
  [networkStops[0].position, networkStops[7].position],
  [networkStops[0].position, networkStops[8].position],
];

function browserCountry() {
  if (typeof navigator === "undefined") return "UG";
  const localeCountry = navigator.language.split("-")[1]?.toUpperCase();
  return localeCountry && countryCenters[localeCountry] ? localeCountry : "UG";
}

export function EacNetworkMap({ height = "clamp(320px, 52dvh, 440px)" }: { height?: string }) {
  const positions = useMemo<MapPoint[]>(() => networkStops.map((stop) => stop.position), []);
  const [locating, setLocating] = useState(false);
  const [userPosition, setUserPosition] = useState<MapPoint | null>(null);
  const [focusPoint, setFocusPoint] = useState<MapPoint>(() => countryCenters[browserCountry()]);
  const [focusLabel, setFocusLabel] = useState(() => `Near ${countryNames[browserCountry()]}`);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point: MapPoint = [coords.latitude, coords.longitude];
        setUserPosition(point);
        setFocusPoint(point);
        setFocusLabel("Near you");
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return (
    <MapShell height={height} label={`Near ${focusLabel.replace(/^Near /, "")}`} onLocate={requestLocation} locating={locating}>
      <MapContainer center={focusPoint} zoom={5} scrollWheelZoom className="route-map h-full w-full" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {networkRoutes.map((route, index) => (
          <Polyline key={`network-route-${index}`} positions={route} pathOptions={{ color: "#f26522", weight: 3, opacity: 0.78 }} />
        ))}
        {networkStops.map((stop) => (
          <CircleMarker
            key={stop.label}
            center={stop.position}
            radius={stop.label === "Kampala" ? 9 : 6}
            pathOptions={{ color: stop.label === "Kampala" ? "#bc4612" : "#1b2d55", fillColor: stop.label === "Kampala" ? "#f26522" : "#304a7a", fillOpacity: 1, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>{stop.label}</Tooltip>
          </CircleMarker>
        ))}
        {userPosition && <CircleMarker center={userPosition} radius={7} pathOptions={{ color: "#ffffff", fillColor: "#1683d8", fillOpacity: 1, weight: 3 }}><Tooltip direction="top" offset={[0, -6]}>Your location</Tooltip></CircleMarker>}
        <FitRoute positions={positions} focusPoint={focusPoint} />
      </MapContainer>
    </MapShell>
  );
}