# Kaero - Marketplace App

A full-stack marketplace application built with React Native (mobile), React (web), and Node.js/Express (backend).

## Features
- User authentication with OTP
- Geospatial listings and search
- Real-time offers and transactions
- AI-powered assistant
- Payment integration (Paymob)
- Push notifications

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, PostgreSQL/PostGIS, Redis
- **Mobile**: React Native, Expo
- **Web**: React, Vite
- **Deployment**: Docker, Railway, Vercel, EAS

## Local Development

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Expo CLI

### Setup
1. Clone the repo
2. Start databases: `docker compose -f backend/docker-compose.yml up -d`
3. Backend: `cd backend && npm install && npm run migrate && npm run seed && npm run dev`
4. Mobile: `cd mobile && npm install && npm run start`
5. Web: `cd web && npm install && npm run dev`

## Deployment

### Backend
1. Set up Railway project
2. Connect GitHub repo
3. Set environment variables from `.env.example`
4. Deploy automatically on push to main

### Web
1. Connect to Vercel
2. Deploy automatically on push to main

### Mobile
1. Set up EAS: `eas build:configure`
2. Build: `eas build --platform android --profile production`
3. Submit: `eas submit --platform android --profile production`

## Environment Variables
See `backend/.env.example` for required variables.

## API Documentation
Available at `/api/v1` (add Swagger later).

## Contributing
1. Fork and clone
2. Create feature branch
3. Run tests: `npm test`
4. Lint: `npm run lint`
5. Format: `npm run format`
6. PR to main