# Kaero v5.1 — PROJECT AUDIT
> Generated: 2026-03-06 | Auditor: Deployment Commander

---

## 1. PROJECT OVERVIEW

**Name**: Kaero — AI-powered local marketplace (Egypt)
**Monorepo root**: `kaero-v51/`
**Live deployments**:
- Backend API → `https://kaerofinal2-production.up.railway.app`
- Web App → `https://kaero-final2.vercel.app`
- Mobile → Expo (EAS builds), package `com.kaero.app`

---

## 2. CODEBASE MAP

### Directory Structure
```
kaero-v51/
├── backend/                    # Node.js/Express/TypeScript API
│   ├── src/
│   │   ├── app.ts              # Express app setup
│   │   ├── index.ts            # Entry point + CRON jobs + server start
│   │   ├── application/
│   │   │   └── auth.service.ts
│   │   ├── config/
│   │   │   └── index.ts        # All env var config
│   │   ├── domain/
│   │   │   └── entities.ts     # TypeScript interfaces/types
│   │   ├── infrastructure/
│   │   │   ├── database/       # pool.ts, migrate.ts, seed.ts
│   │   │   ├── moderation/     # automod.service.ts
│   │   │   ├── notifications/  # push.ts (Expo push)
│   │   │   ├── payments/       # paymob.service.ts
│   │   │   ├── redis/          # redis.client.ts
│   │   │   ├── sms/            # sms.service.ts (Twilio)
│   │   │   ├── socket/         # socket.service.ts (Socket.IO)
│   │   │   └── supabase/       # client.ts (storage)
│   │   └── interfaces/
│   │       ├── middleware/     # auth.middleware.ts, error.middleware.ts
│   │       └── routes/         # 15 route files (see API Routes below)
│   └── src/__tests__/
│       └── auth.service.test.ts
│
├── mobile/                     # Expo React Native (SDK ~54)
│   ├── app/
│   │   ├── (auth)/             # login.tsx, otp.tsx, signup.tsx
│   │   ├── (tabs)/             # index.tsx, sell.tsx, messages.tsx, profile.tsx, store.tsx
│   │   ├── chat/[id].tsx
│   │   ├── dispute/[id].tsx
│   │   ├── listing/[id].tsx, edit/[id].tsx, offers/[id].tsx
│   │   ├── offer/new.tsx
│   │   ├── payment/[id].tsx
│   │   ├── review/[transactionId].tsx
│   │   ├── seller/[id].tsx
│   │   ├── transaction/[id].tsx
│   │   └── (+ 12 more screens: search, favorites, wallet, referral, etc.)
│   ├── services/               # 13 service files (api.ts + domain services)
│   ├── store/                  # 4 Zustand stores
│   ├── components/             # 9 UI components
│   └── constants/theme.ts      # Design tokens
│
├── web/                        # React 18 / Vite SPA
│   ├── main.jsx                # Entry → imports ../kaero-v51.jsx
│   └── api.js                  # Full API client
│
├── kaero-v51.jsx               # Root web app (all screens)
│
├── .github/workflows/          # 4 CI/CD workflows
├── Dockerfile                  # Multi-stage (builder + production)
├── railway.json                # Railway deploy config
├── vercel.json                 # Vercel deploy config
└── .gitignore
```

### Entry Points
| App | Entry Point |
|-----|-------------|
| Backend | `backend/src/index.ts` → `node dist/index.js` |
| Mobile | `expo-router/entry` → `mobile/app/_layout.tsx` |
| Web | `web/main.jsx` → `kaero-v51.jsx` |

---

## 3. API ROUTES (Backend)

