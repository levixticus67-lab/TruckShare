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

import { date, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tripsTable = pgTable("returnhaul_trips", {
  id: text("id").primaryKey(),
  carrier: text("carrier").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  corridor: text("corridor").notNull(),
  departureDate: date("departure_date", { mode: "string" }).notNull(),
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
  weightTons: numeric("weight_tons").notNull(),
  dimensions: text("dimensions").notNull(),
  pickupDate: date("pickup_date", { mode: "string" }).notNull(),
  price: numeric("price").notNull(),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripSchema = createInsertSchema(tripsTable).omit({ createdAt: true });
export const insertFreightSchema = createInsertSchema(freightTable).omit({ createdAt: true });
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof tripsTable.$inferSelect;
export type InsertFreight = z.infer<typeof insertFreightSchema>;
export type Freight = typeof freightTable.$inferSelect;