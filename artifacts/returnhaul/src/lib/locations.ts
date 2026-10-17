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

const countryAliases: Record<string, string> = {
  "DEMOCRATIC REPUBLIC OF CONGO": "CD",
  "DEMOCRATIC REPUBLIC OF THE CONGO": "CD",
  "DR CONGO": "CD",
};

const fallbackCities: Record<string, string> = {
  BI: "Bujumbura",
  CD: "Lubumbashi",
  KE: "Nairobi",
  RW: "Kigali",
  SO: "Mogadishu",
  SS: "Juba",
  TZ: "Dar es Salaam",
  UG: "Kampala",
};

function normalizedCountryCode(value?: string) {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toUpperCase();
  const directCode = EAC_LOCATIONS.find((location) => location.countryCode === normalized)?.countryCode;
  if (directCode) return directCode;
  return EAC_LOCATIONS.find((location) => location.countryName.toUpperCase() === normalized)?.countryCode
    || countryAliases[normalized];
}

function countryFromLabel(value: string) {
  const suffix = value.trim().split(/[,|;]/).at(-1)?.trim() || value.trim().split(/\s+/).at(-1) || "";
  return normalizedCountryCode(suffix);
}

function normalizedCity(value: string) {
  return value.trim()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+(?:Burundi|DRC|DR Congo|Democratic Republic of(?: the)? Congo|Kenya|Rwanda|Somalia|South Sudan|Tanzania|Uganda|BI|CD|KE|RW|SO|SS|TZ|UG)\s*$/i, "")
    .split(/\s*[|,;]\s*/)[0]
    .trim()
    .toLowerCase();
}

export function findLocation(city: string, countryCode?: string) {
  const normalized = normalizedCity(city);
  const resolvedCountry = normalizedCountryCode(countryCode) || countryFromLabel(city);
  return EAC_LOCATIONS.find((location) =>
    location.city.toLowerCase() === normalized && (!resolvedCountry || location.countryCode === resolvedCountry),
  );
}

function routeLocation(city: string, countryCode?: string) {
  const exact = findLocation(city, countryCode);
  if (exact) return { location: exact, label: exact.city };
  const resolvedCountry = normalizedCountryCode(countryCode) || countryFromLabel(city);
  const fallbackCity = resolvedCountry ? fallbackCities[resolvedCountry] : undefined;
  const fallback = fallbackCity
    ? EAC_LOCATIONS.find((location) => location.countryCode === resolvedCountry && location.city === fallbackCity)
    : undefined;
  return fallback ? { location: fallback, label: `Near ${fallback.city}` } : undefined;
}

export function corridorEndpoints(corridor: string): [string, string] | undefined {
  const endpoints = corridor.split(/\s*(?:→|->|—|–|\bto\b)\s*/i).map((part) => part.trim()).filter(Boolean);
  return endpoints.length >= 2 ? [endpoints[0], endpoints[1]] : undefined;
}

export function routeStopsFor(origin: string, originCountry: string, destination: string, destinationCountry: string): RouteStop[] {
  const start = routeLocation(origin, originCountry);
  const end = routeLocation(destination, destinationCountry);
  if (!start || !end) return [];
  return [
    {
      label: "Origin",
      city: start.label,
      country: start.location.countryName,
      position: [start.location.latitude, start.location.longitude],
      status: "complete",
    },
    {
      label: "Destination",
      city: end.label,
      country: end.location.countryName,
      position: [end.location.latitude, end.location.longitude],
      status: "upcoming",
    },
  ];
}