| Prefix | Route File | Auth Required |
|--------|-----------|---------------|
| `/api/v1/auth` | auth.routes.ts | No (OTP flow) |
| `/api/v1/users` | user.routes.ts | Yes |
| `/api/v1/listings` | listing.routes.ts | Mixed |
| `/api/v1/offers` | offer.routes.ts | Yes |
| `/api/v1/categories` | category.routes.ts | No |
| `/api/v1/chats` | chat.routes.ts | Yes |
| `/api/v1/transactions` | transaction.routes.ts | Yes |
| `/api/v1/ai` | ai.routes.ts | Yes |
| `/api/v1/uploads` | upload.routes.ts | Yes |
| `/api/v1/reviews` | review.routes.ts | Yes |
| `/api/v1/notifications` | notification.routes.ts | Yes |
| `/api/v1/referral` | referral.routes.ts | Yes |
| `/api/v1/promo` | promo.routes.ts | Yes |
| `/api/v1/wallet` | wallet.routes.ts | Yes |
| `/api/v1/admin` | admin.routes.ts | Admin key |

---

## 4. DEPENDENCY AUDIT

### Backend (`backend/package.json`)
**Dependencies** (production):
| Package | Version | Status |
|---------|---------|--------|
| express | ^4.21.0 | ✅ Current |
| pg | ^8.13.0 | ✅ Current |
| ioredis | ^5.4.1 | ✅ Current |
| socket.io | ^4.8.3 | ✅ Current |
| helmet | ^7.1.0 | ✅ Current |
| express-rate-limit | ^7.5.1 | ✅ Current |
| zod | ^3.23.8 | ✅ Current |
| jsonwebtoken | ^9.0.2 | ✅ Current |
| multer | ^2.1.0 | ✅ Current |
| twilio | ^5.12.2 | ✅ Current |
| bcryptjs | ^2.4.3 | ⚠️ Check usage — may be unused |

**DevDependencies** — Issues:
- `eslint-plugin-react` + `eslint-plugin-react-native` — ❌ Not needed in backend, add bloat

### Mobile (`mobile/package.json`)
| Package | Version | Status |
|---------|---------|--------|
| react | 19.1.0 | ✅ Fixed (was 19.2.4) |
| react-native | 0.81.5 | ✅ |
| expo | ~54.0.0 | ✅ |
| react-native-maps | 1.20.1 | ⚠️ Native-only — crashes web bundle |
| react-native-worklets | 0.5.1 | ⚠️ Check if actually used |
| @tanstack/react-query | ^5.51.0 | ✅ |
| zustand | ^4.5.4 | ✅ |

### Web (`web/package.json`)
| Package | Version | Status |
|---------|---------|--------|
| react | ^18.2.0 | ⚠️ React 18 vs mobile React 19.1 (different codebases, OK) |
| axios | ^1.13.5 | ✅ |
| vite | ^5.0.0 | ✅ |

---

## 5. ENVIRONMENT VARIABLES

### Required in Production (backend)
```
PORT                         # Server port (default 3000)
NODE_ENV                     # Must be "production"
DATABASE_URL                 # Supabase Transaction Pooler (port 6543)
SUPABASE_URL                 # https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY            # Public anon key
SUPABASE_SERVICE_ROLE_KEY    # ⚠️ SECRET — server-side only
REDIS_URL                    # Upstash Redis URL
JWT_SECRET                   # ⚠️ CRITICAL — must be strong random string
JWT_EXPIRES_IN               # e.g., 15m
REFRESH_TOKEN_EXPIRES_IN     # e.g., 30d
CORS_ORIGIN                  # https://kaero-final2.vercel.app
OPENAI_API_KEY               # For AI features
TWILIO_ACCOUNT_SID           # SMS OTP (optional — falls back to console.log)
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
PAYMOB_API_KEY               # Egypt payment gateway
PAYMOB_INTEGRATION_ID
PAYMOB_IFRAME_ID
PAYMOB_HMAC_SECRET
PLATFORM_FEE_PERCENT         # Default 4
MIN_WITHDRAWAL_EGP           # Default 100
ADMIN_API_KEY                # X-Admin-Key header for admin routes
API_BASE_URL                 # Base URL for image hosting
```

### Required in Mobile (`.env` / EAS secrets)
```
EXPO_PUBLIC_API_URL          # https://kaerofinal2-production.up.railway.app/api/v1
```

