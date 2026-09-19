import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, databaseConfigured, runtimeStateTable } from "@workspace/db";
import {
  CreateBookingBody,
  CreateDocumentBody,
  CreateFreightBody,
  CreateMessageBody,
  CreateTripBody,
  UpdateTripBody,
  UpdateTripParams,
  UpdateTripResponse,
  UpdateFreightBody,
  UpdateFreightParams,
  UpdateFreightResponse,
  ListFreightQueryParams,
  ListFreightResponse,
  ListMatchesQueryParams,
  ListMatchesResponse,
  ListBookingsResponse,
  ListDocumentsResponse,
  ListMessagesResponse,
  ListTripsQueryParams,
  ListTripsResponse,
  GetDashboardResponse,
  GetFinanceOverviewResponse,
  GetBookingFinanceResponse,
  ReleaseBookingPayoutBody,
  UpdateBookingStatusBody,
  UpdateBookingStatusParams,
} from "@workspace/api-zod";
import {
  getBookingFinance,
  getFinanceOverview,
  hydrateFinanceState,
  markReleaseEligible,
  recordPayment,
  releasePayout,
  ensureBookingFinance,
  serializeFinanceState,
} from "../lib/finance";

type Trip = {
  id: string;
  ownerUserId?: string;
  carrier: string;
  carrierRating: number;
  origin: string;
  originCountry: CountryCode;
  originLocation?: LocationPoint;
  destination: string;
  destinationCountry: CountryCode;
  destinationLocation?: LocationPoint;
  corridor: string;
  departureDate: string;
  departureTime: string;
  vehicleType: string;
  capacityTons: number;
  capacityM3: number;
  price: number;
  currency: CurrencyCode;
  priceType: "Fixed" | "Per Ton";
  status: string;
};

type LocationPoint = {
  city: string;
  countryCode: CountryCode;
  countryName: string;
  latitude: number;
  longitude: number;
};

type Freight = {
  id: string;
  ownerUserId?: string;
  shipper: string;
  pickup: string;
  pickupCountry: CountryCode;
  pickupLocation?: LocationPoint;
  dropoff: string;
  dropoffCountry: CountryCode;
  dropoffLocation?: LocationPoint;
  corridor: string;
  description: string;
  cargoType: string;
  weightTons: number;
  volumeM3: number;
  dimensions: string;
  pickupDate: string;
  price: number;
  currency: CurrencyCode;
  status: "Pending" | "Matched" | "In-Transit" | "Delivered";
};

type Booking = {
  id: string;
  tripId: string;
  freightId: string;
  corridor: string;
  originCountry: CountryCode;
  destinationCountry: CountryCode;
  amount: number;
  currency: CurrencyCode;
  commissionAmount: number;
  carrierPayout: number;
  paymentNetwork?: PaymentNetwork;
  paymentStatus: "Unpaid" | "Paid";
  escrowStatus: "Pending" | "Held" | "Released";
  status: string;
  bookedAt: string;
  podStatus: "Not requested" | "OTP sent" | "Delivered";
  podOtp: string;
  deliveryPhoto?: string;
};

type PaymentNetwork = "MTN MoMo" | "Airtel Money" | "Bank Transfer";
type PaymentStatus = "Initiated" | "Held" | "Released" | "Failed";
type Payment = {
  id: string;
  bookingId: string;
  network: PaymentNetwork;
  phone: string;
  payerCountry: CountryCode;
  payeeCountry: CountryCode;
  amount: number;
  currency: CurrencyCode;
  settlementAmount: number;
  settlementCurrency: CurrencyCode;
  exchangeRate: number;
  commissionAmount: number;
  carrierPayout: number;
  fee: number;
  reference: string;
  status: PaymentStatus;
  createdAt: string;
};

type BorderMilestoneStatus = "Planned" | "Documents Pending" | "Submitted" | "Cleared" | "Held" | "Crossed";
type BorderMilestone = {
  id: string;
  bookingId: string;
  sequence: number;
  checkpoint: string;
  country: CountryCode;
  border: string;
  requiredDocuments: string[];
  status: BorderMilestoneStatus;
  completedAt?: string;
};

type Verification = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  nin: string;
  licenseNumber: string;
  logbookNumber: string;
  logbookPhotoName?: string;
  status: "Pending" | "Verified" | "Rejected";
  submittedAt: string;
};

type BrokerRequestKind = "Load" | "Trip";
type BrokerRequestStatus = "New" | "Needs information" | "Approved" | "Matching" | "Offer sent" | "Confirmed" | "Assigned" | "In progress" | "On hold" | "Closed" | "Rejected";
type BrokerPriority = "Low" | "Normal" | "High" | "Urgent";
type BrokerRequest = {
  id: string;
  ownerUserId?: string;
  kind: BrokerRequestKind;
  entityId: string;
  title: string;
  counterpart: string;
  corridor: string;
  date: string;
  priority: BrokerPriority;
  status: BrokerRequestStatus;
  assignedTo?: string;
  proposedMatchId?: string;
  bookingId?: string;
  notes: string[];
  createdAt: string;
  updatedAt: string;
};
type AdminActivity = {
  id: string;
  requestId?: string;
  label: string;
  detail: string;
  actor: string;
  createdAt: string;
};

type User = {
  id: string;
  name: string;
  googleId?: string;
  phone?: string;
  phoneVerifiedAt?: string;
  phoneChangedAt?: string;
  email?: string;
  emailVerifiedAt?: string;
  country: CountryCode;
  role: "Carrier" | "Shipper" | "Admin";
  roles?: Array<"Carrier" | "Shipper">;
  verified: boolean;
  passwordHash?: string;
  termsAcceptedAt?: string;
  termsVersion?: string;
};

type CountryCode = "BI" | "CD" | "KE" | "RW" | "SO" | "SS" | "TZ" | "UG";
type CurrencyCode = "BIF" | "CDF" | "KES" | "RWF" | "SOS" | "SSP" | "TZS" | "UGX";

const eacCountries = [
  { code: "BI", name: "Burundi", currency: "BIF" },
  { code: "CD", name: "Democratic Republic of the Congo", currency: "CDF" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "RW", name: "Rwanda", currency: "RWF" },
  { code: "SO", name: "Somalia", currency: "SOS" },
  { code: "SS", name: "South Sudan", currency: "SSP" },
  { code: "TZ", name: "Tanzania", currency: "TZS" },
  { code: "UG", name: "Uganda", currency: "UGX" },
] satisfies Array<{ code: CountryCode; name: string; currency: CurrencyCode }>;

const dialingCodes: Record<CountryCode, string> = {
  BI: "+257",
  CD: "+243",
  KE: "+254",
  RW: "+250",
  SO: "+252",
  SS: "+211",
  TZ: "+255",
  UG: "+256",
};

const eacCorridors = [
  { origin: "Kampala", originCountry: "UG", destination: "Nairobi", destinationCountry: "KE", border: "Malaba / Busia" },
  { origin: "Kampala", originCountry: "UG", destination: "Kigali", destinationCountry: "RW", border: "Katuna / Gatuna" },
  { origin: "Kampala", originCountry: "UG", destination: "Dar es Salaam", destinationCountry: "TZ", border: "Mutukula" },
  { origin: "Kampala", originCountry: "UG", destination: "Juba", destinationCountry: "SS", border: "Elegu / Nimule" },
] satisfies Array<{ origin: string; originCountry: CountryCode; destination: string; destinationCountry: CountryCode; border: string }>;

const indicativeFxToUgx: Record<CurrencyCode, number> = {
  UGX: 1,
  KES: 29.5,
  TZS: 0.29,
  RWF: 2.8,
  BIF: 1.35,
  CDF: 0.0013,
  SSP: 0.022,
  SOS: 0.058,
};

function countryCode(value: unknown, fallback: CountryCode = "UG"): CountryCode {
  const code = text(value).toUpperCase();
  return eacCountries.some((country) => country.code === code) ? code as CountryCode : fallback;
}

function optionalCountryCode(value: unknown): CountryCode | undefined {
  const code = text(value).toUpperCase();
  return eacCountries.some((country) => country.code === code) ? code as CountryCode : undefined;
}

function currencyCode(value: unknown, fallback: CurrencyCode = "UGX"): CurrencyCode {
  const code = text(value).toUpperCase();
  return eacCountries.some((country) => country.currency === code) ? code as CurrencyCode : fallback;
}

function currencyForCountry(country: CountryCode): CurrencyCode {
  return eacCountries.find((item) => item.code === country)?.currency || "UGX";
}

function phoneCountry(value: string) {
  const normalized = value.replace(/\s+/g, "");
  return (Object.entries(dialingCodes).find(([, prefix]) => normalized.startsWith(prefix))?.[0] || undefined) as CountryCode | undefined;
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "");
}

function normalizeEmail(value: string) {
  return text(value).toLowerCase();
}

function requestedRoles(value: unknown): Array<"Carrier" | "Shipper"> {
  if (!Array.isArray(value)) return [];
  return value.filter((role): role is "Carrier" | "Shipper" => role === "Carrier" || role === "Shipper");
}

function exchangeRate(from: CurrencyCode, to: CurrencyCode) {
  return indicativeFxToUgx[from] / indicativeFxToUgx[to];
}

function convertedAmount(amount: number, from: CurrencyCode, to: CurrencyCode) {
  return Math.round(amount * exchangeRate(from, to));
}

const bookingStatusTransitions: Record<string, string[]> = {
  "En Route to Pickup": ["In Transit"],
  "In Transit": ["At Border"],
  "At Border": ["In Transit", "Delivered"],
  Delivered: [],
};

function releaseHeldPayment(bookingId: string) {
  for (const payment of payments) {
    if (payment.bookingId === bookingId && payment.status === "Held") payment.status = "Released";
  }
}

const routes = [
  { origin: "Kampala", originCountry: "UG", destination: "Mbale", destinationCountry: "UG" },
  { origin: "Kampala", originCountry: "UG", destination: "Mbarara", destinationCountry: "UG" },
  { origin: "Kampala", originCountry: "UG", destination: "Gulu", destinationCountry: "UG" },
  { origin: "Malaba", originCountry: "UG", destination: "Kampala", destinationCountry: "UG" },
];

