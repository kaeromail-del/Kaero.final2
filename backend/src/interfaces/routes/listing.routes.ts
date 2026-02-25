import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../infrastructure/database/pool';
import { AuthRequest, requireAuth, optionalAuth } from '../middleware/auth.middleware';
import { AppError } from '../../application/auth.service';
import { moderateListing } from '../../infrastructure/moderation/automod.service';

const router = Router();

// ─── Validation ──────────────────────────────────────────

const createListingSchema = z.object({
  user_edited_title: z.string().min(3).max(200),
  user_edited_description: z.string().min(0).max(5000).default(''),
  final_price: z.number().positive(),
  original_price: z.number().positive().optional(),
  category_id: z.number().int().positive().optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  primary_image_url: z.string().min(1),
  additional_images: z.array(z.string()).max(9).optional(),
  verification_images: z.array(z.object({
    url: z.string(),
    timestamp: z.string(),
    exif_data: z.record(z.unknown()).nullable().optional(),
    hash: z.string(),
  })).min(1),
  ai_generated_title: z.string().optional(),
  ai_generated_description: z.string().optional(),
  ai_suggested_price: z.number().optional(),
  ai_confidence_score: z.number().min(0).max(1).optional(),
  is_ai_generated: z.boolean().optional(),
});

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(1).max(500000).default(50000),
  category_id: z.coerce.number().int().positive().optional(),
  min_price: z.coerce.number().positive().optional(),
  max_price: z.coerce.number().positive().optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
  sort: z.enum(['distance', 'newest', 'price_asc', 'price_desc', 'price']).default('distance'),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().int().min(100).max(50000).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ─── Fraud Risk Scorer ────────────────────────────────────

