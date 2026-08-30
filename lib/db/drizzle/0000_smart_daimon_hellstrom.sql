CREATE TABLE "returnhaul_bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"freight_id" text NOT NULL,
	"corridor" text NOT NULL,
	"amount" numeric NOT NULL,
	"commission_amount" numeric NOT NULL,
	"carrier_payout" numeric NOT NULL,
	"status" text DEFAULT 'En Route to Pickup' NOT NULL,
	"escrow_status" text DEFAULT 'Held' NOT NULL,
	"payment_status" text DEFAULT 'Unpaid' NOT NULL,
	"pod_status" text DEFAULT 'Not requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returnhaul_freight" (
	"id" text PRIMARY KEY NOT NULL,
	"shipper" text NOT NULL,
	"pickup" text NOT NULL,
	"dropoff" text NOT NULL,
	"corridor" text NOT NULL,
	"description" text NOT NULL,
	"cargo_type" text DEFAULT 'General cargo' NOT NULL,
	"weight_tons" numeric NOT NULL,
	"volume_m3" numeric DEFAULT '0' NOT NULL,
	"dimensions" text NOT NULL,
	"pickup_date" date NOT NULL,
	"price" numeric NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returnhaul_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text,
	"sender" text NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returnhaul_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"network" text NOT NULL,
	"phone" text NOT NULL,
	"amount" numeric NOT NULL,
	"commission_amount" numeric NOT NULL,
	"carrier_payout" numeric NOT NULL,
	"status" text DEFAULT 'Simulated' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returnhaul_trips" (
	"id" text PRIMARY KEY NOT NULL,
	"carrier" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"corridor" text NOT NULL,
	"departure_date" date NOT NULL,
	"departure_time" text DEFAULT '07:00' NOT NULL,
	"vehicle_type" text NOT NULL,
	"capacity_tons" numeric NOT NULL,
	"capacity_m3" numeric NOT NULL,
	"price" numeric NOT NULL,
	"price_type" text NOT NULL,
	"status" text DEFAULT 'Available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returnhaul_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"role" text DEFAULT 'Carrier' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returnhaul_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"nin" text NOT NULL,
	"license_number" text NOT NULL,
	"logbook_number" text NOT NULL,
	"logbook_photo_url" text,
	"status" text DEFAULT 'Pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