const locationPoints: LocationPoint[] = [
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

function locationPoint(city: string, countryCode: CountryCode): LocationPoint | undefined {
  const normalized = city.trim().toLowerCase();
  return locationPoints.find((point) => point.city.toLowerCase() === normalized && point.countryCode === countryCode);
}

function submittedLocation(value: unknown, fallbackCity: string, countryCode: CountryCode): LocationPoint | undefined {
  if (!value || typeof value !== "object") return locationPoint(fallbackCity, countryCode);
  const candidate = value as Partial<LocationPoint>;
  if (
    typeof candidate.city !== "string" ||
    typeof candidate.countryName !== "string" ||
    typeof candidate.latitude !== "number" ||
    typeof candidate.longitude !== "number" ||
    candidate.countryCode !== countryCode ||
    !Number.isFinite(candidate.latitude) ||
    !Number.isFinite(candidate.longitude) ||
    candidate.latitude < -90 ||
    candidate.latitude > 90 ||
    candidate.longitude < -180 ||
    candidate.longitude > 180
  ) return locationPoint(fallbackCity, countryCode);
  return {
    city: candidate.city.trim() || fallbackCity,
    countryCode,
    countryName: candidate.countryName,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
  };
}

function tripWithLocations(trip: Trip) {
  return {
    ...trip,
    originLocation: trip.originLocation || locationPoint(trip.origin, trip.originCountry),
    destinationLocation: trip.destinationLocation || locationPoint(trip.destination, trip.destinationCountry),
  };
}

function freightWithLocations(load: Freight) {
  return {
    ...load,
    pickupLocation: load.pickupLocation || locationPoint(load.pickup, load.pickupCountry),
    dropoffLocation: load.dropoffLocation || locationPoint(load.dropoff, load.dropoffCountry),
  };
}

const trips: Trip[] = [
  { id: "trip-1", carrier: "Moses K.", carrierRating: 4.9, origin: "Kampala", originCountry: "UG", destination: "Mbale", destinationCountry: "UG", corridor: "Kampala → Mbale", departureDate: "2026-08-28", departureTime: "07:30", vehicleType: "Fuso", capacityTons: 8, capacityM3: 42, price: 680000, currency: "UGX", priceType: "Fixed", status: "Available" },
  { id: "trip-2", carrier: "Amina Logistics", carrierRating: 4.8, origin: "Kampala", originCountry: "UG", destination: "Mbarara", destinationCountry: "UG", corridor: "Kampala → Mbarara", departureDate: "2026-08-30", departureTime: "06:00", vehicleType: "Canter", capacityTons: 6, capacityM3: 30, price: 520000, currency: "UGX", priceType: "Per Ton", status: "Available" },
  { id: "trip-3", carrier: "Thabo Transport", carrierRating: 4.7, origin: "Malaba", originCountry: "UG", destination: "Kampala", destinationCountry: "UG", corridor: "Malaba → Kampala", departureDate: "2026-09-02", departureTime: "09:15", vehicleType: "Trailer", capacityTons: 18, capacityM3: 70, price: 1560000, currency: "UGX", priceType: "Fixed", status: "Booked" },
  { id: "trip-4", carrier: "Gulu North Haulage", carrierRating: 4.6, origin: "Kampala", originCountry: "UG", destination: "Gulu", destinationCountry: "UG", corridor: "Kampala → Gulu", departureDate: "2026-09-04", departureTime: "05:45", vehicleType: "Flatbed", capacityTons: 14, capacityM3: 62, price: 980000, currency: "UGX", priceType: "Fixed", status: "Available" },
];

const freight: Freight[] = [
  { id: "load-1", shipper: "Kampala Grain Co.", pickup: "Kampala", pickupCountry: "UG", dropoff: "Mbale", dropoffCountry: "UG", corridor: "Kampala → Mbale", description: "Bagged grain and packaged food", cargoType: "Food & agriculture", weightTons: 4.5, volumeM3: 18, dimensions: "12 pallets", pickupDate: "2026-08-28", price: 540000, currency: "UGX", status: "Pending" },
  { id: "load-2", shipper: "Mara Pharma", pickup: "Kampala", pickupCountry: "UG", dropoff: "Mbarara", dropoffCountry: "UG", corridor: "Kampala → Mbarara", description: "Temperature-sensitive pharmaceuticals", cargoType: "Pharmaceuticals", weightTons: 3, volumeM3: 12, dimensions: "8 crates", pickupDate: "2026-08-30", price: 420000, currency: "UGX", status: "Matched" },
  { id: "load-3", shipper: "Eastline Hardware", pickup: "Malaba", pickupCountry: "UG", dropoff: "Kampala", dropoffCountry: "UG", corridor: "Malaba → Kampala", description: "Hardware and steel components", cargoType: "Construction", weightTons: 14, volumeM3: 48, dimensions: "Oversize", pickupDate: "2026-09-02", price: 1320000, currency: "UGX", status: "In-Transit" },
  { id: "load-4", shipper: "Northern Fresh", pickup: "Kampala", pickupCountry: "UG", dropoff: "Gulu", dropoffCountry: "UG", corridor: "Kampala → Gulu", description: "Fresh produce and cold-chain cartons", cargoType: "Food & agriculture", weightTons: 9, volumeM3: 40, dimensions: "20 pallets", pickupDate: "2026-09-04", price: 860000, currency: "UGX", status: "Pending" },
];

const bookings: Booking[] = [
  { id: "booking-1", tripId: "trip-3", freightId: "load-3", corridor: "Malaba → Kampala", originCountry: "UG", destinationCountry: "UG", amount: 1320000, currency: "UGX", commissionAmount: 158400, carrierPayout: 1161600, paymentNetwork: "MTN MoMo", paymentStatus: "Paid", escrowStatus: "Held", status: "At Border", bookedAt: "2026-08-22", podStatus: "Not requested", podOtp: "4312" },
];

const payments: Payment[] = [
  { id: "payment-1", bookingId: "booking-1", network: "MTN MoMo", phone: "+256 700 000 000", payerCountry: "UG", payeeCountry: "UG", amount: 1320000, currency: "UGX", settlementAmount: 1320000, settlementCurrency: "UGX", exchangeRate: 1, commissionAmount: 158400, carrierPayout: 1161600, fee: 0, reference: "TS-DEMO-BOOKING-1", status: "Held", createdAt: "2026-08-22" },
];

const borderMilestones: BorderMilestone[] = [
  { id: "milestone-1", bookingId: "booking-1", sequence: 1, checkpoint: "Malaba border arrival", country: "UG", border: "Malaba", requiredDocuments: ["Consignment note", "Customs form"], status: "Documents Pending" },
  { id: "milestone-2", bookingId: "booking-1", sequence: 2, checkpoint: "Customs review", country: "UG", border: "Malaba", requiredDocuments: ["Customs form"], status: "Planned" },
  { id: "milestone-3", bookingId: "booking-1", sequence: 3, checkpoint: "Border clearance", country: "UG", border: "Malaba", requiredDocuments: [], status: "Planned" },
];

const messages = [
  { id: "msg-1", sender: "Kivu Foods", body: "Hi Moses, can you confirm the pickup window at our Kampala warehouse?", sentAt: "09:42", read: true },
  { id: "msg-2", sender: "You", body: "Confirmed. I’ll be there between 08:00 and 09:00 on Friday.", sentAt: "09:47", read: true },
  { id: "msg-3", sender: "Kivu Foods", body: "Perfect. The consignment note is ready in the documents hub.", sentAt: "09:49", read: false },
];

const documents = [
  { id: "doc-1", name: "Consignment note — Eastline Hardware", type: "Consignment note", uploadedBy: "Eastline Hardware", uploadedAt: "Aug 22, 2026", size: "1.8 MB", status: "Verified" },
  { id: "doc-2", name: "Customs clearance — Malaba", type: "Customs form", uploadedBy: "Thabo Transport", uploadedAt: "Aug 22, 2026", size: "842 KB", status: "Pending" },
];

const users: User[] = [
  { id: "user-1", name: "Moses K.", phone: "+256 700 111 222", country: "UG", role: "Carrier", verified: true },
  { id: "user-2", name: "Kampala Grain Co.", email: "dispatch@kampalagrain.ug", country: "UG", role: "Shipper", verified: true },
  { id: "user-3", name: "Thabo Transport", phone: "+256 781 333 444", country: "UG", role: "Carrier", verified: false },
];

const verifications: Verification[] = [
  { id: "verification-1", userId: "user-3", name: "Thabo Transport", phone: "+256 781 333 444", nin: "CM9000••••", licenseNumber: "DL-UG-20481", logbookNumber: "LB-77821", logbookPhotoName: "thabo-logbook.jpg", status: "Pending", submittedAt: "2026-08-26" },
];

const brokerRequests: BrokerRequest[] = [
  { id: "request-load-1", kind: "Load", entityId: "load-1", title: "Bagged grain and packaged food", counterpart: "Kampala Grain Co.", corridor: "Kampala → Mbale", date: "2026-08-28", priority: "High", status: "New", notes: ["Confirm loading window and final pallet count."], createdAt: "2026-08-26T08:42:00.000Z", updatedAt: "2026-08-26T08:42:00.000Z" },
  { id: "request-trip-1", kind: "Trip", entityId: "trip-1", title: "Fuso · 8 tons available", counterpart: "Moses K.", corridor: "Kampala → Mbale", date: "2026-08-28", priority: "Normal", status: "Matching", notes: ["Return capacity needs a compatible load."], createdAt: "2026-08-25T14:10:00.000Z", updatedAt: "2026-08-26T09:12:00.000Z" },
  { id: "request-load-2", kind: "Load", entityId: "load-2", title: "Temperature-sensitive pharmaceuticals", counterpart: "Mara Pharma", corridor: "Kampala → Mbarara", date: "2026-08-30", priority: "Urgent", status: "Offer sent", proposedMatchId: "trip-2", notes: ["Carrier must confirm cold-chain handling before assignment."], createdAt: "2026-08-25T11:30:00.000Z", updatedAt: "2026-08-26T10:04:00.000Z" },
  { id: "request-trip-2", kind: "Trip", entityId: "trip-2", title: "Canter · 6 tons available", counterpart: "Amina Logistics", corridor: "Kampala → Mbarara", date: "2026-08-30", priority: "High", status: "Offer sent", proposedMatchId: "load-2", notes: ["Awaiting carrier confirmation on temperature controls."], createdAt: "2026-08-25T12:05:00.000Z", updatedAt: "2026-08-26T10:04:00.000Z" },
  { id: "request-load-3", kind: "Load", entityId: "load-3", title: "Hardware and steel components", counterpart: "Eastline Hardware", corridor: "Malaba → Kampala", date: "2026-09-02", priority: "Normal", status: "In progress", notes: ["Border documents are being checked at Malaba."], createdAt: "2026-08-22T07:25:00.000Z", updatedAt: "2026-08-26T08:20:00.000Z" },
  { id: "request-trip-3", kind: "Trip", entityId: "trip-3", title: "Trailer · 18 tons available", counterpart: "Thabo Transport", corridor: "Malaba → Kampala", date: "2026-09-02", priority: "Normal", status: "Assigned", proposedMatchId: "load-3", notes: ["Assigned to Eastline Hardware booking."], createdAt: "2026-08-22T07:40:00.000Z", updatedAt: "2026-08-22T09:00:00.000Z" },
  { id: "request-load-4", kind: "Load", entityId: "load-4", title: "Fresh produce and cold-chain cartons", counterpart: "Northern Fresh", corridor: "Kampala → Gulu", date: "2026-09-04", priority: "High", status: "New", notes: ["Confirm cold-chain equipment and pickup window."], createdAt: "2026-08-26T07:05:00.000Z", updatedAt: "2026-08-26T07:05:00.000Z" },
  { id: "request-trip-4", kind: "Trip", entityId: "trip-4", title: "Flatbed · 14 tons available", counterpart: "Gulu North Haulage", corridor: "Kampala → Gulu", date: "2026-09-04", priority: "Normal", status: "Matching", notes: ["Available for a suitable northbound load."], createdAt: "2026-08-26T07:30:00.000Z", updatedAt: "2026-08-26T07:30:00.000Z" },
];

const adminActivities: AdminActivity[] = [
  { id: "activity-1", requestId: "request-load-2", label: "Offer sent", detail: "Mara Pharma load proposed to Amina Logistics.", actor: "Admin desk", createdAt: "2026-08-26T10:04:00.000Z" },
  { id: "activity-2", requestId: "request-load-3", label: "Border note added", detail: "Customs documents are being checked at Malaba.", actor: "Admin desk", createdAt: "2026-08-26T08:20:00.000Z" },
  { id: "activity-3", requestId: "request-load-1", label: "New submission", detail: "Kampala Grain Co. submitted a load request.", actor: "System", createdAt: "2026-08-26T08:42:00.000Z" },
];

const sessions = new Map<string, User>();
const otpRequestCooldowns = new Map<string, number>();
const googleStates = new Map<string, { mode: "login" | "signup"; roles: Array<"Carrier" | "Shipper">; termsAccepted: boolean; returnTo?: string; exp: number }>();
const googleExchangeCodes = new Map<string, { token: string; user: User; exp: number }>();
const TERMS_VERSION = "2026-09";
const OTP_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const PHONE_CHANGE_COOLDOWN_MS = 365 * 24 * 60 * 60 * 1000;
const id = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;
const nowDate = () => new Date().toISOString().slice(0, 10);
const number = (value: unknown) => typeof value === "number" ? value : Number(value);
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const stateKeys = ["trips", "freight", "bookings", "payments", "finance", "borderMilestones", "messages", "documents", "users", "verifications", "brokerRequests", "adminActivities"] as const;
type StateKey = (typeof stateKeys)[number];
let stateReady: Promise<void> | undefined;

function stateValue(key: StateKey) {
  if (key === "finance") return serializeFinanceState();
  return JSON.stringify({ trips, freight, bookings, payments, borderMilestones, messages, documents, users, verifications, brokerRequests, adminActivities }[key]);
}

function applyState(key: string, value: string) {
  if (key === "finance") {
    hydrateFinanceState(value);
    return;
  }
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) return;
  if (key === "trips") trips.splice(0, trips.length, ...(parsed as Partial<Trip>[]).map((item) => ({
    ...item,
    originCountry: countryCode(item.originCountry),
    destinationCountry: countryCode(item.destinationCountry),
    currency: currencyCode(item.currency),
  })) as Trip[]);
  if (key === "freight") freight.splice(0, freight.length, ...(parsed as Partial<Freight>[]).map((item) => ({
    ...item,
    pickupCountry: countryCode(item.pickupCountry),
    dropoffCountry: countryCode(item.dropoffCountry),
    currency: currencyCode(item.currency),
  })) as Freight[]);
  if (key === "bookings") bookings.splice(0, bookings.length, ...(parsed as Partial<Booking>[]).map((item) => ({
    ...item,
    originCountry: countryCode(item.originCountry),
    destinationCountry: countryCode(item.destinationCountry),
    currency: currencyCode(item.currency),
  })) as Booking[]);
  if (key === "payments") payments.splice(0, payments.length, ...(parsed as Partial<Payment>[]).map((item) => ({
    ...item,
    payerCountry: countryCode(item.payerCountry),
    payeeCountry: countryCode(item.payeeCountry),
    currency: currencyCode(item.currency),
    settlementCurrency: currencyCode(item.settlementCurrency),
  })) as Payment[]);
  if (key === "borderMilestones") borderMilestones.splice(0, borderMilestones.length, ...(parsed as Partial<BorderMilestone>[]).map((item) => ({
    ...item,
    country: countryCode(item.country),
    requiredDocuments: Array.isArray(item.requiredDocuments) ? item.requiredDocuments.filter((document): document is string => typeof document === "string") : [],
    status: item.status || "Planned",
  })) as BorderMilestone[]);
  if (key === "messages") messages.splice(0, messages.length, ...parsed);
  if (key === "documents") documents.splice(0, documents.length, ...parsed);
  if (key === "users") users.splice(0, users.length, ...(parsed as Partial<User>[]).map((item) => ({
    ...item,
    country: countryCode(item.country),
  })) as User[]);
  if (key === "verifications") verifications.splice(0, verifications.length, ...parsed as Verification[]);
  if (key === "brokerRequests") brokerRequests.splice(0, brokerRequests.length, ...parsed as BrokerRequest[]);
  if (key === "adminActivities") adminActivities.splice(0, adminActivities.length, ...parsed as AdminActivity[]);
}

