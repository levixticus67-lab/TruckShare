ALTER TABLE "returnhaul_trips" ADD COLUMN "origin_country" text DEFAULT 'UG' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_trips" ADD COLUMN "destination_country" text DEFAULT 'UG' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_trips" ADD COLUMN "currency" text DEFAULT 'UGX' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_freight" ADD COLUMN "pickup_country" text DEFAULT 'UG' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_freight" ADD COLUMN "dropoff_country" text DEFAULT 'UG' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_freight" ADD COLUMN "currency" text DEFAULT 'UGX' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_bookings" ADD COLUMN "origin_country" text DEFAULT 'UG' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_bookings" ADD COLUMN "destination_country" text DEFAULT 'UG' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_bookings" ADD COLUMN "currency" text DEFAULT 'UGX' NOT NULL;