CREATE TABLE IF NOT EXISTS "returnhaul_finance_invoices" (
  "id" text PRIMARY KEY NOT NULL,
  "booking_id" text NOT NULL,
  "invoice_number" text NOT NULL,
  "gross_amount" numeric NOT NULL,
  "currency" text DEFAULT 'UGX' NOT NULL,
  "platform_fee" numeric DEFAULT '0' NOT NULL,
  "provider_fee" numeric DEFAULT '0' NOT NULL,
  "tax_amount" numeric DEFAULT '0' NOT NULL,
  "total_amount" numeric NOT NULL,
  "status" text DEFAULT 'Issued' NOT NULL,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "returnhaul_finance_ledger_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "booking_id" text NOT NULL,
  "payment_id" text,
  "payout_id" text,
  "refund_id" text,
  "account" text NOT NULL,
  "entry_type" text NOT NULL,
  "direction" text NOT NULL,
  "amount" numeric NOT NULL,
  "currency" text DEFAULT 'UGX' NOT NULL,
  "reference" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "returnhaul_finance_payouts" (
  "id" text PRIMARY KEY NOT NULL,
  "booking_id" text NOT NULL,
  "payment_id" text,
  "recipient_name" text NOT NULL,
  "recipient_country" text DEFAULT 'UG' NOT NULL,
  "network" text NOT NULL,
  "account_reference" text NOT NULL,
  "amount" numeric NOT NULL,
  "currency" text DEFAULT 'UGX' NOT NULL,
  "provider" text DEFAULT 'simulation' NOT NULL,
  "provider_transfer_id" text,
  "status" text DEFAULT 'Pending Release' NOT NULL,
  "release_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "returnhaul_finance_refunds" (
  "id" text PRIMARY KEY NOT NULL,
  "booking_id" text NOT NULL,
  "payment_id" text NOT NULL,
  "amount" numeric NOT NULL,
  "currency" text DEFAULT 'UGX' NOT NULL,
  "reason" text NOT NULL,
  "provider_refund_id" text,
  "status" text DEFAULT 'Pending' NOT NULL,
  "requested_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "returnhaul_finance_webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text DEFAULT 'pesapal' NOT NULL,
  "event_type" text NOT NULL,
  "provider_event_id" text NOT NULL,
  "signature" text,
  "payload" text NOT NULL,
  "status" text DEFAULT 'Received' NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "returnhaul_finance_reconciliations" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text DEFAULT 'pesapal' NOT NULL,
  "settlement_reference" text NOT NULL,
  "currency" text DEFAULT 'UGX' NOT NULL,
  "settled_amount" numeric NOT NULL,
  "expected_amount" numeric NOT NULL,
  "variance" numeric DEFAULT '0' NOT NULL,
  "status" text DEFAULT 'Open' NOT NULL,
  "reviewed_by" text,
  "notes" text,
  "settled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "returnhaul_finance_ledger_idempotency_idx" ON "returnhaul_finance_ledger_entries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "returnhaul_finance_webhook_provider_event_idx" ON "returnhaul_finance_webhook_events" USING btree ("provider", "provider_event_id");--> statement-breakpoint
ALTER TABLE "returnhaul_finance_payouts" ALTER COLUMN "provider" SET DEFAULT 'simulation';--> statement-breakpoint
ALTER TABLE "returnhaul_finance_webhook_events" ALTER COLUMN "provider" SET DEFAULT 'pesapal';--> statement-breakpoint
ALTER TABLE "returnhaul_finance_reconciliations" ALTER COLUMN "provider" SET DEFAULT 'pesapal';
