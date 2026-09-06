import { useEffect, useMemo } from "react";
import { latLngBounds, type LatLngExpression } from "leaflet";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";

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
};

const stopStyles: Record<RouteStop["status"], { fillColor: string; color: string }> = {
  complete: { fillColor: "#32775f", color: "#236048" },
  active: { fillColor: "#d7984e", color: "#a96824" },
  upcoming: { fillColor: "#8f9b99", color: "#687572" },
};

function FitRoute({ positions }: { positions: LatLngExpression[] }) {
  const map = useMap();
  const bounds = useMemo(() => latLngBounds(positions), [positions]);

  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28] });
    } else if (positions.length === 1) {
      map.setView(positions[0], 8);
    }
  }, [bounds, map, positions]);

  return null;
}

export function RouteMap({ stops, className = "", height = "360px" }: RouteMapProps) {
  const positions = useMemo<LatLngExpression[]>(() => stops.map((stop) => stop.position), [stops]);

  return (
    <div className={`route-map overflow-hidden rounded-lg border border-border ${className}`} style={{ height }}>
      <MapContainer
        center={positions[0] || [0.3476, 32.5825]}
        zoom={7}
        scrollWheelZoom
        className="h-full w-full"
        zoomControl
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {positions.length > 1 && (
          <Polyline
            positions={positions}
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
        <FitRoute positions={positions} />
      </MapContainer>
    </div>
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

export function EacNetworkMap({ height = "390px" }: { height?: string }) {
  const positions = useMemo<LatLngExpression[]>(() => networkStops.map((stop) => stop.position), []);
  const bounds = useMemo(() => latLngBounds(positions), [positions]);

  return (
    <div className="route-map overflow-hidden rounded-lg border border-border" style={{ height }}>
      <MapContainer center={[0.3476, 32.5825]} zoom={5} scrollWheelZoom className="h-full w-full" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {networkRoutes.map((route, index) => (
          <Polyline key={`network-route-${index}`} positions={route} pathOptions={{ color: "#d7984e", weight: 3, opacity: 0.72 }} />
        ))}
        {networkStops.map((stop) => (
          <CircleMarker
            key={stop.label}
            center={stop.position}
            radius={stop.label === "Kampala" ? 9 : 6}
            pathOptions={{ color: stop.label === "Kampala" ? "#a96824" : "#32775f", fillColor: stop.label === "Kampala" ? "#d7984e" : "#7dbb9b", fillOpacity: 1, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>{stop.label}</Tooltip>
          </CircleMarker>
        ))}
        <FitRoute positions={positions} />
      </MapContainer>
    </div>
  );
}