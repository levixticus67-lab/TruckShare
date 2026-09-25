CREATE TABLE "returnhaul_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" text NOT NULL,
	"size" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "returnhaul_bookings" ADD COLUMN "payment_network" text;--> statement-breakpoint
ALTER TABLE "returnhaul_bookings" ADD COLUMN "pod_otp" text DEFAULT '4312' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_bookings" ADD COLUMN "delivery_photo" text;--> statement-breakpoint
ALTER TABLE "returnhaul_messages" ADD COLUMN "sent_at" text NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_trips" ADD COLUMN "carrier_rating" numeric DEFAULT '5' NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_verifications" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "returnhaul_verifications" ADD COLUMN "phone" text DEFAULT '' NOT NULL;