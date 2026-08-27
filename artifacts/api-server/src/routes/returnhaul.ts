import { Router, type IRouter } from "express";
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
  id: string; carrier: string; carrierRating: number; origin: string; destination: string;
  corridor: string; departureDate: string; vehicleType: string; capacityTons: number;
  capacityM3: number; price: number; priceType: "Fixed" | "Per Ton"; status: string;
};
type Freight = {
  id: string; shipper: string; pickup: string; dropoff: string; corridor: string;
  description: string; weightTons: number; dimensions: string; pickupDate: string;
  price: number; status: "Pending" | "Matched" | "In-Transit" | "Delivered";
};

const trips: Trip[] = [
  { id: "trip-1", carrier: "Moses K.", carrierRating: 4.9, origin: "Kampala", destination: "Mbale", corridor: "Kampala → Mbale", departureDate: "2026-08-28", vehicleType: "Fuso", capacityTons: 8, capacityM3: 42, price: 680, priceType: "Fixed", status: "Available" },
  { id: "trip-2", carrier: "Amina Logistics", carrierRating: 4.8, origin: "Kampala", destination: "Mbarara", corridor: "Kampala → Mbarara", departureDate: "2026-08-30", vehicleType: "Canter", capacityTons: 6, capacityM3: 30, price: 520, priceType: "Per Ton", status: "Available" },
  { id: "trip-3", carrier: "Thabo Transport", carrierRating: 4.7, origin: "Malaba", destination: "Kampala", corridor: "Malaba → Kampala", departureDate: "2026-09-02", vehicleType: "Trailer", capacityTons: 18, capacityM3: 70, price: 1560, priceType: "Fixed", status: "Booked" },
  { id: "trip-4", carrier: "Gulu North Haulage", carrierRating: 4.6, origin: "Kampala", destination: "Gulu", corridor: "Kampala → Gulu", departureDate: "2026-09-04", vehicleType: "Flatbed", capacityTons: 14, capacityM3: 62, price: 980, priceType: "Fixed", status: "Available" },
];
const freight: Freight[] = [
  { id: "load-1", shipper: "Kampala Grain Co.", pickup: "Kampala", dropoff: "Mbale", corridor: "Kampala → Mbale", description: "Bagged grain and packaged food", weightTons: 4.5, dimensions: "12 pallets · 18 m³", pickupDate: "2026-08-28", price: 540, status: "Pending" },
  { id: "load-2", shipper: "Mara Pharma", pickup: "Kampala", dropoff: "Mbarara", corridor: "Kampala → Mbarara", description: "Temperature-sensitive pharmaceuticals", weightTons: 3, dimensions: "8 crates · 12 m³", pickupDate: "2026-08-30", price: 420, status: "Matched" },
  { id: "load-3", shipper: "Eastline Hardware", pickup: "Malaba", dropoff: "Kampala", corridor: "Malaba → Kampala", description: "Hardware and steel components", weightTons: 14, dimensions: "Oversize · 48 m³", pickupDate: "2026-09-02", price: 1320, status: "In-Transit" },
  { id: "load-4", shipper: "Northern Fresh", pickup: "Kampala", dropoff: "Gulu", corridor: "Kampala → Gulu", description: "Fresh produce and cold-chain cartons", weightTons: 9, dimensions: "20 pallets · 40 m³", pickupDate: "2026-09-04", price: 860, status: "Pending" },
];
const bookings: Array<{ id: string; tripId: string; freightId: string; corridor: string; amount: number; escrowStatus: "Held" | "Released"; status: string; bookedAt: string }> = [{ id: "booking-1", tripId: "trip-3", freightId: "load-3", corridor: "Malaba → Kampala", amount: 1320, escrowStatus: "Held", status: "At Border", bookedAt: "2026-08-22" }];
const messages = [
  { id: "msg-1", sender: "Kivu Foods", body: "Hi Moses, can you confirm the pickup window at our Kampala warehouse?", sentAt: "09:42", read: true },
  { id: "msg-2", sender: "You", body: "Confirmed. I’ll be there between 08:00 and 09:00 on Friday.", sentAt: "09:47", read: true },
  { id: "msg-3", sender: "Kivu Foods", body: "Perfect. The consignment note is ready in the documents hub.", sentAt: "09:49", read: false },
];
const documents = [
  { id: "doc-1", name: "Consignment note — SteelCraft", type: "Consignment note", uploadedBy: "SteelCraft Africa", uploadedAt: "Aug 22, 2026", size: "1.8 MB", status: "Verified" },
  { id: "doc-2", name: "Customs clearance — Maputo", type: "Customs form", uploadedBy: "Thabo Transport", uploadedAt: "Aug 22, 2026", size: "842 KB", status: "Pending" },
];

const router: IRouter = Router();
const id = (prefix: string) => `${prefix}-${Date.now()}`;

router.get("/dashboard", (_req, res) => {
  res.json(GetDashboardResponse.parse({ activeTrips: 12, availableLoads: 28, inTransit: 7, delivered: 46, totalEscrow: 28460, matchRate: 87, recentActivity: [
    { id: "activity-1", label: "New match found", detail: "Kampala → Nairobi · 87% compatible", time: "12 min ago", tone: "blue" },
    { id: "activity-2", label: "Escrow funded", detail: "SteelCraft Africa · $1,320", time: "1 hr ago", tone: "green" },
    { id: "activity-3", label: "Document uploaded", detail: "Customs clearance — Maputo", time: "3 hrs ago", tone: "amber" },
  ] }));
});

