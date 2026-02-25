# Kaero v0.51 - Setup Guide

Egypt's AI-powered marketplace. Full-stack: Node.js backend + React Native (Expo) mobile app.

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Expo Go app (iOS/Android) for testing

### 1. Start the Database

```bash
cd backend
docker compose up -d
```

This starts PostgreSQL (port 5432) + Redis (port 6379).

### 2. Setup Backend

```bash
cd backend
cp .env.example .env          # Edit JWT_SECRET at minimum
npm install
npm run migrate               # Create all tables
npm run seed                  # Seed categories
npm run dev                   # Start dev server on :3000
```

Backend API: `http://localhost:3000`
Health check: `http://localhost:3000/health`

### 3. Setup Mobile App

```bash
cd mobile
npm install
cp .env.example .env.local    # Set EXPO_PUBLIC_API_URL

# For Android emulator:
# Change EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1

npx expo start
```

Scan QR code with Expo Go to run on your phone.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/otp/request` | - | Request OTP (printed to console in dev) |
| POST | `/api/v1/auth/otp/verify` | - | Verify OTP, returns JWT tokens |
| POST | `/api/v1/auth/refresh` | - | Refresh access token |
| GET | `/api/v1/users/me` | ✓ | Get my profile |
| PATCH | `/api/v1/users/me` | ✓ | Update profile |
| GET | `/api/v1/listings/nearby` | opt | Browse listings with geo filter |
| GET | `/api/v1/listings/search` | opt | Full-text search |
| POST | `/api/v1/listings` | ✓ | Create listing |
| GET | `/api/v1/listings/:id` | opt | Get listing detail |
| POST | `/api/v1/offers` | ✓ | Make offer |
| PATCH | `/api/v1/offers/:id/accept` | ✓ | Accept offer |
| GET | `/api/v1/chats` | ✓ | List my chats |
| POST | `/api/v1/chats` | ✓ | Start chat for a listing |
| POST | `/api/v1/chats/:id/messages` | ✓ | Send message |
| GET | `/api/v1/transactions` | ✓ | My transactions |
| PATCH | `/api/v1/transactions/:id/payment` | ✓ | Initiate payment |
| PATCH | `/api/v1/transactions/:id/confirm` | ✓ | Confirm receipt (releases escrow) |
| POST | `/api/v1/ai/analyze-image` | ✓ | AI photo analysis (GPT-4o) |
| POST | `/api/v1/ai/price-suggest` | ✓ | AI price suggestion |
| GET | `/api/v1/categories` | - | List categories |

---

## Mobile App Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/(auth)/login` | Phone number input |
| OTP | `/(auth)/otp` | 6-digit verification |
| Signup | `/(auth)/signup` | Profile completion |
| Market | `/(tabs)` | Browse nearby listings |
| Sell | `/(tabs)/sell` | Create listing with AI |
| My Store | `/(tabs)/store` | Manage listings |
| Messages | `/(tabs)/messages` | Chat list |
| Profile | `/(tabs)/profile` | Settings & profile |
| Listing Detail | `/listing/[id]` | Full listing view |
| Make Offer | `/offer/new` | Offer form (modal) |
| Payment | `/payment/[id]` | Escrow payment flow |
| Chat | `/chat/[id]` | Messaging thread |
| Search | `/search` | Text/voice search |

---

## Key Features

- **Phone OTP auth** — Egyptian phone validation (+20)
- **AI listing creation** — GPT-4o analyzes photo → auto-fills title/description/price
- **Geospatial browse** — PostGIS-powered nearby listings
- **3-day escrow** — Payment held until buyer confirms receipt
- **Real-time chat** — Polling-based (upgradeable to WebSockets)
- **Arabic/English** — Full RTL support, bilingual UI
- **Payment methods** — Fawry, InstaPay, Vodafone Cash, Wallet

---

## AI Setup (Optional)

Add your OpenAI API key to `backend/.env`:
```
OPENAI_API_KEY=sk-...
```

Without it, the AI returns mock data (still fully functional).

---

## Architecture

```
kaero-v51/
├── backend/              Node.js + Express + TypeScript
│   ├── src/
│   │   ├── app.ts        Express app setup
│   │   ├── config/       Environment config
│   │   ├── domain/       TypeScript entities
│   │   ├── application/  Auth service (OTP, JWT)
│   │   ├── infrastructure/
│   │   │   └── database/ PostgreSQL pool, migrations, seeds
│   │   └── interfaces/
│   │       ├── middleware/ Auth, error handling
│   │       └── routes/   All API route handlers
│   └── docker-compose.yml PostgreSQL + Redis
│
└── mobile/               React Native + Expo
    ├── app/              Expo Router screens
    │   ├── (auth)/       Login, OTP, Signup
    │   ├── (tabs)/       Market, Sell, Store, Messages, Profile
    │   ├── listing/      Listing detail
    │   ├── offer/        Make offer
    │   ├── payment/      Payment & escrow
    │   └── chat/         Chat thread
    ├── components/       Reusable UI components
    ├── constants/        Theme, translations
    ├── services/         API client (axios)
    ├── store/            Zustand state (auth, location, favorites)
    └── hooks/            useAuth, useLocation
```
