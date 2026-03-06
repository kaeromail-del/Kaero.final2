# Kaero — Developer Shortcuts
# Usage: make <command>
# Requires: Node.js 18+, Docker (for local stack)

.PHONY: help setup dev dev-backend dev-mobile dev-web \
        build test lint typecheck \
        docker-up docker-down \
        db-migrate db-seed \
        deploy-check push

# ── Default ──────────────────────────────────────────────
help:
	@echo ""
	@echo "  Kaero Developer Commands"
	@echo "  ────────────────────────────────────────"
	@echo "  make setup         Install all dependencies"
	@echo "  make dev           Start backend in dev mode"
	@echo "  make dev-mobile    Start Expo dev server"
	@echo "  make dev-web       Start Vite web preview"
	@echo "  make build         Build backend TypeScript"
	@echo "  make test          Run backend tests"
	@echo "  make lint          Lint backend + mobile"
	@echo "  make typecheck     TypeScript check all"
	@echo "  make docker-up     Start local DB + Redis"
	@echo "  make docker-down   Stop local stack"
	@echo "  make db-migrate    Run DB migrations"
	@echo "  make db-seed       Seed DB with categories"
	@echo "  make deploy-check  Validate before push"
	@echo ""

# ── Setup ─────────────────────────────────────────────────
setup:
	@echo "→ Installing backend dependencies..."
	cd backend && npm install
	@echo "→ Installing mobile dependencies..."
	cd mobile && npm install --legacy-peer-deps
	@echo "→ Installing web dependencies..."
	cd web && npm install
	@echo "✓ Setup complete. Copy backend/.env.example → backend/.env and fill in values."

# ── Development ───────────────────────────────────────────
dev:
	cd backend && npm run dev

dev-mobile:
	cd mobile && npx expo start

dev-web:
	cd web && npm run dev

# ── Build ─────────────────────────────────────────────────
build:
	cd backend && npm run build

# ── Quality ───────────────────────────────────────────────
test:
	cd backend && npm test

lint:
	cd backend && npm run lint
	cd mobile && npm run lint

typecheck:
	cd backend && npm run typecheck
	cd mobile && npx tsc --noEmit

# ── Local Stack (Docker) ──────────────────────────────────
docker-up:
	docker-compose up -d
	@echo "✓ PostgreSQL on localhost:5432, Redis on localhost:6379"

docker-down:
	docker-compose down

# ── Database ──────────────────────────────────────────────
db-migrate:
	cd backend && npm run migrate

db-seed:
	cd backend && npm run seed

# ── Pre-deploy Checks ─────────────────────────────────────
deploy-check:
	@echo "→ Checking backend build..."
	cd backend && npm run build
	@echo "→ Checking backend types..."
	cd backend && npm run typecheck
	@echo "→ Checking mobile types..."
	cd mobile && npx tsc --noEmit
	@echo "→ Checking web build..."
	cd web && npm run build
	@echo "✓ All checks passed — safe to push."

push: deploy-check
	git push origin main
