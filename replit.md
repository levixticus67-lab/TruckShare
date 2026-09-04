# TruckShare UG

Cross-border and regional freight matching that turns carrier backhaul capacity into reliable, bookable loads for shippers across Uganda.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- `FRONTEND_URL` — allowed browser origin for the API
- `JWT_SECRET` — signing secret for API sessions
- `VITE_API_URL` — API base URL for Netlify builds

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

- The client and API remain separate workspace artifacts so Netlify and Render can deploy independently.
- The API contract is OpenAPI-first and generates both React Query hooks and Zod validators.
- Calendar-only pickup and departure dates use `YYYY-MM-DD` strings to avoid timezone drift.
- Preview mode seeds realistic corridor data in the API process; Neon schema is ready for persistent deployment data.

## Product

- Carrier and shipper portals for posting trips and loads
- Corridor, capacity, and date matching
- Explicit EAC country, currency, and starter corridor reference data
- Phone +256 OTP and simulated Google onboarding
- Driver verification with NIN, license, and vehicle logbook review
- Cross-border settlement quote model with EAC currencies, fees, and payment ledger
- Booking with MTN MoMo / Airtel Money simulation and 12% / 88% split
- Status tracking, receiver OTP proof of delivery, and payout unlock
- Customs and border milestones with required-document tracking
- Negotiation messages, call links, and logistics document hub
- Uganda seed corridors: Kampala–Mbale, Kampala–Mbarara, Kampala–Gulu, Malaba–Kampala

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
