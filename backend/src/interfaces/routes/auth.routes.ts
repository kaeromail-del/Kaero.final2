import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requestOTP, verifyOTP, refreshAccessToken } from '../../application/auth.service';

const router = Router();

const phoneSchema = z.object({
  phone: z.string().min(10).max(20).regex(/^\+?[0-9]+$/),
});

// Mobile sends { phone, otp } — field is "otp" not "code"
const verifySchema = z.object({
  phone: z.string().min(10).max(20),
  otp: z.string().length(6),
});

// Mobile sends { refresh_token } — snake_case
const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

// POST /api/v1/auth/otp/request
router.post('/otp/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = phoneSchema.parse(req.body);
    const result = await requestOTP(phone);
    res.json({ message: 'OTP sent.', expiresAt: result.expiresAt });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/otp/verify
router.post('/otp/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, otp } = verifySchema.parse(req.body);
    const { user, accessToken, refreshToken, isNewUser } = await verifyOTP(phone, otp);
    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        full_name: user.full_name,
        is_phone_verified: user.is_phone_verified,
        is_id_verified: user.is_id_verified,
        trust_score: user.trust_score,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
      is_new_user: isNewUser,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = refreshSchema.parse(req.body);
    const result = await refreshAccessToken(refresh_token);
    res.json({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
