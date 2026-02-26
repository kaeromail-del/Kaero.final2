# ── Build stage ──────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --ignore-scripts

COPY backend/ .
RUN npm run build

# ── Production stage ─────────────────────────────────────────
FROM node:18-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p ./public/uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["sh", "-c", "node dist/infrastructure/database/migrate.js && node dist/index.js"]