function syncFinanceFromPayments() {
  for (const payment of payments) {
    recordPayment({
      bookingId: payment.bookingId,
      paymentId: payment.id,
      grossAmount: payment.settlementAmount,
      currency: payment.settlementCurrency,
      platformFee: payment.commissionAmount,
      providerFee: payment.fee,
      carrierPayable: payment.carrierPayout,
      reference: payment.reference,
    });
  }
}

async function ensureDatabaseState() {
  if (!databaseConfigured) {
    syncFinanceFromPayments();
    return;
  }
  if (!stateReady) {
    stateReady = (async () => {
      const rows = await db.select().from(runtimeStateTable);
      if (rows.length === 0) {
        await db.insert(runtimeStateTable).values(stateKeys.map((key) => ({ key, value: stateValue(key) })));
        return;
      }
      for (const row of rows) applyState(row.key, row.value);
      const existingKeys = new Set(rows.map((row) => row.key));
      const missingKeys = stateKeys.filter((key) => !existingKeys.has(key));
      if (missingKeys.length > 0) {
        await db.insert(runtimeStateTable)
          .values(missingKeys.map((key) => ({ key, value: stateValue(key) })))
          .onConflictDoNothing();
      }
    })();
  }
  try {
    await stateReady;
    syncFinanceFromPayments();
  } catch (error) {
    stateReady = undefined;
    throw error;
  }
}

async function persistDatabaseState() {
  if (!databaseConfigured) return;
  await Promise.all(stateKeys.map((key) =>
    db.insert(runtimeStateTable)
      .values({ key, value: stateValue(key) })
      .onConflictDoUpdate({
        target: runtimeStateTable.key,
        set: { value: stateValue(key), updatedAt: new Date() },
      }),
  ));
}

function issueToken(user: User) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role, exp: Date.now() + 86400000 })).toString("base64url");
  const signature = createHmac("sha256", process.env.JWT_SECRET || "truckshare-dev-secret").update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

type OtpChallenge = {
  channel: "email" | "phone";
  userId?: string;
  email?: string;
  phone?: string;
  country?: CountryCode;
  mode?: "login" | "signup";
  name?: string;
  role?: "Carrier" | "Shipper" | "Admin";
  roles?: Array<"Carrier" | "Shipper">;
  termsAccepted?: boolean;
  otpHash: string;
  exp: number;
};

function signChallenge(challenge: Omit<OtpChallenge, "exp">) {
  const payload = Buffer.from(JSON.stringify({ ...challenge, exp: Date.now() + OTP_CHALLENGE_TTL_MS })).toString("base64url");
  const signature = createHmac("sha256", process.env.JWT_SECRET || "truckshare-dev-secret").update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readChallenge(value: string): OtpChallenge | undefined {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return undefined;

  const expected = createHmac("sha256", process.env.JWT_SECRET || "truckshare-dev-secret").update(payload).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) return undefined;

  try {
    const challenge = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OtpChallenge;
    if (!challenge.phone || !challenge.country || !challenge.mode || !Number.isFinite(challenge.exp) || challenge.exp < Date.now()) return undefined;
    return challenge;
  } catch {
    return undefined;
  }
}

function hashOtp(value: string) {
  return createHmac("sha256", process.env.JWT_SECRET || "truckshare-dev-secret").update(value).digest("base64url");
}

