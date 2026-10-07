# TruckShare UG

Cross-border and regional freight matching that turns carrier backhaul capacity into reliable, bookable loads for shippers across Uganda.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required production env:
- `DATABASE_URL` — Neon PostgreSQL connection string; configure on the Render API service
- `FRONTEND_URL` — production Vercel origin allowed by the Render API's CORS policy
- `JWT_SECRET` — strong signing secret configured on Render
- `FLW_SECRET_KEY` — Flutterwave live API secret; Render only, never expose to Vercel
- `FLW_SECRET_HASH` — Flutterwave webhook verification hash; Render only
- `FLW_REDIRECT_URL` — Vercel payment-return URL (add the return/status page before using live checkout)
- `VITE_API_URL` — Render API URL for Vercel builds; include the `/api` prefix
- `DEV_ADMIN_ACCESS=true` — enables the development-only admin session when the API is not running with `NODE_ENV=production`; never enable this on a public production API
- `VITE_DEV_ADMIN_ACCESS=true` — shows the development admin button in a non-Vite-dev frontend build; never enable for a public production Vercel deployment

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/returnhaul` — React/Vite dashboard and role portals
- `artifacts/api-server` — Express API and matching/booking routes
- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `lib/db/src/schema` — Neon/PostgreSQL-ready Drizzle schema

## Architecture decisions

- The client and API remain separate workspace artifacts so Vercel and Render can deploy independently.
- The API contract is OpenAPI-first and generates both React Query hooks and Zod validators.
- Calendar-only pickup and departure dates use `YYYY-MM-DD` strings to avoid timezone drift.
- The API initializes transactional collections empty. On startup, it removes only the exact known legacy demo IDs from persisted state and keeps unrelated user records.
- Country, currency, location, and supported-corridor lists are configuration/reference data, not sample transactions.

## Product

- Carrier and shipper portals for posting trips and loads
- Corridor, capacity, and date matching
- Explicit EAC country, currency, and starter corridor reference data
- EAC phone-country onboarding and simulated Google onboarding
- Driver verification with NIN, license, and vehicle logbook review
- Cross-border settlement quote model with EAC currencies, fees, and payment ledger
- Booking with MTN MoMo / Airtel Money simulation and 12% / 88% split
- Status tracking, receiver OTP proof of delivery, and payout unlock
- Escrow state machine: Pending → Held → Released, gated by payment and delivery proof
- Customs and border milestones with required-document tracking
- Negotiation messages, call links, and logistics document hub
- Uganda corridor options are configuration data; trips, freight, bookings, payments, messages, and documents come from user actions.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
