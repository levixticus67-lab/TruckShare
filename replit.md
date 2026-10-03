# TruckShare UG

Cross-border and regional freight matching that turns carrier backhaul capacity into reliable, bookable loads for shippers across Uganda.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` â run the API server (port 5000)
- `pnpm run typecheck` â full typecheck across all packages
- `pnpm run build` â typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` â regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` â push DB schema changes (dev only)
- Required env: `DATABASE_URL` â Postgres connection string
- `FRONTEND_URL` â allowed browser origin for the API
- `JWT_SECRET` â signing secret for API sessions
- `FLW_SECRET_KEY` — Flutterwave API key for live collection and refunds; store it in deployment Secrets
- `FLW_SECRET_HASH` — Flutterwave webhook verification hash
- `FLW_REDIRECT_URL` — frontend return URL after checkout
- `VITE_API_URL` â API base URL for Netlify builds
- `DEV_ADMIN_ACCESS=true` â enables the development-only admin session when the API is not running with `NODE_ENV=production`; never enable this on a public production API
- `VITE_DEV_ADMIN_ACCESS=true` â shows the development admin button in a non-Vite-dev frontend build

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/returnhaul` â React/Vite dashboard and role portals
- `artifacts/api-server` â Express API and matching/booking routes
- `lib/api-spec/openapi.yaml` â source-of-truth API contract
- `lib/db/src/schema` â Neon/PostgreSQL-ready Drizzle schema

## Architecture decisions

- The client and API remain separate workspace artifacts so Netlify and Render can deploy independently.
- The API contract is OpenAPI-first and generates both React Query hooks and Zod validators.
- Calendar-only pickup and departure dates use `YYYY-MM-DD` strings to avoid timezone drift.
- Preview mode seeds realistic corridor data in the API process; Neon schema is ready for persistent deployment data.

## Product

- Carrier and shipper portals for posting trips and loads
- Corridor, capacity, and date matching
- Explicit EAC country, currency, and starter corridor reference data
- EAC phone-country onboarding and simulated Google onboarding
- Driver verification with NIN, license, and vehicle logbook review
- Cross-border settlement quote model with EAC currencies, fees, and payment ledger
- Booking with Flutterwave checkout/refunds and non-production simulation fallback; admin-controlled platform fee (12% initial default)
- Status tracking, receiver OTP proof of delivery, and payout unlock
- Escrow state machine: Pending â Held â Released, gated by payment and delivery proof
- Customs and border milestones with required-document tracking
- Negotiation messages, call links, and logistics document hub
- Uganda seed corridors: KampalaâMbale, KampalaâMbarara, KampalaâGulu, MalabaâKampala

## User preferences

_Populate as you build â explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build â sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