function otpMatches(value: string, expectedHash: string) {
  const actual = Buffer.from(hashOtp(value));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function emailConfiguration() {
  const apiKey = text(process.env.RESEND_API_KEY);
  const from = text(process.env.EMAIL_FROM);
  return apiKey && from ? { apiKey, from } : undefined;
}

async function sendEmailOtp(email: string, code: string) {
  const config = emailConfiguration();
  if (!config) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [email],
      subject: "Your TruckShare verification code",
      text: `Your TruckShare verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Your TruckShare verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
    }),
  });
  return response.ok;
}

function esmsConfiguration() {
  const apiKey = text(process.env.ESMS_API_KEY);
  const accountId = text(process.env.ESMS_ACCOUNT_ID);
  const senderId = text(process.env.ESMS_SENDER_ID) || "eSMSAfrica";
  return apiKey && accountId ? { apiKey, accountId, senderId } : undefined;
}

async function sendPhoneOtp(phone: string, code: string) {
  const config = esmsConfiguration();
  if (!config) return false;

  const response = await fetch("https://api.esmsafrica.io/api/sms/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
      "X-Account-ID": config.accountId,
    },
    body: JSON.stringify({
      phoneNumber: phone,
      text: `TruckShare phone verification code: ${code}. It expires in 10 minutes.`,
      senderId: config.senderId,
    }),
  });
  if (!response.ok) return false;
  const body = await response.json() as { status?: unknown };
  return body.status === "ACK";
}

function nextOtpRequest(phoneOrEmail: string) {
  const lastRequestedAt = otpRequestCooldowns.get(phoneOrEmail) || 0;
  const retryAfterSeconds = Math.ceil((lastRequestedAt + OTP_RESEND_COOLDOWN_MS - Date.now()) / 1000);
  return retryAfterSeconds > 0 ? retryAfterSeconds : 0;
}

function verificationCode() {
  return String(randomInt(100000, 1000000));
}

function phoneChangeAllowed(user: User, nextPhone: string) {
  if (!user.phone || normalizePhone(user.phone) === nextPhone) return true;
  if (!user.phoneChangedAt) return true;
  return Date.now() - Date.parse(user.phoneChangedAt) >= PHONE_CHANGE_COOLDOWN_MS;
}

function phoneChangeRetryDays(user: User) {
  if (!user.phoneChangedAt) return 0;
  return Math.max(1, Math.ceil((Date.parse(user.phoneChangedAt) + PHONE_CHANGE_COOLDOWN_MS - Date.now()) / (24 * 60 * 60 * 1000)));
}

function googleConfiguration() {
  const clientId = text(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = text(process.env.GOOGLE_CLIENT_SECRET);
  const redirectUri = text(process.env.GOOGLE_REDIRECT_URI);
  return clientId && clientSecret && redirectUri ? { clientId, clientSecret, redirectUri } : undefined;
}

function frontendRedirectUrl() {
  return text(process.env.FRONTEND_URL) || "http://localhost:5173";
}

function safeFrontendRedirect(value?: string) {
  const fallback = new URL(frontendRedirectUrl());
  if (!value) return fallback.toString();
  try {
    const requested = new URL(value);
    if (requested.origin !== fallback.origin) return fallback.toString();
    requested.search = "";
    requested.hash = "";
    return requested.toString();
  } catch {
    return fallback.toString();
  }
}

function googleResultRedirect(params: Record<string, string>, returnTo?: string) {
  const url = new URL(safeFrontendRedirect(returnTo));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function googleError(res: Response, message: string, returnTo?: string) {
  res.redirect(googleResultRedirect({ google_error: message }, returnTo));
}

async function sendVerificationEmail(email: string, code: string) {
  return sendEmailOtp(email, code);
}

async function sendVerificationPhone(phone: string, code: string) {
  return sendPhoneOtp(phone, code);
}

function configuredAdminPhones() {
  return (process.env.ADMIN_PHONES || "").split(",").map((phone) => phone.replace(/\s+/g, "")).filter(Boolean);
}

function isAdminPhone(phone: string) {
  return configuredAdminPhones().includes(phone);
}

function developmentAdminAccessEnabled() {
  const flag = text(process.env.DEV_ADMIN_ACCESS).toLowerCase();
  return process.env.NODE_ENV !== "production" && ["1", "true", "yes"].includes(flag);
}

function developmentAdminUser() {
  const existing = users.find((user) => user.id === "dev-admin");
  if (existing) return existing;
  const user: User = {
    id: "dev-admin",
    name: "Development Admin",
    email: "dev-admin@localhost",
    country: "UG",
    role: "Admin",
    verified: true,
  };
  users.unshift(user);
  return user;
}

function authenticatedUser(req: Request) {
  const token = text(req.headers.authorization).replace(/^Bearer\s+/i, "");
  return sessions.get(token);
}

function publicUser(user: User | null) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return { ...safeUser, hasPassword: Boolean(user.passwordHash) };
}

function adminUser(req: Request, res: Response) {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in with an admin account to view this area." });
    return undefined;
  }
  if (user.role !== "Admin") {
    res.status(403).json({ error: "This area is restricted to admins." });
    return undefined;
  }
  return user;
}

function brokerRequestForEntity(kind: BrokerRequestKind, entityId: string) {
  return brokerRequests.find((request) => request.kind === kind && request.entityId === entityId);
}

function recordAdminActivity(request: BrokerRequest | undefined, label: string, detail: string, actor: string) {
  adminActivities.unshift({
    id: id("activity"),
    requestId: request?.id,
    label,
    detail,
    actor,
    createdAt: new Date().toISOString(),
  });
}

function createBrokerRequest(input: Omit<BrokerRequest, "id" | "createdAt" | "updatedAt" | "notes"> & { notes?: string[] }) {
  const createdAt = new Date().toISOString();
  const request: BrokerRequest = {
    ...input,
    id: id("request"),
    notes: input.notes || [],
    createdAt,
    updatedAt: createdAt,
  };
  brokerRequests.unshift(request);
  recordAdminActivity(request, "New submission", `${request.counterpart} submitted a ${request.kind.toLowerCase()} request.`, "System");
  return request;
}

function brokerMatchSuggestions(request: BrokerRequest) {
  if (request.kind === "Load") {
    const load = freight.find((item) => item.id === request.entityId);
    if (!load) return [];
    return trips
      .filter((trip) => trip.status === "Available" && trip.capacityTons >= load.weightTons && trip.capacityM3 >= load.volumeM3)
      .map((trip) => ({
        id: trip.id,
        kind: "Trip" as const,
        title: `${trip.vehicleType} · ${trip.capacityTons} tons available`,
        counterpart: trip.carrier,
        corridor: trip.corridor,
        date: trip.departureDate,
        price: trip.price,
        compatibility: trip.corridor === load.corridor ? 96 : 72,
      }))
      .sort((a, b) => b.compatibility - a.compatibility)
      .slice(0, 5);
  }
  const trip = trips.find((item) => item.id === request.entityId);
  if (!trip) return [];
  return freight
    .filter((load) => ["Pending", "Matched"].includes(load.status) && load.weightTons <= trip.capacityTons && load.volumeM3 <= trip.capacityM3)
    .map((load) => ({
      id: load.id,
      kind: "Load" as const,
      title: load.description,
      counterpart: load.shipper,
      corridor: load.corridor,
      date: load.pickupDate,
      price: load.price,
      compatibility: trip.corridor === load.corridor ? 96 : 72,
    }))
    .sort((a, b) => b.compatibility - a.compatibility)
    .slice(0, 5);
}

function passwordHash(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password: string, storedHash: string) {
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

const router: IRouter = Router();

router.use(async (_req, _res, next) => {
  try {
    await ensureDatabaseState();
    next();
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", (_req, res) => {
  const totalEscrow = bookings.filter((booking) => booking.escrowStatus === "Held").reduce((sum, booking) => sum + booking.amount, 0);
  res.json(GetDashboardResponse.parse({
    activeTrips: trips.filter((trip) => trip.status !== "Delivered").length,
    availableLoads: freight.filter((load) => load.status === "Pending").length,
    inTransit: bookings.filter((booking) => booking.status === "In Transit" || booking.status === "At Border").length,
    delivered: freight.filter((load) => load.status === "Delivered").length,
    totalEscrow,
    matchRate: 87,
    recentActivity: [
      { id: "activity-1", label: "New match found", detail: "Kampala → Mbale · 92% compatible", time: "12 min ago", tone: "amber" },
      { id: "activity-2", label: "Mobile money held", detail: "Eastline Hardware · UGX 1,320,000", time: "1 hr ago", tone: "green" },
      { id: "activity-3", label: "Verification submitted", detail: "Thabo Transport · Driver documents", time: "3 hrs ago", tone: "amber" },
    ],
  }));
});

router.get("/finance/overview", (req, res) => {
  const user = authenticatedUser(req);
  if (!user || user.role !== "Admin") {
    res.status(403).json({ error: "Only finance administrators can view the finance overview." });
    return;
  }
  res.json(GetFinanceOverviewResponse.parse(getFinanceOverview()));
});

router.get("/finance/bookings/:id", (req, res) => {
  const booking = bookings.find((item) => item.id === text(req.params.id));
  if (!booking) {
    res.status(404).json({ error: "Booking not found." });
    return;
  }
  const current = getBookingFinance(booking.id) ?? ensureBookingFinance({
    bookingId: booking.id,
    grossAmount: booking.amount,
    currency: booking.currency,
    platformFee: booking.commissionAmount,
    providerFee: 0,
    carrierPayable: booking.carrierPayout,
  });
  res.json(GetBookingFinanceResponse.parse({ ...current, payout: current.payout ?? null }));
});

router.post("/finance/bookings/:id/release", async (req, res) => {
  const user = authenticatedUser(req);
  if (!user || user.role !== "Admin") {
    res.status(403).json({ error: "Only finance administrators can release carrier payouts." });
    return;
  }
  const booking = bookings.find((item) => item.id === text(req.params.id));
  if (!booking) {
    res.status(404).json({ error: "Booking not found." });
    return;
  }
  const data = ReleaseBookingPayoutBody.parse(req.body);
  const current = releasePayout(booking.id, data.reason);
  if (!current) {
    res.status(409).json({ error: "This booking is not eligible for payout release. Delivery confirmation must be completed first." });
    return;
  }
  booking.escrowStatus = "Released";
  releaseHeldPayment(booking.id);
  await persistDatabaseState();
  res.json(GetBookingFinanceResponse.parse({ ...current, payout: current.payout ?? null }));
});

router.get("/reference/eac", (_req, res) => {
  res.json({ countries: eacCountries, corridors: eacCorridors });
});

router.get("/geocode/search", async (req, res) => {
  const query = text(req.query.q).trim();
  if (query.length < 2) {
    res.json([]);
    return;
  }

  const selectedCountry = optionalCountryCode(req.query.countryCode);
  const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("format", "jsonv2");
  searchUrl.searchParams.set("addressdetails", "1");
  searchUrl.searchParams.set("limit", "3");
  searchUrl.searchParams.set("countrycodes", (selectedCountry ? [selectedCountry] : eacCountries.map((country) => country.code)).join(",").toLowerCase());

  try {
    const response = await fetch(searchUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TruckShare/1.0 (location search)",
      },
    });
    if (!response.ok) {
      res.status(502).json({ error: "Map search is temporarily unavailable." });
      return;
    }

    const body = await response.json() as Array<{
      display_name?: unknown;
      lat?: unknown;
      lon?: unknown;
      address?: Record<string, unknown>;
    }>;
    const results = body
      .map((result) => {
        const resultCountry = optionalCountryCode(result.address?.country_code);
        const latitude = Number(result.lat);
        const longitude = Number(result.lon);
        const country = eacCountries.find((item) => item.code === resultCountry);
        if (!resultCountry || !country || !text(result.display_name).trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
        return {
          city: text(result.display_name).trim(),
          countryCode: resultCountry,
          countryName: country.name,
          latitude,
          longitude,
        } satisfies LocationPoint;
      })
      .filter((result): result is LocationPoint => Boolean(result));

    res.json(results.slice(0, 3));
  } catch {
    res.status(502).json({ error: "Map search is temporarily unavailable." });
  }
});

router.get("/geocode/reverse", async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    res.json({ display_name: null, location: null });
    return;
  }

  const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
  reverseUrl.searchParams.set("lat", String(latitude));
  reverseUrl.searchParams.set("lon", String(longitude));
  reverseUrl.searchParams.set("format", "jsonv2");
  reverseUrl.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(reverseUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TruckShare/1.0 (location search)",
      },
    });
    if (!response.ok) {
      res.status(502).json({ display_name: null, location: null });
      return;
    }

    const result = await response.json() as {
      display_name?: unknown;
      address?: Record<string, unknown>;
    };
    const resultCountry = optionalCountryCode(result.address?.country_code);
    const country = eacCountries.find((item) => item.code === resultCountry);
    const displayName = text(result.display_name).trim() || null;
    const location = resultCountry && country && displayName
      ? {
          city: displayName,
          countryCode: resultCountry,
          countryName: country.name,
          latitude,
          longitude,
        } satisfies LocationPoint
      : null;

    res.json({ display_name: displayName, location });
  } catch {
    res.status(502).json({ display_name: null, location: null });
  }
});

router.post("/auth/account-status", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Use a valid email address." });
    return;
  }
  res.json({ exists: users.some((user) => normalizeEmail(user.email || "") === email) });
});

router.post("/auth/dev-admin", (req, res) => {
  if (!developmentAdminAccessEnabled()) {
    res.status(404).json({ error: "Development admin access is disabled." });
    return;
  }
  const user = developmentAdminUser();
  const token = issueToken(user);
  sessions.set(token, user);
  res.json({ token, user: publicUser(user), developmentOnly: true });
});

router.post("/auth/request-email-otp", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const mode = req.body?.mode === "login" ? "login" : "signup";
  const termsAccepted = req.body?.termsAccepted === true;
  const existingUser = users.find((user) => normalizeEmail(user.email || "") === email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Use a valid email address." });
    return;
  }
  if (mode === "login" && !existingUser) {
    res.status(404).json({ error: "No account exists for this email. Choose Create account first." });
    return;
  }
  if (mode === "signup" && existingUser) {
    res.status(409).json({ error: "An account already exists for this email. Choose Log in instead." });
    return;
  }

  const name = text(req.body?.name);
  if (mode === "signup" && !name) {
    res.status(400).json({ error: "Enter your name to create an account." });
    return;
  }
  const roles = requestedRoles(req.body?.roles);
  if (roles.length === 0 && (req.body?.role === "Carrier" || req.body?.role === "Shipper")) roles.push(req.body.role);
  if (mode === "signup" && roles.length === 0) {
    res.status(400).json({ error: "Choose at least one account role." });
    return;
  }
  if (mode === "signup" && !termsAccepted) {
    res.status(400).json({ error: "Accept the Terms and Conditions and Privacy Policy to create an account." });
    return;
  }

  const retryAfterSeconds = nextOtpRequest(email);
  if (retryAfterSeconds > 0) {
    res.status(429).json({ error: `Please wait ${retryAfterSeconds}s before requesting another code.` });
    return;
  }
  if (!emailConfiguration()) {
    res.status(503).json({ error: "Email verification is not configured yet. Add the Resend email secrets to the API service." });
    return;
  }

  const code = verificationCode();
  const role = roles.includes("Carrier") ? "Carrier" : "Shipper";
  try {
    if (!await sendVerificationEmail(email, code)) {
      res.status(502).json({ error: "We could not send the verification email. Please try again." });
      return;
    }
    otpRequestCooldowns.set(email, Date.now());
    res.json({
      challengeId: signChallenge({ channel: "email", email, mode, name: name || undefined, role, roles, termsAccepted, otpHash: hashOtp(code) }),
      email,
      message: "We sent a verification code to your email. It expires in 10 minutes.",
    });
  } catch {
    res.status(502).json({ error: "We could not send the verification email. Please try again." });
  }
});

router.post("/auth/verify-email-otp", async (req, res) => {
  const challengeId = text(req.body?.challengeId);
  const challenge = readChallenge(challengeId);
  const otp = text(req.body?.otp).replace(/\D/g, "");
  if (!challenge || challenge.channel !== "email" || !challenge.email || !/^\d{6}$/.test(otp) || !otpMatches(otp, challenge.otpHash)) {
    res.status(400).json({ error: "That OTP is not valid or has expired." });
    return;
  }

  const existingUser = users.find((user) => normalizeEmail(user.email || "") === challenge.email);
  if (challenge.mode === "login" && !existingUser) {
    res.status(404).json({ error: "No account exists for this email. Choose Create account first." });
    return;
  }
  const user = existingUser || {
    id: id("user"),
    name: challenge.name || "New TruckShare user",
    email: challenge.email,
    emailVerifiedAt: new Date().toISOString(),
    country: "UG",
    role: challenge.role || "Carrier",
    roles: challenge.roles,
    verified: false,
    termsAcceptedAt: challenge.termsAccepted ? new Date().toISOString() : undefined,
    termsVersion: challenge.termsAccepted ? TERMS_VERSION : undefined,
  };
  user.email = challenge.email;
  user.emailVerifiedAt = user.emailVerifiedAt || new Date().toISOString();
  if (!existingUser) users.push(user);
  const token = issueToken(user);
  sessions.set(token, user);
  await persistDatabaseState();
  res.json({ token, user: publicUser(user), requiresPhoneVerification: !user.phone || !user.phoneVerifiedAt });
});

router.post("/auth/request-phone-otp", async (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in with email before verifying a phone number." });
    return;
  }

  const phone = normalizePhone(text(req.body?.phone));
  const country = phoneCountry(phone);
  if (!country || !/^\+\d{8,15}$/.test(phone)) {
    res.status(400).json({ error: "Use a valid EAC number with a supported country code." });
    return;
  }
  if (user.phone && normalizePhone(user.phone) === phone && user.phoneVerifiedAt) {
    res.json({ alreadyVerified: true, phone, user: publicUser(user), message: "This phone number is already verified." });
    return;
  }
  if (!phoneChangeAllowed(user, phone)) {
    res.status(409).json({ error: `You can change your phone number again in about ${phoneChangeRetryDays(user)} days.` });
    return;
  }
  const phoneOwner = users.find((item) => item.id !== user.id && normalizePhone(item.phone || "") === phone);
  if (phoneOwner) {
    res.status(409).json({ error: "That phone number is already linked to another TruckShare account." });
    return;
  }
  const retryAfterSeconds = nextOtpRequest(phone);
  if (retryAfterSeconds > 0) {
    res.status(429).json({ error: `Please wait ${retryAfterSeconds}s before requesting another code.` });
    return;
  }
  if (!esmsConfiguration()) {
    res.status(503).json({ error: "Phone verification is not configured yet. Add the eSMS Africa secrets to the API service." });
    return;
  }

  const code = verificationCode();
  try {
    if (!await sendVerificationPhone(phone, code)) {
      res.status(502).json({ error: "We could not send the phone verification code. Please try again." });
      return;
    }
    otpRequestCooldowns.set(phone, Date.now());
    res.json({
      challengeId: signChallenge({ channel: "phone", userId: user.id, phone, country, otpHash: hashOtp(code) }),
      phone,
      message: "We sent a verification code to your phone. It expires in 10 minutes.",
    });
  } catch {
    res.status(502).json({ error: "We could not send the phone verification code. Please try again." });
  }
});

router.post("/auth/verify-phone-otp", async (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Your session has expired. Sign in again." });
    return;
  }

  const challenge = readChallenge(text(req.body?.challengeId));
  const otp = text(req.body?.otp).replace(/\D/g, "");
  if (!challenge || challenge.channel !== "phone" || challenge.userId !== user.id || !challenge.phone || !challenge.country || !/^\d{6}$/.test(otp) || !otpMatches(otp, challenge.otpHash)) {
    res.status(400).json({ error: "That OTP is not valid or has expired." });
    return;
  }
  if (!phoneChangeAllowed(user, challenge.phone)) {
    res.status(409).json({ error: `You can change your phone number again in about ${phoneChangeRetryDays(user)} days.` });
    return;
  }

  user.phone = challenge.phone;
  user.country = challenge.country;
  user.phoneVerifiedAt = new Date().toISOString();
  user.phoneChangedAt = user.phoneVerifiedAt;
  await persistDatabaseState();
  res.json({ user: publicUser(user), phoneVerified: true });
});

router.get("/auth/google/start", (req, res) => {
  const config = googleConfiguration();
  const returnTo = text(req.query.return_to);
  if (!config) {
    googleError(res, "Google sign-in is not configured on the API service.", returnTo);
    return;
  }

  const mode = req.query.mode === "login" ? "login" : "signup";
  const roles = requestedRoles(String(req.query.roles || "").split(","));
  const termsAccepted = req.query.terms === "1";
  if (mode === "signup" && roles.length === 0) {
    googleError(res, "Choose at least one account role before continuing with Google.", returnTo);
    return;
  }
  if (mode === "signup" && !termsAccepted) {
    googleError(res, "Accept the Terms and Conditions and Privacy Policy before continuing with Google.", returnTo);
    return;
  }

  const state = randomBytes(32).toString("base64url");
  googleStates.set(state, { mode, roles, termsAccepted, returnTo, exp: Date.now() + 10 * 60 * 1000 });
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("access_type", "online");
  authorizationUrl.searchParams.set("prompt", "select_account");
  res.redirect(authorizationUrl.toString());
});

router.get("/auth/google/callback", async (req, res) => {
  const config = googleConfiguration();
  const state = text(req.query.state);
  const pending = googleStates.get(state);
  googleStates.delete(state);
  if (!config || !pending || pending.exp < Date.now()) {
    googleError(res, "That Google sign-in session expired. Please try again.", pending?.returnTo);
    return;
  }
  if (req.query.error || !text(req.query.code)) {
    googleError(res, "Google sign-in was cancelled.", pending.returnTo);
    return;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: text(req.query.code),
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) {
      googleError(res, "Google could not complete sign-in. Please try again.", pending.returnTo);
      return;
    }
    const tokenBody = await tokenResponse.json() as { access_token?: unknown };
    const accessToken = text(tokenBody.access_token);
    if (!accessToken) {
      googleError(res, "Google did not return an access token.", pending.returnTo);
      return;
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileResponse.ok) {
      googleError(res, "Google profile lookup failed. Please try again.", pending.returnTo);
      return;
    }
    const profile = await profileResponse.json() as { sub?: unknown; email?: unknown; email_verified?: unknown; name?: unknown };
    const googleId = text(profile.sub);
    const email = normalizeEmail(text(profile.email));
    if (!googleId || !email || profile.email_verified !== true) {
      googleError(res, "Google did not provide a verified email address.", pending.returnTo);
      return;
    }

    const existingUser = users.find((user) => user.googleId === googleId || normalizeEmail(user.email || "") === email);
    if (pending.mode === "login" && !existingUser) {
      googleError(res, "No TruckShare account exists for this Google email. Choose Create account first.", pending.returnTo);
      return;
    }
    if (pending.mode === "signup" && existingUser) {
      googleError(res, "A TruckShare account already uses this Google email. Choose Log in instead.", pending.returnTo);
      return;
    }

    const user = existingUser || {
      id: id("user"),
      name: text(profile.name) || "Google workspace user",
      googleId,
      email,
      emailVerifiedAt: new Date().toISOString(),
      country: "UG",
      role: pending.roles.includes("Carrier") ? "Carrier" : "Shipper",
      roles: pending.roles,
      verified: false,
      termsAcceptedAt: pending.termsAccepted ? new Date().toISOString() : undefined,
      termsVersion: pending.termsAccepted ? TERMS_VERSION : undefined,
    };
    user.googleId = googleId;
    user.email = email;
    user.emailVerifiedAt = user.emailVerifiedAt || new Date().toISOString();
    if (!existingUser) users.push(user);
    const sessionToken = issueToken(user);
    sessions.set(sessionToken, user);
    await persistDatabaseState();

    const exchangeCode = randomBytes(32).toString("base64url");
    googleExchangeCodes.set(exchangeCode, { token: sessionToken, user, exp: Date.now() + 2 * 60 * 1000 });
    res.redirect(googleResultRedirect({ google_code: exchangeCode }, pending.returnTo));
  } catch {
    googleError(res, "Google sign-in could not be completed. Please try again.", pending.returnTo);
  }
});

router.post("/auth/google/exchange", (req, res) => {
  const code = text(req.body?.code);
  const result = googleExchangeCodes.get(code);
  googleExchangeCodes.delete(code);
  if (!result || result.exp < Date.now()) {
    res.status(400).json({ error: "That Google sign-in link is invalid or expired." });
    return;
  }
  res.json({ token: result.token, user: publicUser(result.user) });
});

router.get("/auth/me", (req, res) => {
  res.json({ user: publicUser(authenticatedUser(req) || null) });
});

router.patch("/auth/profile", async (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Your session has expired. Sign in again." });
    return;
  }
  const name = text(req.body?.name).trim();
  const country = optionalCountryCode(req.body?.country);
  if (name.length < 2) {
    res.status(400).json({ error: "Enter a name or business name with at least 2 characters." });
    return;
  }
  user.name = name;
  if (country) user.country = country;
  await persistDatabaseState();
  res.json({ user: publicUser(user), message: "Your profile has been updated." });
});

router.post("/auth/password", async (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Your session has expired. Sign in again." });
    return;
  }
  const currentPassword = text(req.body?.currentPassword);
  const newPassword = text(req.body?.newPassword);
  const hadPassword = Boolean(user.passwordHash);
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Your new password must be at least 8 characters." });
    return;
  }
  if (user.passwordHash && !passwordMatches(currentPassword, user.passwordHash)) {
    res.status(400).json({ error: "Your current password is not correct." });
    return;
  }
  user.passwordHash = passwordHash(newPassword);
  await persistDatabaseState();
  res.json({ user: publicUser(user), message: hadPassword ? "Your password has been changed." : "Your password has been set." });
});

router.get("/trips", (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in to view your trip submissions." });
    return;
  }
  const query = ListTripsQueryParams.parse(req.query);
  const filtered = trips.filter((trip) =>
    (user.role === "Admin" || trip.ownerUserId === user.id) &&
    (!query.corridor || trip.corridor.toLowerCase().includes(query.corridor.toLowerCase())) &&
    (!query.date || trip.departureDate === query.date) &&
    (!query.vehicleType || trip.vehicleType === query.vehicleType),
  );
  res.json(ListTripsResponse.parse(filtered.map(tripWithLocations)));
});

router.post("/trips", async (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in before submitting a return trip." });
    return;
  }
  const data = CreateTripBody.parse(req.body);
  const originCountry = optionalCountryCode(req.body?.originCountry);
  const destinationCountry = optionalCountryCode(req.body?.destinationCountry);
  if (!originCountry || !destinationCountry) {
    res.status(400).json({ error: "Select a valid EAC country for both the origin and destination." });
    return;
  }
  const trip: Trip = {
    ...data,
    id: id("trip"),
    ownerUserId: user.id,
    carrier: user.name,
    carrierRating: 5,
    originCountry,
    originLocation: submittedLocation(data.originLocation, data.origin, originCountry),
    destinationCountry,
    destinationLocation: submittedLocation(data.destinationLocation, data.destination, destinationCountry),
    departureTime: text(req.body?.departureTime) || "07:00",
    corridor: `${data.origin.split(",")[0]} → ${data.destination.split(",")[0]}`,
    currency: currencyCode(req.body?.currency, currencyForCountry(originCountry)),
    priceType: data.priceType as Trip["priceType"],
    vehicleType: data.vehicleType,
    status: "Available",
  };
  trips.unshift(trip);
  createBrokerRequest({
    kind: "Trip",
    entityId: trip.id,
    title: `${trip.vehicleType} · ${trip.capacityTons} tons available`,
    counterpart: user.name || trip.carrier,
    ownerUserId: user.id,
    corridor: trip.corridor,
    date: trip.departureDate,
    priority: "Normal",
    status: "New",
  });
  await persistDatabaseState();
  res.status(201).json(tripWithLocations(trip));
});

router.patch("/trips/:id", async (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in before editing a return trip." });
    return;
  }
  const params = UpdateTripParams.parse(req.params);
  const data = UpdateTripBody.parse(req.body);
  const trip = trips.find((item) => item.id === params.id);
  if (!trip) { res.status(404).json({ error: "Trip not found" }); return; }
  if (user.role !== "Admin" && trip.ownerUserId !== user.id) {
    res.status(403).json({ error: "You can only edit your own trip submissions." });
    return;
  }
  Object.assign(trip, data);
  trip.originLocation = submittedLocation(data.originLocation, trip.origin, trip.originCountry);
  trip.destinationLocation = submittedLocation(data.destinationLocation, trip.destination, trip.destinationCountry);
  trip.corridor = `${trip.origin.split(",")[0]} → ${trip.destination.split(",")[0]}`;
  await persistDatabaseState();
  res.json(UpdateTripResponse.parse(tripWithLocations(trip)));
});

router.get("/freight", (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in to view your freight submissions." });
    return;
  }
  const query = ListFreightQueryParams.parse(req.query);
  res.json(ListFreightResponse.parse(freight.filter((load) =>
    (user.role === "Admin" || load.ownerUserId === user.id) &&
    (!query.corridor || load.corridor.toLowerCase().includes(query.corridor.toLowerCase())) &&
    (!query.date || load.pickupDate === query.date),
  ).map(freightWithLocations)));
});

router.post("/freight", async (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in before submitting a load request." });
    return;
  }
  const data = CreateFreightBody.parse(req.body);
  const pickupCountry = optionalCountryCode(req.body?.pickupCountry);
  const dropoffCountry = optionalCountryCode(req.body?.dropoffCountry);
  if (!pickupCountry || !dropoffCountry) {
    res.status(400).json({ error: "Select a valid EAC country for both the pickup and drop-off." });
    return;
  }
  const load: Freight = {
    ...data,
    id: id("load"),
    ownerUserId: user.id,
    shipper: user.name,
    pickupCountry,
    pickupLocation: submittedLocation(data.pickupLocation, data.pickup, pickupCountry),
    dropoffCountry,
    dropoffLocation: submittedLocation(data.dropoffLocation, data.dropoff, dropoffCountry),
    cargoType: text(req.body?.cargoType) || "General cargo",
    volumeM3: number(req.body?.volumeM3) || 0,
    corridor: `${data.pickup.split(",")[0]} → ${data.dropoff.split(",")[0]}`,
    currency: currencyCode(req.body?.currency, currencyForCountry(pickupCountry)),
    status: "Pending",
  };
  freight.unshift(load);
  createBrokerRequest({
    kind: "Load",
    entityId: load.id,
    title: load.description,
    counterpart: user.name || load.shipper,
    ownerUserId: user.id,
    corridor: load.corridor,
    date: load.pickupDate,
    priority: "Normal",
    status: "New",
  });
  await persistDatabaseState();
  res.status(201).json(freightWithLocations(load));
});

router.patch("/freight/:id", async (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in before editing a load request." });
    return;
  }
  const params = UpdateFreightParams.parse(req.params);
  const data = UpdateFreightBody.parse(req.body);
  const load = freight.find((item) => item.id === params.id);
  if (!load) { res.status(404).json({ error: "Freight request not found" }); return; }
  if (user.role !== "Admin" && load.ownerUserId !== user.id) {
    res.status(403).json({ error: "You can only edit your own load submissions." });
    return;
  }
  Object.assign(load, data);
  load.pickupLocation = submittedLocation(data.pickupLocation, load.pickup, load.pickupCountry);
  load.dropoffLocation = submittedLocation(data.dropoffLocation, load.dropoff, load.dropoffCountry);
  load.corridor = `${load.pickup.split(",")[0]} → ${load.dropoff.split(",")[0]}`;
  await persistDatabaseState();
  res.json(UpdateFreightResponse.parse(freightWithLocations(load)));
});

router.get("/matches", (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in to view broker-approved matches." });
    return;
  }
  const query = ListMatchesQueryParams.parse(req.query);
  const corridor = query.corridor?.toLowerCase();
  const approvedRequest = (kind: BrokerRequestKind, entityId: string) => {
    if (user.role === "Admin") return true;
    const request = brokerRequestForEntity(kind, entityId);
    return Boolean(request && ["Offer sent", "Confirmed", "Assigned", "In progress"].includes(request.status));
  };
  const result = query.mode === "carrier"
    ? freight.filter((load) => approvedRequest("Load", load.id) && (!corridor || load.corridor.toLowerCase().includes(corridor))).map((load) => ({ id: load.id, type: "freight", title: load.description, corridor: load.corridor, date: load.pickupDate, capacity: `${load.weightTons} tons · ${load.volumeM3} m³`, price: load.price, compatibility: 87, counterpart: load.shipper }))
    : trips.filter((trip) => approvedRequest("Trip", trip.id) && (!corridor || trip.corridor.toLowerCase().includes(corridor))).map((trip) => ({ id: trip.id, type: "trip", title: `${trip.vehicleType} · ${trip.capacityTons} tons available`, corridor: trip.corridor, date: trip.departureDate, capacity: `${trip.capacityTons} tons · ${trip.capacityM3} m³`, price: trip.price, compatibility: 92, counterpart: trip.carrier }));
  res.json(ListMatchesResponse.parse(result));
});

router.get("/requests", (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in to view your broker requests." });
    return;
  }
  const visible = brokerRequests
    .filter((request) => user.role === "Admin" || request.ownerUserId === user.id)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .map((request) => ({
      id: request.id,
      kind: request.kind,
      title: request.title,
      counterpart: request.counterpart,
      corridor: request.corridor,
      date: request.date,
      priority: request.priority,
      status: request.status,
      bookingId: request.bookingId,
      proposedMatchId: request.proposedMatchId,
      notes: request.notes,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    }));
  res.json(visible);
});

router.post("/requests/:id/confirm", async (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in before confirming an offer." });
    return;
  }
  const request = brokerRequests.find((item) => item.id === text(req.params.id));
  if (!request) {
    res.status(404).json({ error: "Broker request not found." });
    return;
  }
  if (user.role !== "Admin" && request.ownerUserId !== user.id) {
    res.status(403).json({ error: "You can only confirm your own broker request." });
    return;
  }
  if (request.status !== "Offer sent") {
    res.status(409).json({ error: "Only an active offer can be confirmed." });
    return;
  }
  request.status = "Confirmed";
  request.updatedAt = new Date().toISOString();
  recordAdminActivity(request, "Counterpart confirmed", `${request.counterpart} confirmed the proposed arrangement.`, user.name);
  await persistDatabaseState();
  res.json(request);
});

router.get("/bookings", (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in to view broker-managed bookings." });
    return;
  }
  if (user.role === "Admin") {
    res.json(bookings);
    return;
  }
  const visible = bookings.filter((booking) =>
    trips.find((trip) => trip.id === booking.tripId)?.ownerUserId === user.id ||
    freight.find((load) => load.id === booking.freightId)?.ownerUserId === user.id,
  );
  res.json(visible);
});
router.post("/bookings", async (req, res) => {
  const user = adminUser(req, res);
  if (!user) return;
  const data = CreateBookingBody.parse(req.body);
  const amount = number(data.amount);
  const trip = trips.find((item) => item.id === data.tripId);
  const load = freight.find((item) => item.id === data.freightId);
  const booking: Booking = {
    ...data,
    id: id("booking"),
    originCountry: countryCode(data.originCountry || trip?.originCountry),
    destinationCountry: countryCode(data.destinationCountry || load?.dropoffCountry),
    amount,
    currency: currencyCode(data.currency || load?.currency || trip?.currency),
    commissionAmount: Math.round(amount * 0.12),
    carrierPayout: Math.round(amount * 0.88),
    paymentStatus: "Unpaid",
    escrowStatus: "Pending",
    status: "En Route to Pickup",
    bookedAt: nowDate(),
    podStatus: "Not requested",
    podOtp: "4312",
  };
  bookings.unshift(booking);
  await persistDatabaseState();
  res.status(201).json(booking);
});

router.get("/bookings/:id/border-milestones", (req, res) => {
  const booking = bookings.find((item) => item.id === text(req.params.id));
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  res.json(borderMilestones.filter((milestone) => milestone.bookingId === booking.id).sort((a, b) => a.sequence - b.sequence));
});

router.post("/bookings/:id/border-milestones", async (req, res) => {
  const booking = bookings.find((item) => item.id === text(req.params.id));
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  const status = text(req.body?.status) as BorderMilestoneStatus || "Planned";
  const validStatuses: BorderMilestoneStatus[] = ["Planned", "Documents Pending", "Submitted", "Cleared", "Held", "Crossed"];
  if (!validStatuses.includes(status)) { res.status(400).json({ error: "Invalid border milestone status." }); return; }
  const existing = borderMilestones.filter((milestone) => milestone.bookingId === booking.id);
  const milestone: BorderMilestone = {
    id: id("milestone"),
    bookingId: booking.id,
    sequence: existing.length + 1,
    checkpoint: text(req.body?.checkpoint) || "Border checkpoint",
    country: countryCode(req.body?.country, booking.destinationCountry),
    border: text(req.body?.border) || "Unspecified border",
    requiredDocuments: Array.isArray(req.body?.requiredDocuments) ? req.body.requiredDocuments.filter((document: unknown): document is string => typeof document === "string" && document.trim().length > 0) : [],
    status,
    completedAt: ["Cleared", "Crossed"].includes(status) ? nowDate() : undefined,
  };
  borderMilestones.push(milestone);
  await persistDatabaseState();
  res.status(201).json(milestone);
});

router.patch("/bookings/:id/border-milestones/:milestoneId", async (req, res) => {
  const booking = bookings.find((item) => item.id === text(req.params.id));
  const milestone = borderMilestones.find((item) => item.id === text(req.params.milestoneId) && item.bookingId === text(req.params.id));
  if (!booking || !milestone) { res.status(404).json({ error: "Border milestone not found." }); return; }
  const status = text(req.body?.status) as BorderMilestoneStatus;
  const validStatuses: BorderMilestoneStatus[] = ["Planned", "Documents Pending", "Submitted", "Cleared", "Held", "Crossed"];
  if (!validStatuses.includes(status)) { res.status(400).json({ error: "Invalid border milestone status." }); return; }
  milestone.status = status;
  milestone.completedAt = ["Cleared", "Crossed"].includes(status) ? nowDate() : undefined;
  if (status === "Held") booking.status = "At Border";
  if (status === "Crossed") booking.status = "In Transit";
  await persistDatabaseState();
  res.json(milestone);
});

router.patch("/bookings/:id/status", async (req, res) => {
  const params = UpdateBookingStatusParams.parse(req.params);
  const data = UpdateBookingStatusBody.parse(req.body);
  const booking = bookings.find((item) => item.id === params.id);
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  const nextStatuses = bookingStatusTransitions[booking.status] || [];
  if (!nextStatuses.includes(data.status)) {
    res.status(400).json({ error: `Cannot move a booking from ${booking.status} to ${data.status}.` });
    return;
  }
  if (data.status === "Delivered" && (booking.paymentStatus !== "Paid" || booking.escrowStatus !== "Held")) {
    res.status(409).json({ error: "Payment must be held before delivery can release escrow." });
    return;
  }
  booking.status = data.status;
  if (data.status === "Delivered") {
    booking.escrowStatus = "Held";
    booking.podStatus = "Delivered";
    markReleaseEligible(booking.id);
  }
  await persistDatabaseState();
  res.json(booking);
});

router.post("/bookings/:id/request-pod", async (req, res) => {
  const booking = bookings.find((item) => item.id === text(req.params.id));
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  booking.podStatus = "OTP sent";
  await persistDatabaseState();
  res.json({ bookingId: booking.id, message: "Mock receiver OTP sent.", devOtp: process.env.NODE_ENV === "production" ? undefined : booking.podOtp });
});

router.post("/bookings/:id/complete-delivery", async (req, res) => {
  const booking = bookings.find((item) => item.id === text(req.params.id));
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  if (booking.paymentStatus !== "Paid" || booking.escrowStatus !== "Held") {
    res.status(409).json({ error: "Payment must be held before delivery can release escrow." });
    return;
  }
  if (text(req.body?.otp) !== booking.podOtp) {
    res.status(400).json({ error: "The receiver OTP is not valid." });
    return;
  }
  booking.status = "Delivered";
  booking.escrowStatus = "Held";
  booking.podStatus = "Delivered";
  booking.deliveryPhoto = text(req.body?.photoName) || undefined;
  markReleaseEligible(booking.id);
  await persistDatabaseState();
  res.json({ booking, payoutUnlocked: false, releaseEligible: true });
});

router.get("/payments", (_req, res) => {
  res.json(payments);
});

router.get("/payments/quote", (req, res) => {
  const settlementAmount = number(req.query.amount);
  if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) { res.status(400).json({ error: "A positive settlement amount is required." }); return; }
  const fromCurrency = currencyCode(req.query.fromCurrency || req.query.currency);
  const toCurrency = currencyCode(req.query.toCurrency);
  const rate = exchangeRate(fromCurrency, toCurrency);
  const payerAmount = convertedAmount(settlementAmount, toCurrency, fromCurrency);
  const fee = Math.round(settlementAmount * 0.015);
  const commissionAmount = Math.round(settlementAmount * 0.12);
  res.json({
    quoteId: id("quote"),
    payerCountry: countryCode(req.query.payerCountry),
    payeeCountry: countryCode(req.query.payeeCountry),
    amount: payerAmount,
    payerAmount,
    currency: fromCurrency,
    settlementAmount,
    settlementCurrency: toCurrency,
    exchangeRate: rate,
    fee,
    commissionAmount,
    carrierPayout: settlementAmount - fee - commissionAmount,
    commissionRate: 12,
    carrierRate: 88,
    expiresInSeconds: 300,
    indicative: true,
  });
});

router.post("/payments/simulate", async (req, res) => {
  const booking = bookings.find((item) => item.id === text(req.body?.bookingId));
  const network = text(req.body?.network) as PaymentNetwork;
  const phone = text(req.body?.phone);
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  if (!["MTN MoMo", "Airtel Money", "Bank Transfer"].includes(network) || !/^\+\d{8,15}$/.test(phone.replace(/\s+/g, ""))) {
    res.status(400).json({ error: "Choose a supported payment network and valid international phone number." });
    return;
  }
  if (booking.paymentStatus === "Paid") {
    res.status(409).json({ error: "This booking has already been funded." });
    return;
  }
  const detectedPhoneCountry = phoneCountry(phone);
  const payerCountry = countryCode(req.body?.payerCountry || detectedPhoneCountry);
  if (detectedPhoneCountry !== payerCountry) {
    res.status(400).json({ error: "The payer country must match the phone number country code." });
    return;
  }
  const payerCurrency = currencyCode(req.body?.currency || booking.currency);
  const settlementCurrency = booking.currency;
  const settlementAmount = number(req.body?.settlementAmount) > 0 ? number(req.body?.settlementAmount) : booking.amount;
  const amount = convertedAmount(settlementAmount, settlementCurrency, payerCurrency);
  const fee = Math.round(settlementAmount * 0.015);
  const commissionAmount = Math.round(settlementAmount * 0.12);
  const payment: Payment = {
    id: id("payment"),
    bookingId: booking.id,
    network,
    phone,
    payerCountry,
    payeeCountry: booking.destinationCountry,
    amount,
    currency: payerCurrency,
    settlementAmount,
    settlementCurrency,
    exchangeRate: exchangeRate(payerCurrency, settlementCurrency),
    commissionAmount,
    carrierPayout: settlementAmount - fee - commissionAmount,
    fee,
    reference: `TS-${booking.id}-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: "Held",
    createdAt: nowDate(),
  };
  payments.unshift(payment);
  booking.paymentNetwork = network as Booking["paymentNetwork"];
  booking.paymentStatus = "Paid";
  booking.escrowStatus = "Held";
  recordPayment({
    bookingId: booking.id,
    paymentId: payment.id,
    grossAmount: settlementAmount,
    currency: settlementCurrency,
    platformFee: commissionAmount,
    providerFee: fee,
    carrierPayable: payment.carrierPayout,
    reference: payment.reference,
  });
  await persistDatabaseState();
  res.json({ booking, payment, message: `${network} payment simulated and escrow funded.` });
});