### Required in Web (Vercel env)
```
VITE_API_URL                 # https://kaerofinal2-production.up.railway.app/api/v1
```

---

## 6. CODE QUALITY ASSESSMENT

### ✅ GOOD
- Layered architecture (domain / application / infrastructure / interfaces)
- Helmet + CORS + rate limiting in place
- Health check always returns 200
- Zod validation on routes
- `withTransaction()` for atomic DB operations
- Atomic referral code generation with `crypto.randomBytes()`
- Socket.IO disconnect on logout
- Favorites cleared on logout
- Token refresh logic in both mobile and web API clients
- `.env.example` documented

### ⚠️ WARNINGS (Non-blocking)
| Location | Issue |
|----------|-------|
| `backend/src/config/index.ts:19` | JWT_SECRET falls back to `'dev-secret-change-me'` — dangerous if env var forgotten in prod |
| `backend/src/interfaces/routes/user.routes.ts:119` | TODO: trigger ID verification webhook |
| `backend/.env.example` | Duplicate entries (TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, PAYMOB_* all appear twice) |
| `mobile/services/api.ts:4` | Falls back to `localhost:3000` — fine, EXPO_PUBLIC_API_URL must be set |
| `backend/package.json` | `eslint-plugin-react` and `eslint-plugin-react-native` in backend devDeps — unnecessary |
| `mobile/app/listing/[id].tsx` | Imports `react-native-maps` unconditionally — web bundle crashes |

### ❌ ISSUES (Fix Before Production Scale)
| Priority | Location | Issue |
|----------|----------|-------|
| HIGH | `backend/src/config/index.ts` | JWT_SECRET weak fallback — add startup validation |
| HIGH | `mobile/eas.json` | Verify EXPO_PUBLIC_API_URL is set in EAS build secrets |
| MEDIUM | `.env.example` | Duplicate entries confuse onboarding |
| MEDIUM | `backend/package.json` | Remove react eslint plugins from backend |
| LOW | No root `README.md` | No onboarding documentation |
| LOW | No `docker-compose.yml` | No local full-stack dev setup |
| LOW | No `Makefile` | No unified command shortcuts |
| LOW | `new.sh` committed to repo | Unknown script file, should be gitignored or removed |

---

## 7. SECURITY AUDIT

| Check | Status | Notes |
|-------|--------|-------|
| Helmet headers | ✅ | crossOriginResourcePolicy: cross-origin |
| CORS | ✅ | Locked to Vercel URL in production |
| Rate limiting | ✅ | 200/15min global, 20/15min auth |
| JWT auth middleware | ✅ | All protected routes use authenticate() |
| Admin routes protected | ✅ | X-Admin-Key header required |
| Input validation | ✅ | Zod on all routes |
| SQL injection | ✅ | Parameterized queries via pg |
| Secrets in code | ✅ | All via env vars |
| JWT_SECRET weak fallback | ⚠️ | Could be accidentally deployed with dev secret |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | Server-side only |
| OTP brute force | ✅ | Redis-backed rate limiting in auth.service |

---

## 8. CI/CD STATUS

| Workflow | Trigger | Jobs | Status |
|----------|---------|------|--------|
| `ci.yml` | Push/PR to main | backend lint+typecheck+test+build, mobile typecheck, EAS build (gated) | ✅ |
| `ci-backend.yml` | Push to `backend/**` | lint, typecheck, test | ✅ |
| `ci-mobile.yml` | Push to `mobile/**` | typecheck only | ✅ |
| `ci-web.yml` | Push to `web/**` | install, build | ✅ |

**Railway**: Auto-deploys on push to main via GitHub integration
**Vercel**: Auto-deploys on push to main via GitHub integration
**EAS**: Manual trigger OR CI (requires `EXPO_TOKEN` secret in GitHub)

---

## 9. MISSING INFRASTRUCTURE

