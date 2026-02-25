import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../../infrastructure/database/pool';
import { AppError } from '../../application/auth.service';

const router = Router();

// ─── Admin Auth Middleware ────────────────────────────────────────────────────

function adminAuth(req: Request, _res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return next(new AppError('Admin API not configured.', 503));
  const provided = req.headers['x-admin-key'];
  if (!provided || provided !== adminKey) return next(new AppError('Unauthorized.', 401));
  next();
}

router.use(adminAuth);

// ─── GET /api/v1/admin/stats ──────────────────────────────────────────────────

router.get('/stats', async (_req, res: Response, next: NextFunction) => {
  try {
    const [users, active, txns, volume, flagged, disputes] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) AS count FROM users'),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM listings WHERE status = 'active'`),
      query<{ count: string }>('SELECT COUNT(*) AS count FROM transactions'),
      query<{ total: string }>(`SELECT COALESCE(SUM(final_price),0) AS total FROM transactions WHERE status IN ('completed','held')`),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM listings WHERE moderation_status = 'flagged'`),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM transactions WHERE dispute_status = 'open'`),
    ]);
    res.json({
      total_users:        parseInt(users[0]?.count    ?? '0', 10),
      active_listings:    parseInt(active[0]?.count   ?? '0', 10),
      total_transactions: parseInt(txns[0]?.count     ?? '0', 10),
      total_volume_egp:   parseFloat(volume[0]?.total ?? '0'),
      flagged_listings:   parseInt(flagged[0]?.count  ?? '0', 10),
      open_disputes:      parseInt(disputes[0]?.count ?? '0', 10),
    });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/admin/listings/flagged ───────────────────────────────────────

router.get('/listings/flagged', async (_req, res: Response, next: NextFunction) => {
  try {
    const listings = await query(
      `SELECT l.*, u.full_name AS seller_name, u.phone AS seller_phone,
         ST_Y(l.location::geometry) AS lat,
         ST_X(l.location::geometry) AS lng
       FROM listings l
       JOIN users u ON u.id = l.seller_id
       WHERE l.moderation_status IN ('flagged','rejected')
       ORDER BY l.created_at DESC LIMIT 50`,
    );
    res.json({ listings });
  } catch (err) { next(err); }
});

// ─── PATCH /api/v1/admin/listings/:id/moderate ───────────────────────────────

router.patch('/listings/:id/moderate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action } = z.object({ action: z.enum(['approve', 'reject']) }).parse(req.body);
    if (action === 'approve') {
      await query(`UPDATE listings SET moderation_status = 'approved' WHERE id = $1`, [req.params.id]);
    } else {
      await query(`UPDATE listings SET moderation_status = 'rejected', status = 'deleted' WHERE id = $1`, [req.params.id]);
    }
    res.json({ ok: true, id: req.params.id, action });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/admin/users ──────────────────────────────────────────────────

router.get('/users', async (_req, res: Response, next: NextFunction) => {
  try {
    const users = await query(
      `SELECT id, full_name, phone, email, trust_score, behavioral_score,
         is_id_verified, is_phone_verified, total_reviews, created_at
       FROM users ORDER BY created_at DESC LIMIT 50`,
    );
    res.json({ users });
  } catch (err) { next(err); }
});

// ─── PATCH /api/v1/admin/users/:id/ban ───────────────────────────────────────

router.patch('/users/:id/ban', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { banned } = z.object({ banned: z.boolean() }).parse(req.body);
    if (banned) {
      await query(`UPDATE users SET behavioral_score = 0, trust_score = 1 WHERE id = $1`, [req.params.id]);
    } else {
      await query(`UPDATE users SET behavioral_score = 100 WHERE id = $1`, [req.params.id]);
    }
    res.json({ ok: true, id: req.params.id, banned });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/admin/disputes ───────────────────────────────────────────────

router.get('/disputes', async (_req, res: Response, next: NextFunction) => {
  try {
    const disputes = await query(
      `SELECT t.*,
         buyer.full_name  AS buyer_name,
         seller.full_name AS seller_name,
         l.user_edited_title AS listing_title
       FROM transactions t
       JOIN users buyer  ON buyer.id  = t.buyer_id
       JOIN users seller ON seller.id = t.seller_id
       JOIN listings l   ON l.id      = t.listing_id
       WHERE t.dispute_status = 'open'
       ORDER BY t.created_at DESC LIMIT 50`,
    );
    res.json({ disputes });
  } catch (err) { next(err); }
});

export default router;