router.get("/messages", (_req, res) => res.json(ListMessagesResponse.parse(messages)));
router.post("/messages", async (req, res) => {
  const data = CreateMessageBody.parse(req.body);
  const message = { ...data, id: id("msg"), sender: "You", sentAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), read: true };
  messages.push(message);
  await persistDatabaseState();
  res.status(201).json(message);
});

router.get("/documents", (_req, res) => res.json(ListDocumentsResponse.parse(documents)));
router.post("/documents", async (req, res) => {
  const data = CreateDocumentBody.parse(req.body);
  const document = { ...data, id: id("doc"), uploadedBy: "You", uploadedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), status: "Pending" as const };
  documents.unshift(document);
  await persistDatabaseState();
  res.status(201).json(document);
});

router.get("/verification", (_req, res) => res.json(verifications));
router.post("/verification", async (req, res) => {
  const data = {
    name: text(req.body?.name) || "New driver",
    phone: text(req.body?.phone),
    nin: text(req.body?.nin),
    licenseNumber: text(req.body?.licenseNumber),
    logbookNumber: text(req.body?.logbookNumber),
    logbookPhotoName: text(req.body?.logbookPhotoName) || undefined,
  };
  if (!data.nin || !data.licenseNumber || !data.logbookNumber) {
    res.status(400).json({ error: "NIN, driving license, and logbook details are required." });
    return;
  }
  const verification: Verification = { ...data, id: id("verification"), userId: id("user"), status: "Pending", submittedAt: nowDate() };
  verifications.unshift(verification);
  await persistDatabaseState();
  res.status(201).json(verification);
});

