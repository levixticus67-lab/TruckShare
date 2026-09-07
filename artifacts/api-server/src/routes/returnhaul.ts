import { Router, type IRouter, type Request } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
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
  UpdateBookingStatusBody,
  UpdateBookingStatusParams,
} from "@workspace/api-zod";

type Trip = {
  id: string;
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

type User = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  country: CountryCode;
  role: "Carrier" | "Shipper" | "Admin";
  roles?: Array<"Carrier" | "Shipper">;
  verified: boolean;
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

const sessions = new Map<string, User>();
const otpRequestCooldowns = new Map<string, number>();
const OTP_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const id = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;
const nowDate = () => new Date().toISOString().slice(0, 10);
const number = (value: unknown) => typeof value === "number" ? value : Number(value);
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const stateKeys = ["trips", "freight", "bookings", "payments", "borderMilestones", "messages", "documents", "users", "verifications"] as const;
type StateKey = (typeof stateKeys)[number];
let stateReady: Promise<void> | undefined;

function stateValue(key: StateKey) {
  return JSON.stringify({ trips, freight, bookings, payments, borderMilestones, messages, documents, users, verifications }[key]);
}

function applyState(key: string, value: string) {
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
}

async function ensureDatabaseState() {
  if (!databaseConfigured) return;
  if (!stateReady) {
    stateReady = (async () => {
      const rows = await db.select().from(runtimeStateTable);
      if (rows.length === 0) {
        await db.insert(runtimeStateTable).values(stateKeys.map((key) => ({ key, value: stateValue(key) })));
        return;
      }
      for (const row of rows) applyState(row.key, row.value);
    })();
  }
  try {
    await stateReady;
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
  phone: string;
  country: CountryCode;
  mode: "login" | "signup";
  name?: string;
  role?: "Carrier" | "Shipper" | "Admin";
  roles?: Array<"Carrier" | "Shipper">;
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

function twilioVerifyConfiguration() {
  const accountSid = text(process.env.TWILIO_ACCOUNT_SID);
  const authToken = text(process.env.TWILIO_AUTH_TOKEN);
  const serviceSid = text(process.env.TWILIO_VERIFY_SERVICE_SID);
  return accountSid && authToken && serviceSid ? { accountSid, authToken, serviceSid } : undefined;
}

async function sendTwilioVerification(phone: string) {
  const config = twilioVerifyConfiguration();
  if (!config) return false;

  const endpoint = `https://verify.twilio.com/v2/Services/${encodeURIComponent(config.serviceSid)}/Verifications`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: phone, Channel: "sms" }),
  });
  return response.ok;
}

async function checkTwilioVerification(phone: string, code: string) {
  const config = twilioVerifyConfiguration();
  if (!config) return false;

  const endpoint = `https://verify.twilio.com/v2/Services/${encodeURIComponent(config.serviceSid)}/VerificationCheck`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: phone, Code: code }),
  });
  if (!response.ok) return false;
  const body = await response.json() as { status?: unknown };
  return body.status === "approved";
}

function configuredAdminPhones() {
  return (process.env.ADMIN_PHONES || "").split(",").map((phone) => phone.replace(/\s+/g, "")).filter(Boolean);
}

function isAdminPhone(phone: string) {
  return configuredAdminPhones().includes(phone);
}

