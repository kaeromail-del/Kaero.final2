import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';
import { query, queryOne } from '../../infrastructure/database/pool';

const router = Router();

// ── In-app notification table helper ─────────────────────
// We store notifications in a simple JSONB-based in-app table.
// Expo push tokens are stored in users.fcm_token.

// POST /api/v1/notifications/push-token  — register Expo push token
router.post('/push-token', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    await queryOne(
      `UPDATE users SET fcm_token = $1 WHERE id = $2`,
      [token, req.user!.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/v1/notifications  — list my notifications (last 50)
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await query<any>(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user!.id]
    );
    const unread = rows.filter((n: any) => !n.is_read).length;
    res.json({ notifications: rows, unread_count: unread });
  } catch (err) { next(err); }
});

// PATCH /api/v1/notifications/read-all  — mark all as read
router.patch('/read-all', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [req.user!.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/v1/notifications/:id/read  — mark one as read
router.patch('/:id/read', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