router.patch("/verification/:id/review", async (req, res) => {
  const verification = verifications.find((item) => item.id === text(req.params.id));
  const status = text(req.body?.status) as Verification["status"];
  if (!verification) { res.status(404).json({ error: "Verification not found" }); return; }
  if (!["Pending", "Verified", "Rejected"].includes(status)) { res.status(400).json({ error: "Invalid verification status." }); return; }
  verification.status = status;
  const user = users.find((item) => item.id === verification.userId);
  if (user) user.verified = status === "Verified";
  await persistDatabaseState();
  res.json(verification);
});

const brokerRequestStatuses: BrokerRequestStatus[] = ["New", "Needs information", "Approved", "Matching", "Offer sent", "Confirmed", "Assigned", "In progress", "On hold", "Closed", "Rejected"];
const brokerPriorities: BrokerPriority[] = ["Low", "Normal", "High", "Urgent"];
const brokerRequestTransitions: Record<BrokerRequestStatus, BrokerRequestStatus[]> = {
  New: ["Needs information", "Approved", "On hold", "Rejected"],
  "Needs information": ["New", "Approved", "On hold", "Rejected"],
  Approved: ["Matching", "On hold", "Rejected"],
  Matching: ["Offer sent", "On hold", "Rejected"],
  "Offer sent": ["Confirmed", "Matching", "On hold", "Rejected"],
  Confirmed: ["Assigned", "Offer sent", "On hold", "Rejected"],
  Assigned: ["In progress", "On hold", "Closed"],
  "In progress": ["Closed", "On hold"],
  "On hold": ["New", "Needs information", "Approved", "Matching", "Rejected"],
  Closed: [],
  Rejected: [],
};

