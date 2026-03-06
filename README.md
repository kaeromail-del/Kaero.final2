# Kaero — AI-Powered Local Marketplace (Egypt)

Kaero is a mobile-first marketplace where Egyptian buyers and sellers connect locally. Features include AI-powered listing creation, real-time chat, offer negotiation, escrow payments, and wallet management.

---

## Quick Start

```bash
git clone https://github.com/kaeromail-del/Kaero.final2.git
cd kaero-v51
```

### Backend (local dev)
```bash
cd backend
cp .env.example .env        # Fill in your values
npm install
npm run dev                  # Starts on http://localhost:3000
```

### Mobile (Expo)
```bash
cd mobile
npm install --legacy-peer-deps
npx expo start              # Press 'a' for Android emulator, 'i' for iOS
```

### Web (browser preview)
```bash
cd web
npm install
npm run dev                  # Opens on http://localhost:5173
```

### Full Stack (Docker)
```bash
cp backend/.env.example backend/.env   # Fill in your values
docker-compose up                       # Backend + PostgreSQL + Redis
```

---

## Architecture

```
kaero-v51/
├── backend/        Node.js + Express + TypeScript API
├── mobile/         Expo React Native (iOS + Android)
├── web/            React 18 + Vite browser preview
└── kaero-v51.jsx   Single-file web app (root)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 18, Express 4, TypeScript |
| Database | Supabase PostgreSQL (Transaction Pooler) |
| Cache / Rate-limit | Upstash Redis |
| Storage | Supabase Storage (listings, avatars buckets) |
| Real-time | Socket.IO |
| Mobile | Expo SDK 54, React Native 0.81, expo-router |
| State | Zustand + TanStack React Query |
| AI | OpenAI GPT-4o (image analysis, price suggestion, voice search) |
| SMS | Twilio (OTP) |
| Payments | Paymob (Egypt) |
| Web | React 18, Vite 5 |

### Live Deployments

| Service | URL |
|---------|-----|
| Backend API | https://kaerofinal2-production.up.railway.app |
| Web App | https://kaero-final2.vercel.app |
| Railway | Auto-deploys on push to `main` |
| Vercel | Auto-deploys on push to `main` |

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Supabase Transaction Pooler URL (port 6543) |
| `JWT_SECRET` | ✅ | Strong random string (64+ chars) |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-side Supabase key |
| `REDIS_URL` | ✅ | Upstash Redis URL |
| `OPENAI_API_KEY` | ✅ | For AI features |
| `TWILIO_*` | Optional | SMS OTP (falls back to console.log) |
| `PAYMOB_*` | Optional | Egypt payments |
| `ADMIN_API_KEY` | ✅ | X-Admin-Key header for admin routes |

Mobile requires one env var — set in `mobile/.env` or EAS secrets:
```
EXPO_PUBLIC_API_URL=https://kaerofinal2-production.up.railway.app/api/v1
```

---

## API Overview

Base URL: `/api/v1`

| Route Group | Endpoints |
|-------------|-----------|
| `/auth` | OTP request/verify, token refresh |
| `/users` | Profile, location, ID verification |
| `/listings` | CRUD, search, nearby, favorites, boost |
| `/offers` | Make, accept, reject, counter |
| `/chats` | Threads + messages (Socket.IO) |
| `/transactions` | Escrow, payment, confirm, dispute |
| `/wallet` | Balance, withdrawals, Paymob |
| `/ai` | Image analysis, price suggest, voice search |
| `/notifications` | FCM push tokens, in-app notifications |
| `/referral` | Invite codes |
| `/promo` | Promo codes |
| `/admin` | Stats, moderation (X-Admin-Key) |
| `/uploads` | Image upload to Supabase Storage |

Full API: see `backend/src/interfaces/routes/`

---

## Development Commands

```bash
# Backend
npm run dev          # Watch mode
npm run build        # Compile TypeScript
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm test             # Jest

# Mobile
npx expo start       # Dev server
npx tsc --noEmit     # TypeScript check
npx eas build --platform android --profile preview  # EAS APK build

# Web
npm run dev          # Vite dev server
npm run build        # Production build
```

---

## CI/CD

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | Push to `main` | Full pipeline (backend + mobile typecheck + EAS build) |
| `ci-backend.yml` | `backend/**` changes | Lint + typecheck + test |
| `ci-mobile.yml` | `mobile/**` changes | TypeScript check |
| `ci-web.yml` | `web/**` changes | Build |

Required GitHub Secrets:
- `EXPO_TOKEN` — EAS cloud builds

---

## Contributing

1. Branch off `main`
2. Make changes
3. Push → CI runs automatically
4. PR → code review → merge → auto-deploy
