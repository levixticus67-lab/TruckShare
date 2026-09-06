import type { RouteStop } from "@/components/RouteMap";

export type LocationPoint = {
  city: string;
  countryCode: string;
  countryName: string;
  latitude: number;
  longitude: number;
};

export const EAC_LOCATIONS: LocationPoint[] = [
  { city: "Bujumbura", countryCode: "BI", countryName: "Burundi", latitude: -3.3614, longitude: 29.3599 },
  { city: "Lubumbashi", countryCode: "CD", countryName: "DRC", latitude: -11.6876, longitude: 27.5026 },
  { city: "Nairobi", countryCode: "KE", countryName: "Kenya", latitude: -1.2921, longitude: 36.8219 },
  { city: "Kigali", countryCode: "RW", countryName: "Rwanda", latitude: -1.9441, longitude: 30.0619 },
  { city: "Mogadishu", countryCode: "SO", countryName: "Somalia", latitude: 2.0469, longitude: 45.3182 },
  { city: "Juba", countryCode: "SS", countryName: "South Sudan", latitude: 4.8594, longitude: 31.5713 },
  { city: "Dar es Salaam", countryCode: "TZ", countryName: "Tanzania", latitude: -6.7924, longitude: 39.2083 },
  { city: "Gulu", countryCode: "UG", countryName: "Uganda", latitude: 2.7746, longitude: 32.299 },
  { city: "Kampala", countryCode: "UG", countryName: "Uganda", latitude: 0.3476, longitude: 32.5825 },
  { city: "Malaba", countryCode: "UG", countryName: "Uganda", latitude: 0.635, longitude: 34.255 },
  { city: "Mbarara", countryCode: "UG", countryName: "Uganda", latitude: -0.6072, longitude: 30.6545 },
  { city: "Mbale", countryCode: "UG", countryName: "Uganda", latitude: 1.0806, longitude: 34.175 },
];

export function findLocation(city: string, countryCode?: string) {
  const normalized = city.trim().toLowerCase();
  return EAC_LOCATIONS.find((location) =>
    location.city.toLowerCase() === normalized && (!countryCode || location.countryCode === countryCode),
  );
}

export function routeStopsFor(origin: string, originCountry: string, destination: string, destinationCountry: string): RouteStop[] {
  const start = findLocation(origin, originCountry);
  const end = findLocation(destination, destinationCountry);
  if (!start || !end) return [];
  return [
    {
      label: "Origin",
      city: start.city,
      country: start.countryName,
      position: [start.latitude, start.longitude],
      status: "complete",
    },
    {
      label: "Destination",
      city: end.city,
      country: end.countryName,
      position: [end.latitude, end.longitude],
      status: "upcoming",
    },
  ];
}
