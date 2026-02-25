import { Router, Response, NextFunction } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';
import { query, queryOne } from '../../infrastructure/database/pool';
import { AppError } from '../../application/auth.service';
import { z } from 'zod';

const router = Router();

// GET /api/v1/chats
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const chats = await query(
      `SELECT c.*,
        l.user_edited_title as listing_title,
        l.primary_image_url as listing_image,
        l.final_price as listing_price,
        l.status as listing_status,
        l.id as listing_id,
        CASE WHEN c.buyer_id = $1 THEN seller.full_name ELSE buyer.full_name END as other_user_name,
        CASE WHEN c.buyer_id = $1 THEN seller.avatar_url ELSE buyer.avatar_url END as other_user_avatar,
        CASE WHEN c.buyer_id = $1 THEN seller.id ELSE buyer.id END as other_user_id,
        m.content as last_message,
        m.message_type as last_message_type,
        m.created_at as last_message_at,
        m.sender_id as last_message_sender_id,
        (SELECT COUNT(*) FROM messages msg2 WHERE msg2.chat_id = c.id AND msg2.is_read = false AND msg2.sender_id != $1)::int as unread_count
      FROM chats c
      JOIN listings l ON c.listing_id = l.id
      JOIN users seller ON c.seller_id = seller.id
      JOIN users buyer ON c.buyer_id = buyer.id
      LEFT JOIN LATERAL (
        SELECT content, message_type, created_at, sender_id FROM messages
        WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1
      ) m ON true
      WHERE (c.buyer_id = $1 OR c.seller_id = $1) AND c.is_blocked = false
      ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
      [userId]
    );
    res.json({ chats });
  } catch (err) { next(err); }
});

// GET /api/v1/chats/:id/messages
router.get('/:id/messages', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const limit = parseInt((req.query.limit as string) || '30');
    const cursor = req.query.cursor as string | undefined;

    const chat = await queryOne<any>('SELECT * FROM chats WHERE id = $1', [id]);
    if (!chat) throw new AppError('Chat not found', 404);
    if (chat.buyer_id !== userId && chat.seller_id !== userId) throw new AppError('Forbidden', 403);

    let msgs: any[];
    if (cursor) {
      msgs = await query(
        `SELECT m.*, u.full_name as sender_name, u.avatar_url as sender_avatar
         FROM messages m JOIN users u ON m.sender_id = u.id
         WHERE m.chat_id = $1 AND m.created_at < (SELECT created_at FROM messages WHERE id = $2)
         ORDER BY m.created_at DESC LIMIT $3`,
        [id, cursor, limit]
      );
    } else {
      msgs = await query(
        `SELECT m.*, u.full_name as sender_name, u.avatar_url as sender_avatar
         FROM messages m JOIN users u ON m.sender_id = u.id
         WHERE m.chat_id = $1 ORDER BY m.created_at DESC LIMIT $2`,
        [id, limit]
      );
    }

    await query(
      `UPDATE messages SET is_read = true WHERE chat_id = $1 AND sender_id != $2 AND is_read = false`,
      [id, userId]
    );

    const reversed = [...msgs].reverse();
    res.json({ messages: reversed, next_cursor: msgs.length === limit ? msgs[msgs.length - 1]?.id : null });
  } catch (err) { next(err); }
});

// POST /api/v1/chats
router.post('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const buyerId = req.userId!;
    const { listing_id } = z.object({ listing_id: z.string().uuid() }).parse(req.body);

    const listing = await queryOne<any>('SELECT * FROM listings WHERE id = $1 AND status = $2', [listing_id, 'active']);
    if (!listing) throw new AppError('Listing not found or not active', 404);
    if (listing.seller_id === buyerId) throw new AppError('Cannot chat with yourself', 400);

    const existing = await queryOne<any>('SELECT * FROM chats WHERE listing_id = $1 AND buyer_id = $2', [listing_id, buyerId]);
    if (existing) return res.json({ chat: existing, created: false });

    const chat = await queryOne(
      `INSERT INTO chats (listing_id, buyer_id, seller_id) VALUES ($1,$2,$3) RETURNING *`,
      [listing_id, buyerId, listing.seller_id]
    );
    res.status(201).json({ chat, created: true });
  } catch (err) { next(err); }
});

// POST /api/v1/chats/:id/messages
router.post('/:id/messages', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const schema = z.object({
      message_type: z.enum(['text', 'image', 'voice', 'location', 'offer', 'system']).default('text'),
      content: z.string().max(2000).optional(),
      media_url: z.string().url().optional(),
    });
    const body = schema.parse(req.body);
    if (!body.content && !body.media_url) throw new AppError('Message must have content or media', 400);

    const chat = await queryOne<any>('SELECT * FROM chats WHERE id = $1', [id]);
    if (!chat) throw new AppError('Chat not found', 404);
    if (chat.buyer_id !== userId && chat.seller_id !== userId) throw new AppError('Forbidden', 403);
    if (chat.is_blocked) throw new AppError('This chat is blocked', 403);

    const message = await queryOne(
      `INSERT INTO messages (chat_id, sender_id, message_type, content, media_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, userId, body.message_type, body.content ?? null, body.media_url ?? null]
    );
    await query('UPDATE chats SET last_message_at = NOW() WHERE id = $1', [id]);
    res.status(201).json({ message });
  } catch (err) { next(err); }
});

export default router;