| Item | Priority | Impact |
|------|----------|--------|
| `README.md` (root) | MEDIUM | Onboarding takes hours instead of minutes |
| `docker-compose.yml` | LOW | Local dev requires separate DB/Redis setup |
| `Makefile` | LOW | No `make dev`, `make test`, `make deploy` shortcuts |
| Startup env validation | HIGH | App starts with bad config and fails mid-request |
| Production logging (structured JSON) | MEDIUM | `console.log` not suitable for production log aggregation |
| Test coverage | MEDIUM | Only 1 test file (`auth.service.test.ts`) |

---

## 10. SUMMARY SCORECARD

| Category | Score | Notes |
|----------|-------|-------|
| Architecture | 9/10 | Clean layered structure, good separation |
| Security | 8/10 | Good foundations, JWT fallback needs fix |
| Code Quality | 7/10 | Minor tech debt, no major issues |
| Test Coverage | 3/10 | Almost no tests |
| Documentation | 2/10 | No README, no API docs |
| DevEx (local setup) | 5/10 | No docker-compose, no Makefile |
| Deployment | 9/10 | Railway + Vercel + EAS all configured |
| **Overall** | **6.7/10** | **Production-ready with minor hardening needed** |

---

## 11. ADDITIONAL FINDINGS (Deep Audit)

### Backend
| Item | Detail |
|------|--------|
| `pool.ts` — `rejectUnauthorized: false` | ✅ INTENTIONAL — required by Supabase Transaction Pooler |
| `jwt.secret` fallback `'dev-secret-change-me'` | ❌ Add startup crash if secret is default/empty in production |
| ID verify route — webhook not implemented | ❌ Only console.log, no Jumio/Sumsub webhook integration |
| `eslint-plugin-react` + `react-native` in backend devDeps | ⚠️ Unnecessary — backend is API-only |
| No structured logging | ⚠️ `console.log` not suitable for production log aggregation |
| `.env.example` has duplicate entries | ❌ TWILIO_*, PAYMOB_* each appear twice — confusing |

### Mobile
| Item | Detail |
|------|--------|
| `tsconfig.json` path alias `@/*` → `src/*` | ❌ BROKEN — no `src/` directory exists. Alias never resolves. Fix or remove. |
| `react-dom: 19.1.0` in deps | ⚠️ Only needed for web target; add to conditional or remove |
| 35+ `any` type usages | ⚠️ Gradual typing debt across services and screens |
| Silent `catch {}` in `settingsStore.ts` | ⚠️ AsyncStorage failure completely swallowed |
| `eas.json` iOS submit fields | ❌ `REPLACE_WITH_*` placeholders — will crash on iOS App Store submit |
| Missing ESLint devDeps in `package.json` | ⚠️ `npm run lint` may fail in clean CI environment |
| No React Error Boundary | ⚠️ Unhandled render errors crash the entire app |

### CI/CD
| Item | Detail |
|------|--------|
| `ci.yml` partially duplicates `ci-backend.yml` / `ci-mobile.yml` | Minor — harmless but redundant |
| EAS build gated on `EXPO_TOKEN` | ✅ Correct |
| Railway auto-deploys on push to main | ✅ Correct |
| `new.sh` committed to repo root | ❌ Unknown script — remove or gitignore |

---

## PHASE 2 RECOMMENDATION

> The project structure is **already well-organized** — NO major directory restructuring needed.
> The standard template doesn't apply here — we already have a clean monorepo layout.
>
> **Recommended Phase 2 focuses on fixes, not restructuring**:
> 1. Add startup env validation (fail fast if JWT_SECRET is default)
> 2. Fix broken TypeScript path alias in `mobile/tsconfig.json`
> 3. Clean up `.env.example` (remove duplicates)
> 4. Add root `README.md`
> 5. Add `docker-compose.yml` for local full-stack dev
> 6. Remove `new.sh` from repo
> 7. Add React Error Boundary to mobile app

---

*Review this audit and approve to proceed to Phase 2.*
