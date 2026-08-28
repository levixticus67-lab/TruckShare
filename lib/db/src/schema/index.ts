// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

import { boolean, date, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tripsTable = pgTable("returnhaul_trips", {
  id: text("id").primaryKey(),
  carrier: text("carrier").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  corridor: text("corridor").notNull(),
  departureDate: date("departure_date", { mode: "string" }).notNull(),
  departureTime: text("departure_time").notNull().default("07:00"),
  vehicleType: text("vehicle_type").notNull(),
  capacityTons: numeric("capacity_tons").notNull(),
  capacityM3: numeric("capacity_m3").notNull(),
  price: numeric("price").notNull(),
  priceType: text("price_type").notNull(),
  status: text("status").notNull().default("Available"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const freightTable = pgTable("returnhaul_freight", {
  id: text("id").primaryKey(),
  shipper: text("shipper").notNull(),
  pickup: text("pickup").notNull(),
  dropoff: text("dropoff").notNull(),
  corridor: text("corridor").notNull(),
  description: text("description").notNull(),
  cargoType: text("cargo_type").notNull().default("General cargo"),
  weightTons: numeric("weight_tons").notNull(),
  volumeM3: numeric("volume_m3").notNull().default("0"),
  dimensions: text("dimensions").notNull(),
  pickupDate: date("pickup_date", { mode: "string" }).notNull(),
  price: numeric("price").notNull(),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersTable = pgTable("returnhaul_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  role: text("role").notNull().default("Carrier"),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verificationsTable = pgTable("returnhaul_verifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  nin: text("nin").notNull(),
  licenseNumber: text("license_number").notNull(),
  logbookNumber: text("logbook_number").notNull(),
  logbookPhotoUrl: text("logbook_photo_url"),
  status: text("status").notNull().default("Pending"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookingsTable = pgTable("returnhaul_bookings", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull(),
  freightId: text("freight_id").notNull(),
  corridor: text("corridor").notNull(),
  amount: numeric("amount").notNull(),
  commissionAmount: numeric("commission_amount").notNull(),
  carrierPayout: numeric("carrier_payout").notNull(),
  status: text("status").notNull().default("En Route to Pickup"),
  escrowStatus: text("escrow_status").notNull().default("Held"),
  paymentStatus: text("payment_status").notNull().default("Unpaid"),
  podStatus: text("pod_status").notNull().default("Not requested"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentsTable = pgTable("returnhaul_payments", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  network: text("network").notNull(),
  phone: text("phone").notNull(),
  amount: numeric("amount").notNull(),
  commissionAmount: numeric("commission_amount").notNull(),
  carrierPayout: numeric("carrier_payout").notNull(),
  status: text("status").notNull().default("Simulated"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messagesTable = pgTable("returnhaul_messages", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id"),
  sender: text("sender").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripSchema = createInsertSchema(tripsTable).omit({ createdAt: true });
export const insertFreightSchema = createInsertSchema(freightTable).omit({ createdAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export const insertVerificationSchema = createInsertSchema(verificationsTable).omit({ createdAt: true, reviewedAt: true });
export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ createdAt: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ createdAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof tripsTable.$inferSelect;
export type InsertFreight = z.infer<typeof insertFreightSchema>;
export type Freight = typeof freightTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Verification = typeof verificationsTable.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;