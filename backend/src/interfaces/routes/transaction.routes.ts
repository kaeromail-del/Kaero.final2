import { Router, Response, NextFunction } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';
import { query, queryOne } from '../../infrastructure/database/pool';
import { AppError } from '../../application/auth.service';
import { z } from 'zod';
import { notifyPaymentReceived, notifyReviewReceived } from '../../infrastructure/notifications/push';
import { creditSellerWallet } from './wallet.routes';
import { checkAndRewardReferral } from './referral.routes';

const router = Router();

// GET /api/v1/transactions
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { role = 'all' } = req.query as { role?: string };

    let whereClause = '(t.buyer_id = $1 OR t.seller_id = $1)';
    if (role === 'buyer') whereClause = 't.buyer_id = $1';
    if (role === 'seller') whereClause = 't.seller_id = $1';

    const txns = await query(
      `SELECT t.*,
        l.user_edited_title as listing_title,
        l.primary_image_url as listing_image,
        buyer.full_name as buyer_name, buyer.avatar_url as buyer_avatar,
        seller.full_name as seller_name, seller.avatar_url as seller_avatar
       FROM transactions t
       JOIN listings l ON t.listing_id = l.id
       JOIN users buyer ON t.buyer_id = buyer.id
       JOIN users seller ON t.seller_id = seller.id
       WHERE ${whereClause}
       ORDER BY t.created_at DESC`,
      [userId]
    );
    res.json({ transactions: txns });
  } catch (err) { next(err); }
});

// GET /api/v1/transactions/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const txn = await queryOne(
      `SELECT t.*,
        l.user_edited_title as listing_title, l.primary_image_url as listing_image,
        buyer.full_name as buyer_name, buyer.phone as buyer_phone,
        seller.full_name as seller_name, seller.phone as seller_phone
       FROM transactions t
       JOIN listings l ON t.listing_id = l.id
       JOIN users buyer ON t.buyer_id = buyer.id
       JOIN users seller ON t.seller_id = seller.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!txn) throw new AppError('Transaction not found', 404);
    if (txn.buyer_id !== userId && txn.seller_id !== userId) throw new AppError('Forbidden', 403);
    res.json({ transaction: txn });
  } catch (err) { next(err); }
});

// PATCH /api/v1/transactions/:id/payment
router.patch('/:id/payment', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { payment_method } = z.object({
      payment_method: z.enum(['fawry', 'instapay', 'vodafone_cash', 'wallet', 'cash']),
    }).parse(req.body);

    const txn = await queryOne('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (!txn) throw new AppError('Transaction not found', 404);
    if (txn.buyer_id !== userId) throw new AppError('Only buyer can initiate payment', 403);
    if (txn.payment_status !== 'pending') throw new AppError('Payment already initiated', 400);

    // Cash = meet in person, no escrow timer — funds tracked but buyer confirms on delivery
    const updated = await queryOne(
      payment_method === 'cash'
        ? `UPDATE transactions SET payment_method = $1, payment_status = 'held',
           escrow_hold_until = NULL WHERE id = $2 RETURNING *`
        : `UPDATE transactions SET payment_method = $1, payment_status = 'held',
           escrow_hold_until = NOW() + INTERVAL '3 days' WHERE id = $2 RETURNING *`,
      [payment_method, req.params.id]
    );
    res.json({ transaction: updated });
  } catch (err) { next(err); }
});

// PATCH /api/v1/transactions/:id/confirm
router.patch('/:id/confirm', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const txn = await queryOne('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (!txn) throw new AppError('Transaction not found', 404);
    if (txn.buyer_id !== userId) throw new AppError('Only buyer can confirm', 403);
    if (txn.payment_status !== 'held') throw new AppError('Transaction not in escrow', 400);

    const updated = await queryOne(
      `UPDATE transactions SET buyer_confirmation = true, payment_status = 'released',
       completed_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await query(`UPDATE listings SET status = 'sold' WHERE id = $1`, [txn.listing_id]);
    const lstRow = await queryOne<any>(`SELECT user_edited_title FROM listings WHERE id = $1`, [txn.listing_id]);
    const title = lstRow?.user_edited_title ?? '';
    // Credit seller wallet
    creditSellerWallet(txn.seller_id, Number(txn.seller_receives), req.params.id,
      `Sale: ${title}`).catch(() => {});
    // Notify seller
    notifyPaymentReceived(txn.seller_id, Number(txn.seller_receives), title, req.params.id).catch(() => {});
    // Referral bonus for buyer's first completed transaction
    checkAndRewardReferral(userId).catch(() => {});
    res.json({ transaction: updated });
  } catch (err) { next(err); }
});

