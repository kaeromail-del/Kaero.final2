import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../infrastructure/database/pool';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';

const router = Router();

// ─── POST /promo/validate ─────────────────────────────────
// Validate a promo code and return discount info

router.post('/validate', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const { code, order_amount } = z.object({
      code: z.string().min(1).max(30),
      order_amount: z.number().positive(),
    }).parse(req.body);

    const promo = await queryOne<{
      id: string; code: string; discount_type: string; discount_value: number;
      max_uses: number; used_count: number; min_order_amount: number;
      expires_at: string | null; is_active: boolean;
    }>(
      `SELECT id, code, discount_type, discount_value, max_uses, used_count,
              min_order_amount, expires_at, is_active
       FROM promo_codes WHERE UPPER(code) = UPPER($1)`,
      [code],
    );

    if (!promo || !promo.is_active) {
      res.status(404).json({ error: 'Invalid or expired promo code.' });
      return;
    }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      res.status(400).json({ error: 'This promo code has expired.' });
      return;
    }
    if (promo.used_count >= promo.max_uses) {
      res.status(400).json({ error: 'This promo code has reached its usage limit.' });
      return;
    }
    if (order_amount < promo.min_order_amount) {
      res.status(400).json({
        error: `Minimum order of ${promo.min_order_amount.toLocaleString()} EGP required for this code.`,
      });
      return;
    }

    // Check if user already used this code
    const alreadyUsed = await queryOne<{ id: string }>(
      'SELECT id FROM promo_code_uses WHERE code_id = $1 AND user_id = $2',
      [promo.id, userId],
    );
    if (alreadyUsed) {
      res.status(400).json({ error: 'You have already used this promo code.' });
      return;
    }

    // Calculate discount
    const discount = promo.discount_type === 'percent'
      ? Math.min(order_amount * (promo.discount_value / 100), order_amount)
      : Math.min(promo.discount_value, order_amount);

    const final_amount = Math.max(0, order_amount - discount);

    res.json({
      valid: true,
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      discount_amount: Math.round(discount * 100) / 100,
      final_amount: Math.round(final_amount * 100) / 100,
      promo_id: promo.id,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /promo (admin only) ─────────────────────────────
// Create a new promo code

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const admin = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!admin?.is_admin) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    const body = z.object({
      code: z.string().min(3).max(20).toUpperCase(),
      discount_type: z.enum(['percent', 'fixed']),
      discount_value: z.number().positive(),
      max_uses: z.number().int().positive().default(100),
      min_order_amount: z.number().min(0).default(0),
      expires_at: z.string().datetime().optional(),
    }).parse(req.body);

    const row = await queryOne<{ id: string; code: string }>(
      `INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, min_order_amount, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, code`,
      [body.code, body.discount_type, body.discount_value, body.max_uses, body.min_order_amount, body.expires_at ?? null],
    );

    res.status(201).json({ promo: row });
  } catch (err) {
    next(err);
  }
});

// ─── GET /promo (admin only) ──────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const admin = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!admin?.is_admin) { res.status(403).json({ error: 'Forbidden.' }); return; }

    const rows = await query(
      'SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT 100',
    );
    res.json({ codes: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
