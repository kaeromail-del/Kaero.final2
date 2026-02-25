import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../infrastructure/database/pool';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';
import { notifyUser } from '../../infrastructure/notifications/push';

const router = Router();

// ─── GET /referral/me ─────────────────────────────────────
// Returns the user's referral code, credits, and referred friends list

router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;

    // Ensure user has a referral code (generate if missing)
    const user = await queryOne<{ referral_code: string | null; referral_credits: number }>(
      'SELECT referral_code, referral_credits FROM users WHERE id = $1',
      [userId],
    );

    let code = user?.referral_code;
    if (!code) {
      // Generate a unique 8-char code
      code = Math.random().toString(36).substring(2, 10).toUpperCase();
      await query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, userId]);
    }

    // Friends referred by this user
    const friends = await query<{ full_name: string; created_at: string; has_transacted: boolean }>(
      `SELECT full_name, created_at,
         EXISTS (
           SELECT 1 FROM transactions t
           WHERE (t.buyer_id = u.id OR t.seller_id = u.id)
             AND t.payment_status = 'released'
         ) AS has_transacted
       FROM users u
       WHERE referred_by = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId],
    );

    res.json({
      referral_code: code,
      referral_credits: user?.referral_credits ?? 0,
      total_referred: friends.length,
      friends: friends,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /referral/apply ──────────────────────────────────
// A new user applies someone else's referral code during onboarding

router.post('/apply', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const { code } = z.object({ code: z.string().min(4).max(20) }).parse(req.body);

    // Check user hasn't already been referred
    const me = await queryOne<{ referred_by: string | null; referral_code: string }>(
      'SELECT referred_by, referral_code FROM users WHERE id = $1',
      [userId],
    );

    if (me?.referred_by) {
      res.status(400).json({ error: 'You have already used a referral code.' });
      return;
    }

    // Find owner of the code (cannot refer yourself)
    const referrer = await queryOne<{ id: string; full_name: string; referral_code: string }>(
      'SELECT id, full_name, referral_code FROM users WHERE referral_code = $1',
      [code.toUpperCase()],
    );

    if (!referrer) {
      res.status(404).json({ error: 'Invalid referral code.' });
      return;
    }
    if (referrer.id === userId) {
      res.status(400).json({ error: 'You cannot use your own referral code.' });
      return;
    }
    if (me?.referral_code === code.toUpperCase()) {
      res.status(400).json({ error: 'Invalid referral code.' });
      return;
    }

    // Link referral + give both parties 50 EGP credits
    await query(
      `UPDATE users SET referred_by = $1, referral_credits = referral_credits + 50 WHERE id = $2`,
      [referrer.id, userId],
    );
    await query(
      `UPDATE users SET referral_credits = referral_credits + 50 WHERE id = $1`,
      [referrer.id],
    );

    // Notify referrer
    await notifyUser(referrer.id, 'referral_joined', {
      title: 'Friend joined via your referral!',
      body: 'You and your friend each earned 50 EGP credits.',
      data: { screen: 'referral' },
    }).catch(() => {});

    res.json({ message: 'Referral code applied. You earned 50 EGP credits!', credits_earned: 50 });
  } catch (err) {
    next(err);
  }
});

// ─── POST /referral/reward ─────────────────────────────────
// Internal: called after first completed transaction to reward referrer bonus
// (Called from transaction confirm flow in transaction.routes.ts)

export async function checkAndRewardReferral(userId: string): Promise<void> {
  const user = await queryOne<{ referred_by: string | null }>(
    'SELECT referred_by FROM users WHERE id = $1',
    [userId],
  );
  if (!user?.referred_by) return;

  // Only reward once (check if referrer already got a bonus for this user)
  const alreadyRewarded = await queryOne<{ id: string }>(
    `SELECT id FROM notifications WHERE user_id = $1 AND type = 'referral_transacted' AND data->>'referred_user' = $2`,
    [user.referred_by, userId],
  );
  if (alreadyRewarded) return;

  // +100 EGP bonus for first completed transaction of referred user
  await query('UPDATE users SET referral_credits = referral_credits + 100 WHERE id = $1', [user.referred_by]);
  await notifyUser(user.referred_by, 'referral_transacted', {
    title: 'Referral bonus unlocked!',
    body: 'Your referred friend completed their first transaction. You earned 100 EGP credits!',
    data: { screen: 'referral', referred_user: userId },
  }).catch(() => {});
}

export default router;