router.get("/admin/operations", (req, res) => {
  const user = adminUser(req, res);
  if (!user) return;
  const requests = [...brokerRequests]
    .sort((a, b) => {
      const priorityOrder: Record<BrokerPriority, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    })
    .map((request) => ({
      ...request,
      suggestions: brokerMatchSuggestions(request),
      activities: adminActivities.filter((activity) => activity.requestId === request.id).slice(0, 20),
      entity: request.kind === "Load"
        ? freightWithLocations(freight.find((item) => item.id === request.entityId) || freight[0])
        : tripWithLocations(trips.find((item) => item.id === request.entityId) || trips[0]),
    }));
  const openStatuses: BrokerRequestStatus[] = ["New", "Needs information", "Approved", "Matching", "Offer sent", "Confirmed", "Assigned", "In progress", "On hold"];
  res.json({
    requests,
    activities: adminActivities.slice(0, 30),
    verifications,
    metrics: {
      totalOpen: brokerRequests.filter((request) => openStatuses.includes(request.status)).length,
      newSubmissions: brokerRequests.filter((request) => request.status === "New").length,
      needsAttention: brokerRequests.filter((request) => ["Needs information", "On hold"].includes(request.status)).length,
      matching: brokerRequests.filter((request) => ["Approved", "Matching", "Offer sent"].includes(request.status)).length,
      activeOperations: brokerRequests.filter((request) => ["Confirmed", "Assigned", "In progress"].includes(request.status)).length,
      pendingVerifications: verifications.filter((item) => item.status === "Pending").length,
      activeBookings: bookings.filter((booking) => booking.status !== "Delivered").length,
      grossVolume: bookings.reduce((sum, booking) => sum + booking.amount, 0),
      commissionValue: bookings.reduce((sum, booking) => sum + booking.commissionAmount, 0),
      unpaidBookings: bookings.filter((booking) => booking.paymentStatus !== "Paid" && booking.status !== "Delivered").length,
      borderIssues: bookings.filter((booking) => booking.status === "At Border").length,
    },
    actor: publicUser(user),
  });
});

