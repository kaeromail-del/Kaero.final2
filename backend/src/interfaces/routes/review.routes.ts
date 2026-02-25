import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';
import { AppError } from '../../application/auth.service';
import { query, queryOne } from '../../infrastructure/database/pool';

const router = Router();

const createReviewSchema = z.object({
  transaction_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  review_text: z.string().max(1000).optional(),
});

// POST /api/v1/reviews  — leave a review after a completed transaction
router.post('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { transaction_id, rating, review_text } = createReviewSchema.parse(req.body);
    const reviewerId = req.user!.id;

    // Load transaction and verify caller is a participant
    const tx = await queryOne<any>(
      `SELECT * FROM transactions WHERE id = $1`,
      [transaction_id]
    );
    if (!tx) throw new AppError('Transaction not found', 404);
    if (tx.buyer_id !== reviewerId && tx.seller_id !== reviewerId) {
      throw new AppError('Not your transaction', 403);
    }
    if (tx.payment_status !== 'released') {
      throw new AppError('Transaction must be completed before leaving a review', 400);
    }

    // Determine who is being reviewed
    const revieweeId = reviewerId === tx.buyer_id ? tx.seller_id : tx.buyer_id;
    const category  = reviewerId === tx.buyer_id ? 'seller' : 'buyer';

    // Prevent duplicate reviews for same transaction from same reviewer
    const existing = await queryOne<any>(
      `SELECT id FROM reviews WHERE transaction_id = $1 AND reviewer_id = $2`,
      [transaction_id, reviewerId]
    );
    if (existing) throw new AppError('You already reviewed this transaction', 409);

    // Insert review
    const review = await queryOne<any>(
      `INSERT INTO reviews (transaction_id, reviewer_id, reviewee_id, rating, review_text, category)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [transaction_id, reviewerId, revieweeId, rating, review_text ?? null, category]
    );

    // Update reviewee trust_score (rolling average) and total_reviews
    await query(
      `UPDATE users SET
         total_reviews = total_reviews + 1,
         trust_score   = LEAST(5, ROUND(
           (trust_score * total_reviews + $1) / (total_reviews + 1)::numeric, 2
         ))
       WHERE id = $2`,
      [rating, revieweeId]
    );

    res.status(201).json({ review });
  } catch (err) { next(err); }
});

// GET /api/v1/reviews/pending  — reviews I can still leave (completed txns with no review yet)
router.get('/pending', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const rows = await query<any>(
      `SELECT t.id as transaction_id, t.agreed_price,
              t.buyer_id, t.seller_id,
              l.user_edited_title as listing_title,
              l.primary_image_url,
              u.full_name as other_user_name,
              u.avatar_url as other_user_avatar
       FROM transactions t
       JOIN listings l ON l.id = t.listing_id
       JOIN users u ON u.id = CASE WHEN t.buyer_id = $1 THEN t.seller_id ELSE t.buyer_id END
       WHERE (t.buyer_id = $1 OR t.seller_id = $1)
         AND t.payment_status = 'released'
         AND NOT EXISTS (
           SELECT 1 FROM reviews r WHERE r.transaction_id = t.id AND r.reviewer_id = $1
         )
       ORDER BY t.completed_at DESC`,
      [userId]
    );
    res.json({ pending: rows });
  } catch (err) { next(err); }
});

export default router;
