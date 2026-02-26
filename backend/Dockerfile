# ── Build stage ──────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ── Production stage ─────────────────────────────────────────
FROM node:18-alpine AS production

WORKDIR /app

# curl is needed for the HEALTHCHECK
RUN apk add --no-cache curl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled output only (tsc puts everything in dist/)
COPY --from=builder /app/dist ./dist

# Create uploads directory (files are written here at runtime)
RUN mkdir -p ./public/uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run DB migrations then start the server
CMD ["sh", "-c", "node dist/infrastructure/database/migrate.js && node dist/index.js"]
