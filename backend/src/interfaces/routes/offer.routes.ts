import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../infrastructure/database/pool';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';
import { AppError } from '../../application/auth.service';
import { notifyNewOffer, notifyOfferAccepted, notifyOfferRejected, notifyOfferCountered } from '../../infrastructure/notifications/push';

const router = Router();

const createOfferSchema = z.object({
  listing_id: z.string().uuid(),
  offered_price: z.number().positive(),
  message: z.string().max(500).optional(),
  is_exchange_proposal: z.boolean().optional(),
  exchange_listing_id: z.string().uuid().optional(),
});

// POST /api/v1/offers
router.post('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createOfferSchema.parse(req.body);

    // Verify listing exists and is active
    const listing = await queryOne<any>(
      `SELECT id, seller_id, status FROM listings WHERE id = $1`,
      [data.listing_id]
    );
    if (!listing) throw new AppError('Listing not found.', 404);
    if (listing.status !== 'active') throw new AppError('Listing is no longer active.', 400);
    if (listing.seller_id === req.userId) throw new AppError('Cannot make an offer on your own listing.', 400);

    // Check for existing pending offer from this buyer
    const existing = await queryOne<any>(
      `SELECT id FROM offers WHERE listing_id = $1 AND buyer_id = $2 AND status = 'pending'`,
      [data.listing_id, req.userId]
    );
    if (existing) throw new AppError('You already have a pending offer on this listing.', 409);

    const rows = await query(
      `INSERT INTO offers (listing_id, buyer_id, offered_price, message, is_exchange_proposal, exchange_listing_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        data.listing_id,
        req.userId,
        data.offered_price,
        data.message ?? null,
        data.is_exchange_proposal ?? false,
        data.exchange_listing_id ?? null,
      ]
    );

    // Increment offer count on listing
    await query('UPDATE listings SET offer_count = offer_count + 1 WHERE id = $1', [data.listing_id]);

    // Notify seller
    const buyer = await queryOne<any>(`SELECT full_name FROM users WHERE id = $1`, [req.userId]);
    const listingRow = await queryOne<any>(`SELECT user_edited_title FROM listings WHERE id = $1`, [data.listing_id]);
    notifyNewOffer(listing.seller_id, buyer?.full_name ?? 'Someone', listingRow?.user_edited_title ?? '', data.listing_id, (rows[0] as any).id).catch(() => {});

    res.status(201).json({ offer: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/offers/listing/:listingId (seller sees all offers)
router.get('/listing/:listingId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listing = await queryOne<any>('SELECT seller_id FROM listings WHERE id = $1', [req.params.listingId]);
    if (!listing) throw new AppError('Listing not found.', 404);
    if (listing.seller_id !== req.userId) throw new AppError('Not authorized.', 403);

    const rows = await query(
      `SELECT o.*,
        u.full_name AS buyer_name,
        u.avatar_url AS buyer_avatar,
        u.trust_score AS buyer_trust_score,
        u.is_id_verified AS buyer_verified
      FROM offers o
      JOIN users u ON u.id = o.buyer_id
      WHERE o.listing_id = $1
      ORDER BY o.created_at DESC`,
      [req.params.listingId]
    );

    res.json({ offers: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/offers/my (buyer's offers)
router.get('/my', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT o.*,
        l.user_edited_title AS listing_title,
        l.primary_image_url AS listing_image,
        l.final_price AS listing_price
      FROM offers o
      JOIN listings l ON l.id = o.listing_id
      WHERE o.buyer_id = $1
      ORDER BY o.created_at DESC
      LIMIT 50`,
      [req.userId]
    );

    res.json({ offers: rows });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/offers/:id/accept
router.patch('/:id/accept', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const offer = await queryOne<any>(
      `SELECT o.*, l.seller_id FROM offers o JOIN listings l ON l.id = o.listing_id WHERE o.id = $1`,
      [req.params.id]
    );
    if (!offer) throw new AppError('Offer not found.', 404);
    if (offer.seller_id !== req.userId) throw new AppError('Not authorized.', 403);
    if (offer.status !== 'pending') throw new AppError('Offer is no longer pending.', 400);

    // Accept this offer, reject all others
    await query(`UPDATE offers SET status = 'accepted' WHERE id = $1`, [req.params.id]);
    await query(
      `UPDATE offers SET status = 'rejected' WHERE listing_id = $1 AND id != $2 AND status = 'pending'`,
      [offer.listing_id, req.params.id]
    );
    await query(`UPDATE listings SET status = 'reserved' WHERE id = $1`, [offer.listing_id]);

    // Create transaction
    const fee = offer.offered_price * 0.04;
    const sellerReceives = offer.offered_price - (offer.offered_price * 0.02);

    await query(
      `INSERT INTO transactions (offer_id, listing_id, buyer_id, seller_id, agreed_price, platform_fee, seller_receives)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.params.id, offer.listing_id, offer.buyer_id, req.userId, offer.offered_price, fee, sellerReceives]
    );

    // Notify buyer
    const listing2 = await queryOne<any>(`SELECT user_edited_title FROM listings WHERE id = $1`, [offer.listing_id]);
    const tx2 = await queryOne<any>(`SELECT id FROM transactions WHERE offer_id = $1`, [req.params.id]);
    notifyOfferAccepted(offer.buyer_id, listing2?.user_edited_title ?? '', offer.listing_id, tx2?.id ?? '').catch(() => {});

    res.json({ message: 'Offer accepted.', offer: { ...offer, status: 'accepted' } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/offers/:id/reject
router.patch('/:id/reject', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const offer = await queryOne<any>(
      `SELECT o.*, l.seller_id FROM offers o JOIN listings l ON l.id = o.listing_id WHERE o.id = $1`,
      [req.params.id]
    );
    if (!offer) throw new AppError('Offer not found.', 404);
    if (offer.seller_id !== req.userId) throw new AppError('Not authorized.', 403);
    if (offer.status !== 'pending') throw new AppError('Offer is no longer pending.', 400);

    await query(`UPDATE offers SET status = 'rejected' WHERE id = $1`, [req.params.id]);
    const listingR = await queryOne<any>(`SELECT user_edited_title FROM listings WHERE id = $1`, [offer.listing_id]);
    notifyOfferRejected(offer.buyer_id, listingR?.user_edited_title ?? '').catch(() => {});
    res.json({ message: 'Offer rejected.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/offers/:id/counter  — seller counters with a different price
router.patch('/:id/counter', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { counter_price } = z.object({ counter_price: z.number().positive() }).parse(req.body);

    const offer = await queryOne<any>(
      `SELECT o.*, l.seller_id FROM offers o JOIN listings l ON l.id = o.listing_id WHERE o.id = $1`,
      [req.params.id]
    );
    if (!offer) throw new AppError('Offer not found.', 404);
    if (offer.seller_id !== req.userId) throw new AppError('Not authorized.', 403);
    if (offer.status !== 'pending') throw new AppError('Offer is no longer pending.', 400);

    await query(
      `UPDATE offers SET status = 'countered', counter_price = $1 WHERE id = $2`,
      [counter_price, req.params.id]
    );

    const listingC = await queryOne<any>(`SELECT user_edited_title FROM listings WHERE id = $1`, [offer.listing_id]);
    notifyOfferCountered(offer.buyer_id, listingC?.user_edited_title ?? '', counter_price, offer.listing_id, req.params.id).catch(() => {});

    res.json({ message: 'Counter offer sent.', counter_price });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/offers/:id/cancel  — buyer cancels their own pending offer
router.patch('/:id/cancel', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const offer = await queryOne<any>(`SELECT * FROM offers WHERE id = $1`, [req.params.id]);
    if (!offer) throw new AppError('Offer not found.', 404);
    if (offer.buyer_id !== req.userId) throw new AppError('Not authorized.', 403);
    if (!['pending', 'countered'].includes(offer.status)) throw new AppError('Cannot cancel this offer.', 400);

    await query(`UPDATE offers SET status = 'rejected' WHERE id = $1`, [req.params.id]);
    // Decrement offer count on listing
    await query('UPDATE listings SET offer_count = GREATEST(0, offer_count - 1) WHERE id = $1', [offer.listing_id]);
    res.json({ message: 'Offer cancelled.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/offers/:id/accept-counter  — buyer accepts the seller's counter price
router.patch('/:id/accept-counter', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const offer = await queryOne<any>(
      `SELECT o.*, l.seller_id FROM offers o JOIN listings l ON l.id = o.listing_id WHERE o.id = $1`,
      [req.params.id]
    );
    if (!offer) throw new AppError('Offer not found.', 404);
    if (offer.buyer_id !== req.userId) throw new AppError('Not authorized.', 403);
    if (offer.status !== 'countered') throw new AppError('No active counter offer.', 400);

    const agreedPrice = Number(offer.counter_price);

    await query(`UPDATE offers SET status = 'accepted', offered_price = $1 WHERE id = $2`, [agreedPrice, req.params.id]);
    await query(
      `UPDATE offers SET status = 'rejected' WHERE listing_id = $1 AND id != $2 AND status IN ('pending','countered')`,
      [offer.listing_id, req.params.id]
    );
    await query(`UPDATE listings SET status = 'reserved' WHERE id = $1`, [offer.listing_id]);

    const fee = agreedPrice * 0.04;
    const sellerReceives = agreedPrice - (agreedPrice * 0.02);
    await query(
      `INSERT INTO transactions (offer_id, listing_id, buyer_id, seller_id, agreed_price, platform_fee, seller_receives)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.params.id, offer.listing_id, req.userId, offer.seller_id, agreedPrice, fee, sellerReceives]
    );

    const listingAC = await queryOne<any>(`SELECT user_edited_title FROM listings WHERE id = $1`, [offer.listing_id]);
    const txAC = await queryOne<any>(`SELECT id FROM transactions WHERE offer_id = $1`, [req.params.id]);
    notifyOfferAccepted(offer.seller_id, listingAC?.user_edited_title ?? '', offer.listing_id, txAC?.id ?? '').catch(() => {});

    res.json({ message: 'Counter offer accepted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
