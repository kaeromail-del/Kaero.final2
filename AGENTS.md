# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository overview
- Monorepo with two apps:
  - `backend/` — Node.js + Express + TypeScript API. PostgreSQL (with PostGIS) and Redis are expected via Docker Compose.
  - `mobile/` — React Native (Expo) app using React Navigation, Zustand, React Query, Axios.

## Day‑to‑day commands
All commands are meant to be run from the repo root unless otherwise noted.

- Bring up databases (Postgres/PostGIS + Redis):
  - `docker compose -f backend/docker-compose.yml up -d`
  - To stop: `docker compose -f backend/docker-compose.yml down`

- Backend (Node/TS):
  - Install deps: `cd backend && npm install`
  - Type check: `cd backend && npm run typecheck`
  - Lint: `cd backend && npm run lint`
  - Dev server (tsx watch): `cd backend && npm run dev`
  - Build (tsc) then start: `cd backend && npm run build && npm start`
  - DB migrate up: `cd backend && npm run migrate`
  - DB migrate down: `cd backend && npm run migrate:down`
  - Seed categories: `cd backend && npm run seed`

- Mobile (Expo):
  - Install deps: `cd mobile && npm install`
  - Start dev server: `cd mobile && npm run start`
  - Launch Android: `cd mobile && npm run android`
  - Launch iOS (on macOS): `cd mobile && npm run ios`

- Tests: no test runner is configured in either app (no `test` script present).

## Required environment
The backend reads configuration from environment variables (via `dotenv` in `backend/src/config/index.ts`). Defaults are provided but you should set real values for non‑dev usage.

- `PORT` (default `3000`)
- `DATABASE_URL` (default `postgres://postgres:postgres@localhost:5432/kaero`)
- `REDIS_URL` (default `redis://localhost:6379`)
- `JWT_SECRET` (default `dev-secret-change-me`) — set a strong secret in non‑dev
- `JWT_EXPIRES_IN` (default `15m`)
- `REFRESH_TOKEN_EXPIRES_IN` (default `30d`)
- `CORS_ORIGIN` (default `*`)

Health check: `GET /health` — verifies DB connectivity.

## API surface (high level)
Route prefixes are registered in `backend/src/app.ts`.

- Auth (`/api/v1/auth`, see `interfaces/routes/auth.routes.ts`)
  - `POST /otp/request` — begin phone OTP flow
  - `POST /otp/verify` — verify OTP, returns `{ user, accessToken, refreshToken }`
  - `POST /refresh` — rotate refresh token and mint new access token

- Users (`/api/v1/users`, see `interfaces/routes/user.routes.ts`)
  - `GET /me` (auth) — current user profile; updates `last_active_at`
  - `PATCH /me` (auth) — update profile fields
  - `PUT /me/location` (auth) — update geolocation
  - `GET /:id` — public profile

- Listings (`/api/v1/listings`, see `interfaces/routes/listing.routes.ts`)
  - `POST /` (auth) — create listing; persists geo with `ST_MakePoint(lng, lat)`
  - `GET /nearby` — geospatial browse with filters + pagination cursor
  - `GET /search` — full‑text search (`tsvector` + `to_tsquery`)
  - `GET /:id` — details (increments view count async)
  - `PATCH /:id` (auth, owner) — partial update
  - `DELETE /:id` (auth, owner) — soft delete (`status = 'deleted'`)
  - `GET /user/:userId` — listings by seller

- Offers (`/api/v1/offers`, see `interfaces/routes/offer.routes.ts`)
  - `POST /` (auth) — create offer; guards duplicate/pending
  - `GET /listing/:listingId` (auth, seller) — offers on seller’s listing
  - `GET /my` (auth, buyer) — current user’s offers
  - `PATCH /:id/accept` (auth, seller) — accept offer, auto‑reject others, reserve listing, create transaction
  - `PATCH /:id/reject` (auth, seller) — reject offer

- Categories (`/api/v1/categories`, see `interfaces/routes/category.routes.ts`)
  - `GET /` — top/active categories
  - `GET /:id/children` — subcategories

Auth middleware: Bearer JWT via `Authorization: Bearer <accessToken>` (`requireAuth` / `optionalAuth`).

## Architecture (big picture)
- Express app with security/perf middleware: `helmet`, `cors`, `compression`, `morgan`, and rate limiting for `/api/` and auth paths (`express-rate-limit`).
- Layered structure:
  - `config/` — env/config surface (`config` object) loaded with `dotenv`.
  - `infrastructure/database/` — `pg` pool, query helpers, `migrate.ts` (DDL) and `seed.ts`.
    - PostgreSQL features: PostGIS geographies for geo queries; GIST indices for geo; GIN index for full‑text; triggers to maintain `search_vector` and `updated_at`.
  - `domain/` — TypeScript entity interfaces and enums used across layers.
  - `application/` — services; e.g., `auth.service.ts` implements phone OTP, JWT mint/verify, refresh‑token rotation (bcrypt‑hashed tokens stored in DB), and a lightweight `AppError`.
  - `interfaces/` — HTTP layer: route handlers with `zod` validation and auth/error middleware.
- Data flow highlights:
  - OTPs persist to `otp_codes`; in dev, codes are logged to console. SMS provider integration is deliberately deferred.
  - Listings persist geo as `GEOGRAPHY(POINT,4326)`; distance filters use `ST_DWithin`; ordering by distance uses `ST_Distance`.
  - Search uses `tsvector` + `to_tsquery`; a trigger keeps vectors in sync with editable fields.

## Operational notes and gotchas
- Start databases before the API, then run `migrate` (and optionally `seed`) once per fresh environment; otherwise most routes will 500 due to missing tables.
- Longitude/latitude order: INSERTs use `(lng, lat)` when calling `ST_MakePoint`; do not flip.
- Rate limits: general `/api/` (200/15m) and `/api/v1/auth` (20/15m). Tests and scripts should respect these or disable for local runs if needed.
- Error handling: throw `AppError` with HTTP code; unhandled errors are masked in prod (`Internal server error.`).

## Known gaps (useful for agents)
- No test runner or scripts are defined; do not assume Jest/Vitest.
- OTP delivery is mocked/logged in dev; there is no Twilio/SMS integration yet.
- If `npm run lint` fails in `backend/`, ensure ESLint is installed and configured — the script exists but ESLint isn’t listed in `devDependencies` here.

