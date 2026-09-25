CREATE TABLE "returnhaul_border_milestones" (
"id" text PRIMARY KEY NOT NULL,
"booking_id" text NOT NULL,
"sequence" integer NOT NULL,
"checkpoint" text NOT NULL,
"country" text DEFAULT 'UG' NOT NULL,
"border" text NOT NULL,
"required_documents" text DEFAULT '[]' NOT NULL,
"status" text DEFAULT 'Planned' NOT NULL,
"completed_at" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);