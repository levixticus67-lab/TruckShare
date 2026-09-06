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