function authenticatedUser(req: Request) {
  const token = text(req.headers.authorization).replace(/^Bearer\s+/i, "");
  return sessions.get(token);
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

router.post("/auth/request-otp", async (req, res) => {
  const phone = normalizePhone(text(req.body?.phone));
  const country = phoneCountry(phone);
  const mode = req.body?.mode === "login" ? "login" : "signup";
  const existingUser = users.find((user) => normalizePhone(user.phone || "") === phone);
  if (!country || !/^\+\d{8,15}$/.test(phone)) {
    res.status(400).json({ error: "Use a valid EAC number with a supported country code." });
    return;
  }
  if (mode === "login" && !existingUser) {
    res.status(404).json({ error: "No account exists for this phone number. Choose Create account first." });
    return;
  }
  if (mode === "signup" && existingUser) {
    res.status(409).json({ error: "An account already exists for this phone number. Choose Log in instead." });
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

  const lastRequestedAt = otpRequestCooldowns.get(phone) || 0;
  const retryAfterSeconds = Math.ceil((lastRequestedAt + OTP_RESEND_COOLDOWN_MS - Date.now()) / 1000);
  if (retryAfterSeconds > 0) {
    res.status(429).json({ error: `Please wait ${retryAfterSeconds}s before requesting another code.` });
    return;
  }

  if (!twilioVerifyConfiguration()) {
    res.status(503).json({ error: "Phone verification is not configured yet. Add the Twilio Verify secrets to the API service." });
    return;
  }

  const role = isAdminPhone(phone) ? "Admin" : roles.includes("Carrier") ? "Carrier" : "Shipper";
  try {
    const sent = await sendTwilioVerification(phone);
    if (!sent) {
      res.status(502).json({ error: "We could not send the verification code. Please try again." });
      return;
    }
    otpRequestCooldowns.set(phone, Date.now());
    res.json({
      challengeId: signChallenge({ phone, country, mode, name: name || undefined, role, roles }),
      phone,
      message: "We sent a verification code to your phone. It expires in 10 minutes.",
    });
  } catch {
    res.status(502).json({ error: "We could not send the verification code. Please try again." });
  }
});

router.post("/auth/account-status", (req, res) => {
  const phone = normalizePhone(text(req.body?.phone));
  const country = phoneCountry(phone);
  if (!country || !/^\+\d{8,15}$/.test(phone)) {
    res.status(400).json({ error: "Use a valid EAC number with a supported country code." });
    return;
  }
  res.json({ exists: users.some((user) => normalizePhone(user.phone || "") === phone) });
});

router.post("/auth/verify-otp", async (req, res) => {
  const challengeId = text(req.body?.challengeId);
  const challenge = readChallenge(challengeId);
  const otp = text(req.body?.otp).replace(/\D/g, "");
  if (!challenge || !/^\d{4,10}$/.test(otp)) {
    res.status(400).json({ error: "That OTP is not valid or has expired." });
    return;
  }
  try {
    if (!await checkTwilioVerification(challenge.phone, otp)) {
      res.status(400).json({ error: "That OTP is not valid or has expired." });
      return;
    }
  } catch {
    res.status(502).json({ error: "We could not verify that code. Please try again." });
    return;
  }

  const existingUser = users.find((user) => normalizePhone(user.phone || "") === challenge.phone);
  if (challenge.mode === "login" && !existingUser) {
    res.status(404).json({ error: "No account exists for this phone number. Choose Create account first." });
    return;
  }
  const user = existingUser || {
    id: id("user"),
    name: challenge.name || "New TruckShare user",
    phone: challenge.phone,
    country: challenge.country,
    role: challenge.role || "Carrier",
    roles: challenge.roles,
    verified: false,
  };
  if (isAdminPhone(challenge.phone)) {
    user.role = "Admin";
    user.roles = undefined;
  }
  if (!existingUser) users.push(user);
  const token = issueToken(user);
  sessions.set(token, user);
  await persistDatabaseState();
  res.json({ token, user });
});

router.post("/auth/google", async (req, res) => {
  const mode = req.body?.mode === "login" ? "login" : "signup";
  const existingUser = users.find((user) => user.email === "demo@truckshare.ug");
  if (mode === "login" && !existingUser) {
    res.status(404).json({ error: "No Google account exists yet. Choose Create account first." });
    return;
  }
  if (mode === "signup" && existingUser) {
    res.status(409).json({ error: "A Google account already exists. Choose Log in instead." });
    return;
  }
  const roles = requestedRoles(req.body?.roles);
  if (mode === "signup" && roles.length === 0) {
    res.status(400).json({ error: "Choose at least one account role." });
    return;
  }
  const user = existingUser || { id: id("user"), name: text(req.body?.name) || "Google workspace user", email: "demo@truckshare.ug", country: "UG", role: roles.includes("Carrier") ? "Carrier" : "Shipper", roles, verified: false };
  if (!existingUser) users.push(user);
  const token = issueToken(user);
  sessions.set(token, user);
  await persistDatabaseState();
  res.json({ token, user, simulated: true });
});

router.get("/auth/me", (req, res) => {
  res.json({ user: authenticatedUser(req) || null });
});

router.get("/trips", (req, res) => {
  const query = ListTripsQueryParams.parse(req.query);
  const filtered = trips.filter((trip) =>
    (!query.corridor || trip.corridor.toLowerCase().includes(query.corridor.toLowerCase())) &&
    (!query.date || trip.departureDate === query.date) &&
    (!query.vehicleType || trip.vehicleType === query.vehicleType),
  );
  res.json(ListTripsResponse.parse(filtered.map(tripWithLocations)));
});

router.post("/trips", async (req, res) => {
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
    carrier: "You",
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
  await persistDatabaseState();
  res.status(201).json(tripWithLocations(trip));
});

router.patch("/trips/:id", async (req, res) => {
  const params = UpdateTripParams.parse(req.params);
  const data = UpdateTripBody.parse(req.body);
  const trip = trips.find((item) => item.id === params.id);
  if (!trip) { res.status(404).json({ error: "Trip not found" }); return; }
  Object.assign(trip, data);
  trip.originLocation = submittedLocation(data.originLocation, trip.origin, trip.originCountry);
  trip.destinationLocation = submittedLocation(data.destinationLocation, trip.destination, trip.destinationCountry);
  trip.corridor = `${trip.origin.split(",")[0]} → ${trip.destination.split(",")[0]}`;
  await persistDatabaseState();
  res.json(UpdateTripResponse.parse(tripWithLocations(trip)));
});

router.get("/freight", (req, res) => {
  const query = ListFreightQueryParams.parse(req.query);
  res.json(ListFreightResponse.parse(freight.filter((load) =>
    (!query.corridor || load.corridor.toLowerCase().includes(query.corridor.toLowerCase())) &&
    (!query.date || load.pickupDate === query.date),
  ).map(freightWithLocations)));
});

router.post("/freight", async (req, res) => {
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
    shipper: "You",
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
  await persistDatabaseState();
  res.status(201).json(freightWithLocations(load));
});

router.patch("/freight/:id", async (req, res) => {
  const params = UpdateFreightParams.parse(req.params);
  const data = UpdateFreightBody.parse(req.body);
  const load = freight.find((item) => item.id === params.id);
  if (!load) { res.status(404).json({ error: "Freight request not found" }); return; }
  Object.assign(load, data);
  load.pickupLocation = submittedLocation(data.pickupLocation, load.pickup, load.pickupCountry);
  load.dropoffLocation = submittedLocation(data.dropoffLocation, load.dropoff, load.dropoffCountry);
  load.corridor = `${load.pickup.split(",")[0]} → ${load.dropoff.split(",")[0]}`;
  await persistDatabaseState();
  res.json(UpdateFreightResponse.parse(freightWithLocations(load)));
});

router.get("/matches", (req, res) => {
  const query = ListMatchesQueryParams.parse(req.query);
  const corridor = query.corridor?.toLowerCase();
  const result = query.mode === "carrier"
    ? freight.filter((load) => !corridor || load.corridor.toLowerCase().includes(corridor)).map((load) => ({ id: load.id, type: "freight", title: load.description, corridor: load.corridor, date: load.pickupDate, capacity: `${load.weightTons} tons · ${load.volumeM3} m³`, price: load.price, compatibility: 87, counterpart: load.shipper }))
    : trips.filter((trip) => !corridor || trip.corridor.toLowerCase().includes(corridor)).map((trip) => ({ id: trip.id, type: "trip", title: `${trip.vehicleType} · ${trip.capacityTons} tons available`, corridor: trip.corridor, date: trip.departureDate, capacity: `${trip.capacityTons} tons · ${trip.capacityM3} m³`, price: trip.price, compatibility: 92, counterpart: trip.carrier }));
  res.json(ListMatchesResponse.parse(result));
});

router.get("/bookings", (_req, res) => res.json(bookings));
router.post("/bookings", async (req, res) => {
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
    booking.escrowStatus = "Released";
    booking.podStatus = "Delivered";
    releaseHeldPayment(booking.id);
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
  booking.escrowStatus = "Released";
  booking.podStatus = "Delivered";
  booking.deliveryPhoto = text(req.body?.photoName) || undefined;
  releaseHeldPayment(booking.id);
  await persistDatabaseState();
  res.json({ booking, payoutUnlocked: true });
});

router.get("/payments", (_req, res) => {
  res.json(payments);
});

router.get("/payments/quote", (req, res) => {
  const amount = number(req.query.amount);
  if (!Number.isFinite(amount) || amount <= 0) { res.status(400).json({ error: "A positive amount is required." }); return; }
  const fromCurrency = currencyCode(req.query.fromCurrency || req.query.currency);
  const toCurrency = currencyCode(req.query.toCurrency);
  const rate = exchangeRate(fromCurrency, toCurrency);
  const settlementAmount = convertedAmount(amount, fromCurrency, toCurrency);
  const fee = Math.round(settlementAmount * 0.015);
  const commissionAmount = Math.round(settlementAmount * 0.12);
  res.json({
    quoteId: id("quote"),
    payerCountry: countryCode(req.query.payerCountry),
    payeeCountry: countryCode(req.query.payeeCountry),
    amount,
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
  const amount = number(req.body?.amount) > 0 ? number(req.body?.amount) : booking.amount;
  const settlementAmount = convertedAmount(amount, payerCurrency, settlementCurrency);
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

router.get("/admin/summary", (req, res) => {
  const user = authenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in with an admin account to view this area." });
    return;
  }
  if (user.role !== "Admin") {
    res.status(403).json({ error: "This area is restricted to admins." });
    return;
  }
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