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

import { boolean, date, integer, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tripsTable = pgTable("returnhaul_trips", {
  id: text("id").primaryKey(),
  carrier: text("carrier").notNull(),
  carrierRating: numeric("carrier_rating").notNull().default("5"),
  origin: text("origin").notNull(),
  originCountry: text("origin_country").notNull().default("UG"),
  destination: text("destination").notNull(),
  destinationCountry: text("destination_country").notNull().default("UG"),
  corridor: text("corridor").notNull(),
  departureDate: date("departure_date", { mode: "string" }).notNull(),
  departureTime: text("departure_time").notNull().default("07:00"),
  vehicleType: text("vehicle_type").notNull(),
  capacityTons: numeric("capacity_tons").notNull(),
  capacityM3: numeric("capacity_m3").notNull(),
  price: numeric("price").notNull(),
  currency: text("currency").notNull().default("UGX"),
  priceType: text("price_type").notNull(),
  status: text("status").notNull().default("Available"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const freightTable = pgTable("returnhaul_freight", {
  id: text("id").primaryKey(),
  shipper: text("shipper").notNull(),
  pickup: text("pickup").notNull(),
  pickupCountry: text("pickup_country").notNull().default("UG"),
  dropoff: text("dropoff").notNull(),
  dropoffCountry: text("dropoff_country").notNull().default("UG"),
  corridor: text("corridor").notNull(),
  description: text("description").notNull(),
  cargoType: text("cargo_type").notNull().default("General cargo"),
  weightTons: numeric("weight_tons").notNull(),
  volumeM3: numeric("volume_m3").notNull().default("0"),
  dimensions: text("dimensions").notNull(),
  pickupDate: date("pickup_date", { mode: "string" }).notNull(),
  price: numeric("price").notNull(),
  currency: text("currency").notNull().default("UGX"),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersTable = pgTable("returnhaul_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  country: text("country").notNull().default("UG"),
  role: text("role").notNull().default("Carrier"),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verificationsTable = pgTable("returnhaul_verifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
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
  originCountry: text("origin_country").notNull().default("UG"),
  destinationCountry: text("destination_country").notNull().default("UG"),
  amount: numeric("amount").notNull(),
  currency: text("currency").notNull().default("UGX"),
  commissionAmount: numeric("commission_amount").notNull(),
  carrierPayout: numeric("carrier_payout").notNull(),
  status: text("status").notNull().default("En Route to Pickup"),
  escrowStatus: text("escrow_status").notNull().default("Held"),
  paymentStatus: text("payment_status").notNull().default("Unpaid"),
  paymentNetwork: text("payment_network"),
  podStatus: text("pod_status").notNull().default("Not requested"),
  podOtp: text("pod_otp").notNull().default("4312"),
  deliveryPhoto: text("delivery_photo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentsTable = pgTable("returnhaul_payments", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  network: text("network").notNull(),
  phone: text("phone").notNull(),
  payerCountry: text("payer_country").notNull().default("UG"),
  payeeCountry: text("payee_country").notNull().default("UG"),
  amount: numeric("amount").notNull(),
  currency: text("currency").notNull().default("UGX"),
  settlementAmount: numeric("settlement_amount").notNull().default("0"),
  settlementCurrency: text("settlement_currency").notNull().default("UGX"),
  exchangeRate: numeric("exchange_rate").notNull().default("1"),
  commissionAmount: numeric("commission_amount").notNull(),
  carrierPayout: numeric("carrier_payout").notNull(),
  fee: numeric("fee").notNull().default("0"),
  reference: text("reference").notNull().default(""),
  providerTransactionId: text("provider_transaction_id"),
  providerStatus: text("provider_status"),
  status: text("status").notNull().default("Simulated"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const financeInvoicesTable = pgTable("returnhaul_finance_invoices", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  grossAmount: numeric("gross_amount").notNull(),
  currency: text("currency").notNull().default("UGX"),
  platformFee: numeric("platform_fee").notNull().default("0"),
  providerFee: numeric("provider_fee").notNull().default("0"),
  taxAmount: numeric("tax_amount").notNull().default("0"),
  totalAmount: numeric("total_amount").notNull(),
  status: text("status").notNull().default("Issued"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const financeLedgerEntriesTable = pgTable("returnhaul_finance_ledger_entries", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  paymentId: text("payment_id"),
  payoutId: text("payout_id"),
  refundId: text("refund_id"),
  account: text("account").notNull(),
  entryType: text("entry_type").notNull(),
  direction: text("direction").notNull(),
  amount: numeric("amount").notNull(),
  currency: text("currency").notNull().default("UGX"),
  reference: text("reference").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idempotencyKeyIndex: uniqueIndex("returnhaul_finance_ledger_idempotency_idx").on(table.idempotencyKey),
}));

export const financePayoutsTable = pgTable("returnhaul_finance_payouts", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  paymentId: text("payment_id"),
  recipientName: text("recipient_name").notNull(),
  recipientCountry: text("recipient_country").notNull().default("UG"),
  network: text("network").notNull(),
  accountReference: text("account_reference").notNull(),
  amount: numeric("amount").notNull(),
  currency: text("currency").notNull().default("UGX"),
  provider: text("provider").notNull().default("flutterwave"),
  providerTransferId: text("provider_transfer_id"),
  status: text("status").notNull().default("Pending Release"),
  releaseReason: text("release_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const financeRefundsTable = pgTable("returnhaul_finance_refunds", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  paymentId: text("payment_id").notNull(),
  amount: numeric("amount").notNull(),
  currency: text("currency").notNull().default("UGX"),
  reason: text("reason").notNull(),
  providerRefundId: text("provider_refund_id"),
  status: text("status").notNull().default("Pending"),
  requestedBy: text("requested_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const financeWebhookEventsTable = pgTable("returnhaul_finance_webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().default("flutterwave"),
  eventType: text("event_type").notNull(),
  providerEventId: text("provider_event_id").notNull(),
  signature: text("signature"),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("Received"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => ({
  providerEventIndex: uniqueIndex("returnhaul_finance_webhook_provider_event_idx").on(table.provider, table.providerEventId),
}));

export const financeReconciliationsTable = pgTable("returnhaul_finance_reconciliations", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().default("flutterwave"),
  settlementReference: text("settlement_reference").notNull(),
  currency: text("currency").notNull().default("UGX"),
  settledAmount: numeric("settled_amount").notNull(),
  expectedAmount: numeric("expected_amount").notNull(),
  variance: numeric("variance").notNull().default("0"),
  status: text("status").notNull().default("Open"),
  reviewedBy: text("reviewed_by"),
  notes: text("notes"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const borderMilestonesTable = pgTable("returnhaul_border_milestones", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  sequence: integer("sequence").notNull(),
  checkpoint: text("checkpoint").notNull(),
  country: text("country").notNull().default("UG"),
  border: text("border").notNull(),
  requiredDocuments: text("required_documents").notNull().default("[]"),
  status: text("status").notNull().default("Planned"),
  completedAt: text("completed_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messagesTable = pgTable("returnhaul_messages", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id"),
  sender: text("sender").notNull(),
  body: text("body").notNull(),
  sentAt: text("sent_at").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentsTable = pgTable("returnhaul_documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
  size: text("size").notNull(),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runtimeStateTable = pgTable("returnhaul_runtime_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripSchema = createInsertSchema(tripsTable).omit({ createdAt: true });
export const insertFreightSchema = createInsertSchema(freightTable).omit({ createdAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export const insertVerificationSchema = createInsertSchema(verificationsTable).omit({ createdAt: true, reviewedAt: true });
export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ createdAt: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ createdAt: true });
export const insertFinanceInvoiceSchema = createInsertSchema(financeInvoicesTable).omit({ issuedAt: true });
export const insertFinanceLedgerEntrySchema = createInsertSchema(financeLedgerEntriesTable).omit({ createdAt: true });
export const insertFinancePayoutSchema = createInsertSchema(financePayoutsTable).omit({ createdAt: true, completedAt: true });
export const insertFinanceRefundSchema = createInsertSchema(financeRefundsTable).omit({ createdAt: true, completedAt: true });
export const insertFinanceWebhookEventSchema = createInsertSchema(financeWebhookEventsTable).omit({ receivedAt: true, processedAt: true });
export const insertFinanceReconciliationSchema = createInsertSchema(financeReconciliationsTable).omit({ createdAt: true });
export const insertBorderMilestoneSchema = createInsertSchema(borderMilestonesTable).omit({ createdAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });
export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ createdAt: true });
export const insertRuntimeStateSchema = createInsertSchema(runtimeStateTable).omit({ updatedAt: true });
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
export type InsertFinanceInvoice = z.infer<typeof insertFinanceInvoiceSchema>;
export type FinanceInvoice = typeof financeInvoicesTable.$inferSelect;
export type InsertFinanceLedgerEntry = z.infer<typeof insertFinanceLedgerEntrySchema>;
export type FinanceLedgerEntry = typeof financeLedgerEntriesTable.$inferSelect;
export type InsertFinancePayout = z.infer<typeof insertFinancePayoutSchema>;
export type FinancePayout = typeof financePayoutsTable.$inferSelect;
export type InsertFinanceRefund = z.infer<typeof insertFinanceRefundSchema>;
export type FinanceRefund = typeof financeRefundsTable.$inferSelect;
export type InsertFinanceWebhookEvent = z.infer<typeof insertFinanceWebhookEventSchema>;
export type FinanceWebhookEvent = typeof financeWebhookEventsTable.$inferSelect;
export type InsertFinanceReconciliation = z.infer<typeof insertFinanceReconciliationSchema>;
export type FinanceReconciliation = typeof financeReconciliationsTable.$inferSelect;
export type InsertBorderMilestone = z.infer<typeof insertBorderMilestoneSchema>;
export type BorderMilestone = typeof borderMilestonesTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
export type InsertRuntimeState = z.infer<typeof insertRuntimeStateSchema>;
export type RuntimeState = typeof runtimeStateTable.$inferSelect;