router.patch("/admin/requests/:id", async (req, res) => {
  const user = adminUser(req, res);
  if (!user) return;
  const request = brokerRequests.find((item) => item.id === text(req.params.id));
  if (!request) {
    res.status(404).json({ error: "Broker request not found." });
    return;
  }
  const requestedStatus = text(req.body?.status) as BrokerRequestStatus;
  const requestedPriority = text(req.body?.priority) as BrokerPriority;
  const note = text(req.body?.note);
  const assignedTo = text(req.body?.assignedTo);
  if (requestedStatus && !brokerRequestStatuses.includes(requestedStatus)) {
    res.status(400).json({ error: "Invalid broker request status." });
    return;
  }
  if (requestedStatus && requestedStatus !== request.status && !brokerRequestTransitions[request.status].includes(requestedStatus)) {
    res.status(409).json({ error: `A ${request.status} request cannot move directly to ${requestedStatus}.` });
    return;
  }
  if (requestedPriority && !brokerPriorities.includes(requestedPriority)) {
    res.status(400).json({ error: "Invalid broker request priority." });
    return;
  }
  if (requestedStatus) request.status = requestedStatus;
  if (requestedPriority) request.priority = requestedPriority;
  if (assignedTo) request.assignedTo = assignedTo;
  if (note) request.notes.unshift(note);
  request.updatedAt = new Date().toISOString();
  const label = requestedStatus ? `Status changed to ${requestedStatus}` : note ? "Note added" : "Request updated";
  recordAdminActivity(request, label, note || `${request.title} was updated by the admin desk.`, user.name);

  const entity = request.kind === "Load"
    ? freight.find((item) => item.id === request.entityId)
    : trips.find((item) => item.id === request.entityId);
  if (entity) {
    if (request.kind === "Load") {
      const statusMap: Partial<Record<BrokerRequestStatus, Freight["status"]>> = {
        "Confirmed": "Matched",
        "Assigned": "Matched",
        "In progress": "In-Transit",
        "Closed": "Delivered",
      };
      if (requestedStatus && statusMap[requestedStatus]) (entity as Freight).status = statusMap[requestedStatus] as Freight["status"];
    } else {
      const statusMap: Partial<Record<BrokerRequestStatus, string>> = {
        "Confirmed": "Booked",
        "Assigned": "Booked",
        "In progress": "En Route",
        "Closed": "Completed",
      };
      if (requestedStatus && statusMap[requestedStatus]) (entity as Trip).status = statusMap[requestedStatus] || entity.status;
    }
  }
  await persistDatabaseState();
  res.json(request);
});

router.post("/admin/requests/:id/offer", async (req, res) => {
  const user = adminUser(req, res);
  if (!user) return;
  const request = brokerRequests.find((item) => item.id === text(req.params.id));
  const matchId = text(req.body?.matchId);
  if (!request || !matchId) {
    res.status(400).json({ error: "Choose a broker request and a suggested match." });
    return;
  }
  if (!["Approved", "Matching", "Offer sent"].includes(request.status)) {
    res.status(409).json({ error: `Move this request to matching before sending an offer.` });
    return;
  }
  const suggestion = brokerMatchSuggestions(request).find((item) => item.id === matchId);
  if (!suggestion) {
    res.status(400).json({ error: "That match is no longer available for this request." });
    return;
  }
  request.proposedMatchId = matchId;
  request.status = "Offer sent";
  request.updatedAt = new Date().toISOString();
  recordAdminActivity(request, "Offer sent", `${suggestion.title} proposed to ${request.counterpart}.`, user.name);
  await persistDatabaseState();
  res.json({ request, suggestion });
});

router.post("/admin/requests/:id/assign", async (req, res) => {
  const user = adminUser(req, res);
  if (!user) return;
  const request = brokerRequests.find((item) => item.id === text(req.params.id));
  if (!request) {
    res.status(404).json({ error: "Broker request not found." });
    return;
  }
  if (!["Offer sent", "Confirmed"].includes(request.status)) {
    res.status(409).json({ error: "The request must have an active offer before it can be assigned." });
    return;
  }
  const matchId = text(req.body?.matchId) || request.proposedMatchId;
  if (!matchId) {
    res.status(400).json({ error: "Send an offer before creating an assignment." });
    return;
  }
  const suggestion = brokerMatchSuggestions(request).find((item) => item.id === matchId);
  if (!suggestion) {
    res.status(400).json({ error: "That match is no longer available for this request." });
    return;
  }
  const tripId = request.kind === "Load" ? matchId : request.entityId;
  const freightId = request.kind === "Load" ? request.entityId : matchId;
  const trip = trips.find((item) => item.id === tripId);
  const load = freight.find((item) => item.id === freightId);
  if (!trip || !load) {
    res.status(400).json({ error: "The selected trip or load is no longer available." });
    return;
  }
  const existingBooking = bookings.find((booking) => booking.tripId === trip.id || booking.freightId === load.id);
  if (existingBooking) {
    res.status(409).json({ error: "This trip or load is already assigned to a booking.", booking: existingBooking });
    return;
  }
  const amount = number(req.body?.amount) > 0 ? number(req.body.amount) : load.price || trip.price;
  const booking: Booking = {
    id: id("booking"),
    tripId: trip.id,
    freightId: load.id,
    corridor: load.corridor,
    originCountry: trip.originCountry,
    destinationCountry: load.dropoffCountry,
    amount,
    currency: currencyCode(req.body?.currency || load.currency || trip.currency),
    commissionAmount: Math.round(amount * 0.12),
    carrierPayout: Math.round(amount * 0.88),
    paymentStatus: "Unpaid",
    escrowStatus: "Pending",
    status: "En Route to Pickup",
    bookedAt: nowDate(),
    podStatus: "Not requested",
    podOtp: "4312",
  };
  bookings.unshift(booking);
  const counterpartRequest = brokerRequests.find((item) =>
    item.entityId === (request.kind === "Load" ? trip.id : load.id) &&
    item.kind !== request.kind,
  );
  for (const item of [request, counterpartRequest]) {
    if (!item) continue;
    item.status = "Assigned";
    item.proposedMatchId = item.kind === "Load" ? trip.id : load.id;
    item.bookingId = booking.id;
    item.updatedAt = new Date().toISOString();
  }
  trip.status = "Booked";
  load.status = "Matched";
  recordAdminActivity(request, "Booking confirmed", `${load.description} assigned to ${trip.carrier} by ${user.name}.`, user.name);
  if (counterpartRequest) {
    recordAdminActivity(counterpartRequest, "Booking confirmed", `${trip.vehicleType} assigned to ${load.shipper} by ${user.name}.`, user.name);
  }
  await persistDatabaseState();
  res.status(201).json({ booking, request, counterpartRequest });
});

router.get("/admin/summary", (req, res) => {
  const user = adminUser(req, res);
  if (!user) return;
  const gross = bookings.reduce((sum, booking) => sum + booking.amount, 0);
  res.json({
    users,
    verifications,
    revenue: Math.round(gross * 0.12),
    grossVolume: gross,
    activeBookings: bookings.filter((booking) => booking.status !== "Delivered").length,
    routes,
  });
});

export default router;