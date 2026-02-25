import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './interfaces/middleware/error.middleware';
import { healthCheck } from './infrastructure/database/pool';

// Route imports
import authRoutes from './interfaces/routes/auth.routes';
import userRoutes from './interfaces/routes/user.routes';
import listingRoutes from './interfaces/routes/listing.routes';
import offerRoutes from './interfaces/routes/offer.routes';
import categoryRoutes from './interfaces/routes/category.routes';
import chatRoutes from './interfaces/routes/chat.routes';
import transactionRoutes from './interfaces/routes/transaction.routes';
import aiRoutes from './interfaces/routes/ai.routes';
import uploadRoutes from './interfaces/routes/upload.routes';
import reviewRoutes from './interfaces/routes/review.routes';
import notificationRoutes from './interfaces/routes/notification.routes';
import referralRoutes from './interfaces/routes/referral.routes';
import promoRoutes from './interfaces/routes/promo.routes';
import walletRoutes from './interfaces/routes/wallet.routes';
import adminRoutes from './interfaces/routes/admin.routes';

const app = express();

// ─── Static files (uploaded images) ─────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// ─── Global Middleware ───────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.cors.origin }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.isDev) {
  app.use(morgan('dev'));
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests. Try again later.' },
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts. Try again later.' },
});
app.use('/api/v1/auth/', authLimiter);

// ─── Health Check ────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const dbOk = await healthCheck();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbOk ? 'connected' : 'disconnected',
  });
});

// ─── API Routes ──────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/listings', listingRoutes);
app.use('/api/v1/offers', offerRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/referral', referralRoutes);
app.use('/api/v1/promo', promoRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/admin', adminRoutes);

// ─── 404 Handler ─────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ─── Error Handler ───────────────────────────────────────
app.use(errorHandler);

export default app;
