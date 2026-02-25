import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../infrastructure/database/pool';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';
import { AppError } from '../../application/auth.service';
import type { User } from '../../domain/entities';

const router = Router();

const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  email: z.string().email().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  preferred_language: z.enum(['ar', 'en']).optional(),
  preferred_radius: z.number().int().min(100).max(50000).optional(),
  fcm_token: z.string().optional(),
});

const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// GET /api/v1/users/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (!user) throw new AppError('User not found.', 404);

    await query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [req.userId]);

    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/me
router.patch('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (fields.length === 0) throw new AppError('No fields to update.', 400);

    values.push(req.userId);
    const rows = await query<User>(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/users/me/location
router.put('/me/location', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = updateLocationSchema.parse(req.body);
    await query(
      `UPDATE users SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3`,
      [lng, lat, req.userId]
    );
    res.json({ message: 'Location updated.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/:id/reviews
router.get('/:id/reviews', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reviews = await query(
      `SELECT r.*, u.full_name AS reviewer_name, u.avatar_url AS reviewer_avatar
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [req.params.id]
    );
    res.json({ reviews });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users/me/id-verify  — submit ID + selfie for manual review
router.post('/me/id-verify', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id_front_url, id_back_url, selfie_url } = z.object({
      id_front_url: z.string().url(),
      id_back_url: z.string().url(),
      selfie_url: z.string().url(),
    }).parse(req.body);

    // Store images + mark as pending manual review
    await query(
      `UPDATE users SET
         id_image_url = $1,
         selfie_image_url = $2,
         id_verification_status = 'pending'
       WHERE id = $3`,
      [id_front_url, selfie_url, req.userId]
    );

    // TODO: trigger Jumio/Sumsub webhook or admin notification here
    console.log(`[ID-VERIFY] User ${req.userId} submitted docs for review. Back: ${id_back_url}`);

    res.json({ message: 'Documents submitted for review. Verification usually takes 1–2 business days.' });
  } catch (err) { next(err); }
});

// GET /api/v1/users/:id (public profile)
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!user) throw new AppError('User not found.', 404);
    res.json({ user: publicProfile(user) });
  } catch (err) {
    next(err);
  }
});

function sanitizeUser(u: any) {
  return {
    id: u.id,
    phone: u.phone,
    email: u.email,
    full_name: u.full_name,
    avatar_url: u.avatar_url,
    is_phone_verified: u.is_phone_verified,
    is_id_verified: u.is_id_verified,
    trust_score: parseFloat(u.trust_score),
    total_reviews: u.total_reviews,
    preferred_language: u.preferred_language,
    preferred_radius: u.preferred_radius,
    created_at: u.created_at,
  };
}

function publicProfile(u: any) {
  return {
    id: u.id,
    full_name: u.full_name,
    avatar_url: u.avatar_url,
    is_phone_verified: u.is_phone_verified,
    is_id_verified: u.is_id_verified,
    trust_score: parseFloat(u.trust_score),
    total_reviews: u.total_reviews,
    created_at: u.created_at,
  };
}

export default router;