router.get("/trips", (req, res) => {
  const query = ListTripsQueryParams.parse(req.query);
  const filtered = trips.filter((trip) => (!query.corridor || trip.corridor.toLowerCase().includes(query.corridor.toLowerCase())) && (!query.date || trip.departureDate === query.date) && (!query.vehicleType || trip.vehicleType === query.vehicleType));
  res.json(ListTripsResponse.parse(filtered));
});
router.post("/trips", (req, res) => {
  const data = CreateTripBody.parse(req.body);
  const trip: Trip = { ...data, id: id("trip"), carrier: "You", carrierRating: 5, corridor: `${data.origin.split(",")[0]} → ${data.destination.split(",")[0]}`, priceType: data.priceType as Trip["priceType"], vehicleType: data.vehicleType, status: "Available" };
  trips.unshift(trip);
  res.status(201).json(trip);
});
router.patch("/trips/:id", (req, res) => {
  const params = UpdateTripParams.parse(req.params);
  const data = UpdateTripBody.parse(req.body);
  const trip = trips.find((item) => item.id === params.id);
  if (!trip) { res.status(404).json({ error: "Trip not found" }); return; }
  Object.assign(trip, data);
  trip.corridor = `${trip.origin.split(",")[0]} → ${trip.destination.split(",")[0]}`;
  res.json(UpdateTripResponse.parse(trip));
});
router.get("/freight", (req, res) => {
  const query = ListFreightQueryParams.parse(req.query);
  res.json(ListFreightResponse.parse(freight.filter((load) => (!query.corridor || load.corridor.toLowerCase().includes(query.corridor.toLowerCase())) && (!query.date || load.pickupDate === query.date))));
});
router.post("/freight", (req, res) => {
  const data = CreateFreightBody.parse(req.body);
  const load = { ...data, id: id("load"), shipper: "You", corridor: `${data.pickup.split(",")[0]} → ${data.dropoff.split(",")[0]}`, status: "Pending" as const };
  freight.unshift(load);
  res.status(201).json(load);
});
router.patch("/freight/:id", (req, res) => {
  const params = UpdateFreightParams.parse(req.params);
  const data = UpdateFreightBody.parse(req.body);
  const load = freight.find((item) => item.id === params.id);
  if (!load) { res.status(404).json({ error: "Freight request not found" }); return; }
  Object.assign(load, data);
  load.corridor = `${load.pickup.split(",")[0]} → ${load.dropoff.split(",")[0]}`;
  res.json(UpdateFreightResponse.parse(load));
});
router.get("/matches", (req, res) => {
  const query = ListMatchesQueryParams.parse(req.query);
  const corridor = query.corridor?.toLowerCase();
  const result = query.mode === "carrier"
    ? freight.filter((load) => !corridor || load.corridor.toLowerCase().includes(corridor)).map((load) => ({ id: load.id, type: "freight", title: load.description, corridor: load.corridor, date: load.pickupDate, capacity: `${load.weightTons} tons · ${load.dimensions}`, price: load.price, compatibility: 87, counterpart: load.shipper }))
    : trips.filter((trip) => !corridor || trip.corridor.toLowerCase().includes(corridor)).map((trip) => ({ id: trip.id, type: "trip", title: `${trip.vehicleType} · ${trip.capacityTons} tons available`, corridor: trip.corridor, date: trip.departureDate, capacity: `${trip.capacityTons} tons · ${trip.capacityM3} m³`, price: trip.price, compatibility: 92, counterpart: trip.carrier }));
  res.json(ListMatchesResponse.parse(result));
});
router.get("/bookings", (_req, res) => res.json(ListBookingsResponse.parse(bookings)));
router.post("/bookings", (req, res) => { const data = CreateBookingBody.parse(req.body); const booking = { ...data, id: id("booking"), escrowStatus: "Held" as const, status: "En Route to Pickup", bookedAt: new Date().toISOString().slice(0, 10) }; bookings.unshift(booking); res.status(201).json(booking); });
router.patch("/bookings/:id/status", (req, res) => { const params = UpdateBookingStatusParams.parse(req.params); const data = UpdateBookingStatusBody.parse(req.body); const booking = bookings.find((item) => item.id === params.id); if (!booking) { res.status(404).json({ error: "Booking not found" }); return; } booking.status = data.status; if (data.status === "Delivered") booking.escrowStatus = "Released"; res.json(booking); });
router.get("/messages", (_req, res) => res.json(ListMessagesResponse.parse(messages)));
router.post("/messages", (req, res) => { const data = CreateMessageBody.parse(req.body); const message = { ...data, id: id("msg"), sender: "You", sentAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), read: true }; messages.push(message); res.status(201).json(message); });
router.get("/documents", (_req, res) => res.json(ListDocumentsResponse.parse(documents)));
router.post("/documents", (req, res) => { const data = CreateDocumentBody.parse(req.body); const document = { ...data, id: id("doc"), uploadedBy: "You", uploadedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), status: "Pending" as const }; documents.unshift(document); res.status(201).json(document); });

export default router;