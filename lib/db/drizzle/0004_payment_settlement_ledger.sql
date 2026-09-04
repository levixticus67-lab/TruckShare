ALTER TABLE "returnhaul_payments" ADD COLUMN "payer_country" text DEFAULT 'UG' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_payments" ADD COLUMN "payee_country" text DEFAULT 'UG' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_payments" ADD COLUMN "currency" text DEFAULT 'UGX' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_payments" ADD COLUMN "settlement_amount" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_payments" ADD COLUMN "settlement_currency" text DEFAULT 'UGX' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_payments" ADD COLUMN "exchange_rate" numeric DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_payments" ADD COLUMN "fee" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_payments" ADD COLUMN "reference" text DEFAULT '' NOT NULL;