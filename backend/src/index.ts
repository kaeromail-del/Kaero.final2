import http from 'http';
import app from './app';
import { config } from './config';
import { initSocket } from './infrastructure/socket/socket.service';
import { query } from './infrastructure/database/pool';

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
      // Mark listings as sold
      for (const tx of autoReleased as any[]) {
        await query(`UPDATE listings SET status = 'sold' WHERE id = $1`, [tx.listing_id]);
      }
    }
  } catch (err) {
    console.error('[CRON] Job error:', err);
  }
}

// Run every hour
const CRON_INTERVAL_MS = 60 * 60 * 1000;

server.listen(config.port, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   KAERO API v0.51                    ║
  ║   Port: ${config.port}                        ║
  ║   Env:  ${config.nodeEnv}            ║
  ║   WS:   Socket.io enabled            ║
  ╚══════════════════════════════════════╝
  `);

  // Run immediately on boot, then every hour
  runExpireJobs();
  setInterval(runExpireJobs, CRON_INTERVAL_MS);
});
