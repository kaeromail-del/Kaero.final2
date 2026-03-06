import http from 'http';
import app from './app';
import { config } from './config';
import { initSocket } from './infrastructure/socket/socket.service';
import { query } from './infrastructure/database/pool';
import { runMigrations } from './infrastructure/database/migrate';

// ─── Startup Validation ───────────────────────────────────
const REQUIRED_ENV: string[] = ['DATABASE_URL', 'JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const UNSAFE_DEFAULTS = ['dev-secret-change-me', 'your-super-secret-jwt-key', 'replace_me'];

if (config.nodeEnv === 'production') {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (UNSAFE_DEFAULTS.some((d) => config.jwt.secret.includes(d))) {
    console.error('[FATAL] JWT_SECRET is using an unsafe default value. Set a strong secret.');
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
      console.log(`[CRON] Expired ${expiredOffers.length} offer(s)`);
    }

    // Expire active listings past their 30-day window
    const expiredListings = await query(
      `UPDATE listings SET status = 'deleted'
       WHERE status = 'active' AND expires_at < NOW()
       RETURNING id`
    );
    if (expiredListings.length > 0) {
      console.log(`[CRON] Expired ${expiredListings.length} listing(s)`);
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
      console.log(`[CRON] Auto-released ${autoReleased.length} escrow(s)`);
      for (const tx of autoReleased as any[]) {
        await query(`UPDATE listings SET status = 'sold' WHERE id = $1`, [tx.listing_id]);
      }
    }
  } catch (err) {
    console.error('[CRON] Job error:', err);
  }
}

const CRON_INTERVAL_MS = 60 * 60 * 1000;

// ─── Startup ──────────────────────────────────────────────

async function start() {
  // Run DB migration — server starts regardless of outcome
  try {
    await runMigrations();
  } catch (err) {
    console.error('[STARTUP] Migration failed (server will still start):', err);
  }

  server.listen(config.port, () => {
    console.log(`
  ╔══════════════════════════════════════╗
  ║   KAERO API v0.51                    ║
  ║   Port: ${config.port}                        ║
  ║   Env:  ${config.nodeEnv}            ║
  ║   WS:   Socket.io enabled            ║
  ╚══════════════════════════════════════╝
  `);

    runExpireJobs();
    setInterval(runExpireJobs, CRON_INTERVAL_MS);
  });
}

start().catch((err) => {
  console.error('[FATAL] Server failed to start:', err);
  process.exit(1);
});