// POST /api/v1/transactions/:id/dispute
router.post('/:id/dispute', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { reason, details, evidence_urls } = z.object({
      reason: z.enum(['item_not_received', 'item_not_as_described', 'payment_issue', 'fraud', 'other']),
      details: z.string().max(2000).optional(),
      evidence_urls: z.array(z.string().url()).max(5).optional(),
    }).parse(req.body);

    const txn = await queryOne('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (!txn) throw new AppError('Transaction not found', 404);
    if (txn.buyer_id !== userId && txn.seller_id !== userId) throw new AppError('Forbidden', 403);
    if (txn.dispute_status !== 'none') throw new AppError('Dispute already opened', 400);
    if (txn.payment_status !== 'held') throw new AppError('Can only dispute transactions in escrow', 400);

    const updated = await queryOne(
      `UPDATE transactions SET
         dispute_status = 'opened',
         dispute_reason = $1,
         dispute_evidence = $2,
         payment_status = 'disputed'
       WHERE id = $3 RETURNING *`,
      [reason + (details ? `: ${details}` : ''), JSON.stringify(evidence_urls ?? []), req.params.id]
    );
    res.json({ transaction: updated });
  } catch (err) { next(err); }
});

// PATCH /api/v1/transactions/:id/dispute/resolve  (admin only)
router.patch('/:id/dispute/resolve', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { resolution, notes } = z.object({
      resolution: z.enum(['resolved_buyer', 'resolved_seller']),
      notes: z.string().max(1000).optional(),
    }).parse(req.body);

    const admin = await queryOne<any>(`SELECT is_admin FROM users WHERE id = $1`, [req.userId]);
    if (!admin?.is_admin) throw new AppError('Admin access required', 403);

    const txn = await queryOne<any>('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (!txn) throw new AppError('Transaction not found', 404);
    if (!['opened', 'under_review'].includes(txn.dispute_status)) throw new AppError('No active dispute', 400);

    const payStatus = resolution === 'resolved_buyer' ? 'refunded' : 'released';
    const updated = await queryOne(
      `UPDATE transactions SET
         dispute_status = $1,
         payment_status = $2,
         completed_at = CASE WHEN $2 = 'released' THEN NOW() ELSE completed_at END
       WHERE id = $3 RETURNING *`,
      [resolution, payStatus, req.params.id]
    );

    if (resolution === 'resolved_seller') {
      await query(`UPDATE listings SET status = 'sold' WHERE id = $1`, [txn.listing_id]);
    }
    res.json({ transaction: updated });
  } catch (err) { next(err); }
});

// POST /api/v1/transactions/:id/review
router.post('/:id/review', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { rating, review_text } = z.object({
      rating: z.number().int().min(1).max(5),
      review_text: z.string().max(500).optional(),
    }).parse(req.body);

    const txn = await queryOne('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (!txn) throw new AppError('Transaction not found', 404);
    if (txn.buyer_id !== userId && txn.seller_id !== userId) throw new AppError('Forbidden', 403);
    if (txn.payment_status !== 'released') throw new AppError('Can only review completed transactions', 400);

    const isBuyer = txn.buyer_id === userId;
    const revieweeId = isBuyer ? txn.seller_id : txn.buyer_id;
    const category = isBuyer ? 'seller' : 'buyer';

    const existing = await queryOne('SELECT id FROM reviews WHERE transaction_id = $1 AND reviewer_id = $2', [req.params.id, userId]);
    if (existing) throw new AppError('Already reviewed', 400);

    const review = await queryOne(
      `INSERT INTO reviews (transaction_id, reviewer_id, reviewee_id, rating, review_text, category, is_verified_purchase)
       VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *`,
      [req.params.id, userId, revieweeId, rating, review_text ?? null, category]
    );

    await query(
      `UPDATE users SET
        trust_score = (SELECT COALESCE(AVG(rating), 5) FROM reviews WHERE reviewee_id = $1),
        total_reviews = (SELECT COUNT(*) FROM reviews WHERE reviewee_id = $1)
       WHERE id = $1`,
      [revieweeId]
    );

    // Notify reviewee
    const reviewer = await queryOne<any>(`SELECT full_name FROM users WHERE id = $1`, [userId]);
    notifyReviewReceived(revieweeId, reviewer?.full_name ?? 'Someone', rating).catch(() => {});

    res.status(201).json({ review });
  } catch (err) { next(err); }
});

export default router;