async function computeFraudRisk(sellerId: string, price: number, categoryId: number | null): Promise<number> {
  const user = await queryOne<any>(
    'SELECT created_at, behavioral_score, total_reviews, is_id_verified FROM users WHERE id = $1',
    [sellerId]
  );
  if (!user) return 0.5;

  let risk = 0.0;

  // New account penalty (< 7 days)
  const ageMs = Date.now() - new Date(user.created_at).getTime();
  if (ageMs < 7 * 86400000) risk += 0.25;
  else if (ageMs < 30 * 86400000) risk += 0.10;

  // No reviews penalty
  if (user.total_reviews === 0) risk += 0.15;

  // Low behavioral score
  const bscore = parseFloat(user.behavioral_score) || 100;
  if (bscore < 50) risk += 0.30;
  else if (bscore < 80) risk += 0.10;

  // Unverified user
  if (!user.is_id_verified) risk += 0.05;

  // Price outlier: if price > 5x category median → suspicious
  if (categoryId) {
    const stats = await queryOne<any>(
      `SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY final_price) as median
       FROM listings WHERE category_id = $1 AND status IN ('active','sold') LIMIT 500`,
      [categoryId]
    );
    if (stats?.median && price > parseFloat(stats.median) * 5) risk += 0.20;
  }

  // Too many listings in last 24h (spam)
  const recentCount = await queryOne<any>(
    `SELECT COUNT(*) as n FROM listings WHERE seller_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [sellerId]
  );
  if (parseInt(recentCount?.n ?? 0) >= 5) risk += 0.20;

  return Math.min(Math.round(risk * 100) / 100, 1.0);
}

// ─── Helpers ─────────────────────────────────────────────

function getPriceRange(price: number): string {
  if (price < 500) return '0-500';
  if (price < 2000) return '500-2000';
  if (price < 5000) return '2000-5000';
  if (price < 10000) return '5000-10000';
  return '10000+';
}

// ─── Routes ──────────────────────────────────────────────

// POST /api/v1/listings
router.post('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createListingSchema.parse(req.body);

    const fraudRisk = await computeFraudRisk(req.userId!, data.final_price, data.category_id ?? null);

    const rows = await query(
      `INSERT INTO listings (
        seller_id, user_edited_title, user_edited_description, final_price,
        original_price, category_id, condition, location, primary_image_url,
        additional_images, verification_images, ai_generated_title,
        ai_generated_description, ai_suggested_price, ai_confidence_score,
        is_ai_generated, moderation_status, fraud_risk_score
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography,
        $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *`,
      [
        req.userId,
        data.user_edited_title,
        data.user_edited_description,
        data.final_price,
        data.original_price ?? null,
        data.category_id ?? null,
        data.condition,
        data.lng, data.lat,
        data.primary_image_url,
        JSON.stringify(data.additional_images ?? []),
        JSON.stringify(data.verification_images),
        data.ai_generated_title ?? null,
        data.ai_generated_description ?? null,
        data.ai_suggested_price ?? null,
        data.ai_confidence_score ?? null,
        data.is_ai_generated ?? false,
        fraudRisk >= 0.7 ? 'flagged' : 'approved',
        fraudRisk,
      ]
    );

    const listing = rows[0];

    // Fire-and-forget keyword moderation (non-blocking — updates status if flagged/rejected)
    moderateListing(listing.id, data.user_edited_title, data.user_edited_description ?? '').then(async (mod) => {
      if (mod.status !== 'approved') {
        await query('UPDATE listings SET moderation_status = $1 WHERE id = $2', [mod.status, listing.id]);
      }
    }).catch(() => {});

    res.status(201).json({ listing });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/listings/nearby
router.get('/nearby', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const params = nearbyQuerySchema.parse(req.query);
    const conditions: string[] = [`l.status = 'active'`, `l.moderation_status = 'approved'`];
    const values: any[] = [params.lng, params.lat, params.radius];
    let idx = 4;

    conditions.push(`ST_DWithin(l.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`);

    if (params.category_id) { conditions.push(`l.category_id = $${idx}`); values.push(params.category_id); idx++; }
    if (params.min_price) { conditions.push(`l.final_price >= $${idx}`); values.push(params.min_price); idx++; }
    if (params.max_price) { conditions.push(`l.final_price <= $${idx}`); values.push(params.max_price); idx++; }
    if (params.condition) { conditions.push(`l.condition = $${idx}`); values.push(params.condition); idx++; }
    if (params.cursor) { conditions.push(`l.id < $${idx}`); values.push(params.cursor); idx++; }

    let orderClause: string;
    switch (params.sort) {
      case 'newest': orderClause = 'l.created_at DESC'; break;
      case 'price_asc': case 'price': orderClause = 'l.final_price ASC'; break;
      case 'price_desc': orderClause = 'l.final_price DESC'; break;
      default: orderClause = `ST_Distance(l.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) ASC`;
    }

    values.push(params.limit);
    const limitIdx = idx;

    const rows = await query(
      `SELECT l.*,
        ROUND((ST_Distance(l.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 2) AS distance_km,
        ST_Y(l.location::geometry) AS lat,
        ST_X(l.location::geometry) AS lng,
        u.full_name AS seller_name,
        u.avatar_url AS seller_avatar,
        u.trust_score AS seller_trust_score
      FROM listings l
      JOIN users u ON u.id = l.seller_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderClause}
      LIMIT $${limitIdx}`,
      values
    );

    res.json({
      listings: rows,
      next_cursor: rows.length === params.limit ? (rows[rows.length - 1] as any).id : null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/listings/favorites/mine
router.get('/favorites/mine', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT l.*,
        ST_Y(l.location::geometry) AS lat,
        ST_X(l.location::geometry) AS lng,
        u.full_name AS seller_name, u.trust_score AS seller_trust_score
       FROM user_favorites f
       JOIN listings l ON l.id = f.listing_id
       JOIN users u ON u.id = l.seller_id
       WHERE f.user_id = $1 AND l.status != 'deleted'
       ORDER BY f.created_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json({ listings: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/listings/search
router.get('/search', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const tsQuery = params.q.split(/\s+/).map(w => `${w}:*`).join(' & ');

    let locationFilter = '';
    const values: any[] = [tsQuery, params.limit];

    if (params.lat && params.lng && params.radius) {
      locationFilter = `AND ST_DWithin(l.location, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5)`;
      values.push(params.lng, params.lat, params.radius);
    }

    const rows = await query(
      `SELECT l.*,
        ts_rank(l.search_vector, to_tsquery('english', $1)) AS relevance,
        u.full_name AS seller_name,
        u.trust_score AS seller_trust_score
      FROM listings l
      JOIN users u ON u.id = l.seller_id
      WHERE l.status = 'active'
        AND l.search_vector @@ to_tsquery('english', $1)
        ${locationFilter}
      ORDER BY relevance DESC
      LIMIT $2`,
      values
    );

    res.json({ listings: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/listings/personalized
// Returns a ranked feed based on the user's recent viewing history.
// Must be registered BEFORE /:id to avoid route shadowing.
router.get('/personalized', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { lat, lng, limit = '20' } = req.query as Record<string, string>;

    // Top preferred category from views in the last 30 days
    const topPref = await queryOne<any>(
      `SELECT category_id, COUNT(*) as cnt
       FROM user_listing_views
       WHERE user_id = $1 AND viewed_at > NOW() - INTERVAL '30 days'
       GROUP BY category_id ORDER BY cnt DESC LIMIT 1`,
      [userId],
    );

    let rows: any[];

    if (lat && lng) {
      rows = await query(
        `SELECT l.*,
          ROUND((ST_Distance(l.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 2) AS distance_km,
          ST_Y(l.location::geometry) AS lat,
          ST_X(l.location::geometry) AS lng,
          u.full_name AS seller_name, u.trust_score AS seller_trust_score,
          (CASE WHEN l.category_id = $3 THEN 3 ELSE 0 END
           + CASE WHEN l.is_featured THEN 2 ELSE 0 END
           + CASE WHEN l.fraud_risk_score < 0.3 THEN 1 ELSE 0 END) AS relevance
         FROM listings l JOIN users u ON u.id = l.seller_id
         WHERE l.status = 'active' AND l.moderation_status = 'approved'
           AND l.seller_id != $4
           AND l.id NOT IN (SELECT listing_id FROM user_listing_views WHERE user_id = $4)
           AND ST_DWithin(l.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 50000)
         ORDER BY relevance DESC, l.created_at DESC
         LIMIT $5`,
        [parseFloat(lng), parseFloat(lat), topPref?.category_id ?? null, userId, parseInt(limit)],
      );
    } else {
      // No location — fallback to recent + featured
      rows = await query(
        `SELECT l.*,
          ST_Y(l.location::geometry) AS lat,
          ST_X(l.location::geometry) AS lng,
          u.full_name AS seller_name, u.trust_score AS seller_trust_score
         FROM listings l JOIN users u ON u.id = l.seller_id
         WHERE l.status = 'active' AND l.moderation_status = 'approved'
           AND l.seller_id != $1
         ORDER BY l.is_featured DESC, l.created_at DESC
         LIMIT $2`,
        [userId, parseInt(limit)],
      );
    }

    res.json({ listings: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/listings/:id/similar  (recommendations)
router.get('/:id/similar', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listing = await queryOne<any>(
      'SELECT category_id, final_price FROM listings WHERE id = $1',
      [req.params.id]
    );
    if (!listing) return res.json({ listings: [] });

    const rows = await query(
      `SELECT l.*,
        ST_Y(l.location::geometry) AS lat,
        ST_X(l.location::geometry) AS lng,
        u.full_name AS seller_name, u.trust_score AS seller_trust_score
       FROM listings l JOIN users u ON u.id = l.seller_id
       WHERE l.id != $1 AND l.status = 'active' AND l.moderation_status = 'approved'
         AND ($2::int IS NULL OR l.category_id = $2)
         AND l.final_price BETWEEN $3 * 0.5 AND $3 * 2.0
       ORDER BY RANDOM() LIMIT 10`,
      [req.params.id, listing.category_id ?? null, listing.final_price]
    );
    res.json({ listings: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/listings/:id
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listing = await queryOne(
      `SELECT l.*,
        ST_Y(l.location::geometry) AS lat,
        ST_X(l.location::geometry) AS lng,
        u.full_name AS seller_name,
        u.avatar_url AS seller_avatar,
        u.trust_score AS seller_trust_score,
        u.total_reviews AS seller_total_reviews,
        u.is_id_verified AS seller_id_verified,
        u.is_phone_verified AS seller_phone_verified
      FROM listings l
      JOIN users u ON u.id = l.seller_id
      WHERE l.id = $1`,
      [req.params.id]
    ) as any;

    if (!listing) throw new AppError('Listing not found.', 404);

    query('UPDATE listings SET view_count = view_count + 1 WHERE id = $1', [req.params.id]);

    res.json({
      listing: {
        ...listing,
        seller: {
          id: listing.seller_id,
          full_name: listing.seller_name,
          avatar_url: listing.seller_avatar,
          trust_score: parseFloat(listing.seller_trust_score),
          total_reviews: listing.seller_total_reviews,
          is_id_verified: listing.seller_id_verified,
          is_phone_verified: listing.seller_phone_verified,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/listings/:id/view  — track view for personalized feed
router.post('/:id/view', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.userId) {
      const listing = await queryOne<any>(
        'SELECT category_id, final_price FROM listings WHERE id = $1',
        [req.params.id],
      );
      if (listing) {
        const priceRange = getPriceRange(listing.final_price);
        await query(
          `INSERT INTO user_listing_views (user_id, listing_id, category_id, price_range)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, listing_id) DO UPDATE SET viewed_at = NOW()`,
          [req.userId, req.params.id, listing.category_id, priceRange],
        );
      }
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/v1/listings/:id/favorite  (toggle)
router.post('/:id/favorite', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const listingId = req.params.id;
    const existing = await queryOne(
      'SELECT 1 FROM user_favorites WHERE user_id = $1 AND listing_id = $2',
      [userId, listingId]
    );
    if (existing) {
      await query('DELETE FROM user_favorites WHERE user_id = $1 AND listing_id = $2', [userId, listingId]);
      await query('UPDATE listings SET favorite_count = GREATEST(0, favorite_count - 1) WHERE id = $1', [listingId]);
      res.json({ favorited: false });
    } else {
      await query(
        'INSERT INTO user_favorites (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, listingId]
      );
      await query('UPDATE listings SET favorite_count = favorite_count + 1 WHERE id = $1', [listingId]);
      res.json({ favorited: true });
    }
  } catch (err) { next(err); }
});

// POST /api/v1/listings/:id/report
router.post('/:id/report', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason, details } = z.object({
      reason: z.enum(['fake', 'spam', 'offensive', 'overpriced', 'sold_elsewhere', 'other']),
      details: z.string().max(500).optional(),
    }).parse(req.body);

    await query(
      'INSERT INTO reports (reporter_id, listing_id, reason, details) VALUES ($1, $2, $3, $4)',
      [req.userId, req.params.id, reason, details ?? null]
    );

    // Auto-flag if 3+ reports
    const count = await queryOne<any>(
      'SELECT COUNT(*) as n FROM reports WHERE listing_id = $1',
      [req.params.id]
    );
    if (parseInt(count?.n ?? 0) >= 3) {
      await query(
        `UPDATE listings SET moderation_status = 'flagged' WHERE id = $1 AND moderation_status = 'approved'`,
        [req.params.id]
      );
    }
    res.json({ message: 'Report submitted.' });
  } catch (err) { next(err); }
});

// PATCH /api/v1/listings/:id
router.patch('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await queryOne<any>('SELECT seller_id FROM listings WHERE id = $1', [req.params.id]);
    if (!existing) throw new AppError('Listing not found.', 404);
    if (existing.seller_id !== req.userId) throw new AppError('Not authorized.', 403);

    const allowed = ['user_edited_title', 'user_edited_description', 'final_price', 'condition', 'status'];
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(req.body[key]);
        idx++;
      }
    }

    if (fields.length === 0) throw new AppError('No fields to update.', 400);

    values.push(req.params.id);
    const rows = await query(
      `UPDATE listings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json({ listing: rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/listings/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await queryOne<any>('SELECT seller_id FROM listings WHERE id = $1', [req.params.id]);
    if (!existing) throw new AppError('Listing not found.', 404);
    if (existing.seller_id !== req.userId) throw new AppError('Not authorized.', 403);

    await query(`UPDATE listings SET status = 'deleted' WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Listing deleted.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/listings/user/:userId (seller's listings)
router.get('/user/:userId', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT l.*,
        ST_Y(l.location::geometry) AS lat,
        ST_X(l.location::geometry) AS lng
      FROM listings l
      WHERE l.seller_id = $1 AND l.status != 'deleted'
      ORDER BY l.created_at DESC
      LIMIT 50`,
      [req.params.userId]
    );

    res.json({ listings: rows });
  } catch (err) {
    next(err);
  }
});

// ─── POST /listings/:id/boost ─────────────────────────────
// Boost a listing to the top for a given duration (mock payment for now)

const BOOST_TIERS: Record<string, { days: number; price: number; label: string }> = {
  basic:    { days: 1,  price: 15,  label: '1 day' },
  standard: { days: 7,  price: 49,  label: '7 days' },
  premium:  { days: 30, price: 149, label: '30 days' },
};

router.post('/:id/boost', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { tier } = z.object({ tier: z.enum(['basic', 'standard', 'premium']) }).parse(req.body);

    const listing = await queryOne<any>('SELECT seller_id, user_edited_title FROM listings WHERE id = $1', [id]);
    if (!listing) { res.status(404).json({ error: 'Listing not found.' }); return; }
    if (listing.seller_id !== req.userId) { res.status(403).json({ error: 'Forbidden.' }); return; }

    const t = BOOST_TIERS[tier];
    const boostedUntil = new Date(Date.now() + t.days * 86400000);

    await query(
      `UPDATE listings SET is_featured = TRUE, featured_until = $1, boost_tier = $2, updated_at = NOW()
       WHERE id = $3`,
      [boostedUntil.toISOString(), tier, id],
    );

    res.json({
      message: `Listing boosted for ${t.label}.`,
      boosted_until: boostedUntil.toISOString(),
      tier,
      price_egp: t.price,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
