import http from 'http';
import app from './app';
import { config } from './config';
import { logger } from './infrastructure/logging/logger';
import { initSocket } from './infrastructure/socket/socket.service';
import { query } from './infrastructure/database/pool';
import { runMigrations } from './infrastructure/database/migrate';

// ─── Startup Validation ───────────────────────────────────
const REQUIRED_ENV: string[] = ['DATABASE_URL', 'JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const UNSAFE_DEFAULTS = ['dev-secret-change-me', 'your-super-secret-jwt-key', 'replace_me'];

if (config.nodeEnv === 'production') {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.fatal({ missing }, '[FATAL] Missing required env vars');
    process.exit(1);
  }
  if (UNSAFE_DEFAULTS.some((d) => config.jwt.secret.includes(d))) {
    logger.fatal('[FATAL] JWT_SECRET is using an unsafe default value. Set a strong secret.');
    process.exit(1);
  }
}

const server = http.createServer(app);
initSocket(server);

// ─── Background Jobs ──────────────────────────────────────

async function runExpireJobs() {
  try {
    // Expire pending offers past their 48-hour window
    const expiredOffers = await query(
      `UPDATE offers SET status = 'expired'
       WHERE status = 'pending' AND expires_at < NOW()
       RETURNING id`
    );
    if (expiredOffers.length > 0) {
      logger.info({ count: expiredOffers.length }, '[CRON] Expired offers');
    }

    // Expire active listings past their 30-day window
    const expiredListings = await query(
      `UPDATE listings SET status = 'deleted'
       WHERE status = 'active' AND expires_at < NOW()
       RETURNING id`
    );
    if (expiredListings.length > 0) {
      logger.info({ count: expiredListings.length }, '[CRON] Expired listings');
    }

    // Auto-release escrow after hold period (buyer didn't confirm, no dispute)
    const autoReleased = await query(
      `UPDATE transactions SET
         payment_status = 'released',
         buyer_confirmation = TRUE,
         completed_at = NOW()
       WHERE payment_status = 'held'
         AND dispute_status = 'none'
         AND escrow_hold_until IS NOT NULL
         AND escrow_hold_until < NOW()
       RETURNING id, listing_id`
    );
    if (autoReleased.length > 0) {
      logger.info({ count: autoReleased.length }, '[CRON] Auto-released escrows');
      for (const tx of autoReleased as any[]) {
        await query(`UPDATE listings SET status = 'sold' WHERE id = $1`, [tx.listing_id]);
      }
    }
  } catch (err) {
    logger.error({ err }, '[CRON] Job error');
  }
}

const CRON_INTERVAL_MS = 60 * 60 * 1000;

// ─── Startup ──────────────────────────────────────────────

async function start() {
  // Run DB migration — server starts regardless of outcome
  try {
    await runMigrations();
  } catch (err) {
    logger.warn({ err }, '[STARTUP] Migration failed (server will still start)');
  }

  server.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, 'KAERO API v1.0 started');
    runExpireJobs();
    setInterval(runExpireJobs, CRON_INTERVAL_MS);
  });
}

start().catch((err) => {
  logger.fatal({ err }, '[FATAL] Server failed to start');
  process.exit(1);
});
