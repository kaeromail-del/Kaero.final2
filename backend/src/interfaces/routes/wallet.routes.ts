import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../infrastructure/database/pool';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';
import { AppError } from '../../application/auth.service';
import { config } from '../../config';
import { initiatePaymobPayment } from '../../infrastructure/payments/paymob.service';
import { verifyPaymobWebhook } from '../../infrastructure/payments/paymob.service';

const router = Router();

// ─── GET /wallet/me ───────────────────────────────────────
// Current balance + pending + summary

router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const user = await queryOne<{ wallet_balance: number; wallet_pending: number }>(
      'SELECT wallet_balance, wallet_pending FROM users WHERE id = $1',
      [userId],
    );

    const recent = await query(
      `SELECT id, type, amount, description, reference_type, status, created_at
       FROM wallet_transactions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [userId],
    );

    const stats = await queryOne<{ total_earned: number; total_withdrawn: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_earned,
         COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawn
       FROM wallet_transactions WHERE user_id = $1 AND status = 'completed'`,
      [userId],
    );

    res.json({
      balance: Number(user?.wallet_balance ?? 0),
      pending: Number(user?.wallet_pending ?? 0),
      total_earned: Number(stats?.total_earned ?? 0),
      total_withdrawn: Number(stats?.total_withdrawn ?? 0),
      recent_transactions: recent,
    });
  } catch (err) { next(err); }
});

// ─── GET /wallet/transactions ─────────────────────────────

router.get('/transactions', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { limit = '30', offset = '0' } = req.query as Record<string, string>;

    const txns = await query(
      `SELECT * FROM wallet_transactions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)],
    );

    res.json({ transactions: txns });
  } catch (err) { next(err); }
});

// ─── POST /wallet/withdraw ────────────────────────────────

const withdrawSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['bank_transfer', 'vodafone_cash', 'instapay', 'fawry']),
  account_details: z.object({
    account_name: z.string().min(2).max(100),
    account_number: z.string().min(5).max(50).optional(),
    bank_name: z.string().max(100).optional(),
    phone_number: z.string().max(20).optional(),
    iban: z.string().max(34).optional(),
  }),
});

router.post('/withdraw', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const body = withdrawSchema.parse(req.body);

    const minAmount = config.platform.minWithdrawal;
    if (body.amount < minAmount) {
      throw new AppError(`Minimum withdrawal is ${minAmount} EGP`, 400);
    }

    const user = await queryOne<{ wallet_balance: number }>(
      'SELECT wallet_balance FROM users WHERE id = $1',
      [userId],
    );
    if (!user || Number(user.wallet_balance) < body.amount) {
      throw new AppError('Insufficient wallet balance', 400);
    }

    // Deduct balance immediately and create pending withdrawal
    await query(
      'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
      [body.amount, userId],
    );

    const withdrawal = await queryOne(
      `INSERT INTO withdrawal_requests (user_id, amount, method, account_details)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, body.amount, body.method, JSON.stringify(body.account_details)],
    );

    // Log wallet transaction
    await query(
      `INSERT INTO wallet_transactions (user_id, type, amount, description, reference_id, reference_type, status)
       VALUES ($1, 'withdrawal', $2, $3, $4, 'withdrawal', 'pending')`,
      [userId, body.amount, `Withdrawal via ${body.method}`, withdrawal?.id],
    );

    res.status(201).json({
      message: 'Withdrawal request submitted. Processing within 1–3 business days.',
      withdrawal,
    });
  } catch (err) { next(err); }
});

// ─── GET /wallet/withdrawals ──────────────────────────────

router.get('/withdrawals', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT id, amount, method, status, created_at, processed_at, admin_notes
       FROM withdrawal_requests WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.userId!],
    );
    res.json({ withdrawals: rows });
  } catch (err) { next(err); }
});

// ─── POST /wallet/paymob/initiate ────────────────────────
// Buyer initiates a card payment via Paymob for a transaction

router.post('/paymob/initiate', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { transaction_id } = z.object({ transaction_id: z.string().uuid() }).parse(req.body);

    const txn = await queryOne<any>(
      `SELECT t.*, u.full_name, u.email, u.phone
       FROM transactions t JOIN users u ON u.id = t.buyer_id
       WHERE t.id = $1`,
      [transaction_id],
    );
    if (!txn) throw new AppError('Transaction not found', 404);
    if (txn.buyer_id !== userId) throw new AppError('Forbidden', 403);
    if (txn.payment_status !== 'pending') throw new AppError('Already paid', 400);

    const result = await initiatePaymobPayment(transaction_id, Number(txn.agreed_price), {
      full_name: txn.full_name,
      email: txn.email,
      phone: txn.phone,
    });

    res.json(result);
  } catch (err) { next(err); }
});

// ─── POST /wallet/paymob/webhook ─────────────────────────
// Paymob notifies us of payment completion

router.post('/paymob/webhook', async (req, res, next) => {
  try {
    const hmac = req.query.hmac as string;
    if (!verifyPaymobWebhook(req.body?.obj ?? {}, hmac)) {
      res.status(400).json({ error: 'Invalid HMAC' });
      return;
    }

    const obj = req.body?.obj;
    if (!obj?.success || obj?.pending) {
      res.sendStatus(200); // acknowledged but payment not completed
      return;
    }

    // Find intent by provider order id
    const intent = await queryOne<any>(
      `SELECT * FROM payment_intents WHERE provider_order_id = $1`,
      [String(obj.order?.id)],
    );

    if (intent && intent.status === 'pending') {
      await query(
        `UPDATE payment_intents SET status = 'paid', webhook_data = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(obj), intent.id],
      );

      // Mark transaction as held (escrow)
      const txn = await queryOne<any>('SELECT * FROM transactions WHERE id = $1', [intent.transaction_id]);
      if (txn && txn.payment_status === 'pending') {
        await query(
          `UPDATE transactions SET payment_status = 'held', payment_method = 'paymob',
           escrow_hold_until = NOW() + INTERVAL '3 days' WHERE id = $1`,
          [intent.transaction_id],
        );
      }
    }

    res.sendStatus(200);
  } catch (err) { next(err); }
});

// ─── Helper: credit seller wallet after transaction release ─
// Called from transaction confirm route

export async function creditSellerWallet(
  sellerId: string,
  amount: number,
  transactionId: string,
  description: string,
): Promise<void> {
  await query(
    'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
    [amount, sellerId],
  );

  const user = await queryOne<{ wallet_balance: number }>(
    'SELECT wallet_balance FROM users WHERE id = $1',
    [sellerId],
  );

  await query(
    `INSERT INTO wallet_transactions
       (user_id, type, amount, balance_after, description, reference_id, reference_type, status)
     VALUES ($1, 'credit', $2, $3, $4, $5, 'transaction', 'completed')`,
    [sellerId, amount, user?.wallet_balance ?? amount, description, transactionId],
  );
}

export default router;
