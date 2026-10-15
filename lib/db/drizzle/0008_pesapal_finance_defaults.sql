ALTER TABLE "returnhaul_finance_payouts" ALTER COLUMN "provider" SET DEFAULT 'simulation';--> statement-breakpoint
ALTER TABLE "returnhaul_finance_webhook_events" ALTER COLUMN "provider" SET DEFAULT 'pesapal';--> statement-breakpoint
ALTER TABLE "returnhaul_finance_reconciliations" ALTER COLUMN "provider" SET DEFAULT 'pesapal';
