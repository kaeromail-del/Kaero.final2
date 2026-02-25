import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { query, queryOne } from '../infrastructure/database/pool';
import { sendOTP } from '../infrastructure/sms/sms.service';
import { setOtp, getOtp, deleteOtp, incrementOtpAttempts, resetOtpAttempts } from '../infrastructure/redis/redis.client';
import type { User } from '../domain/entities';

// ─── OTP ─────────────────────────────────────────────────

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function requestOTP(phone: string): Promise<{ otp: string; expiresAt: Date }> {
  // Rate-limit via Redis (falls back to DB count if Redis is unavailable)
  try {
    const attempts = await incrementOtpAttempts(phone);
    if (attempts > 5) {
      throw new AppError('Too many OTP requests. Try again in 10 minutes.', 429);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Redis down — fall back to DB-based rate limit
    const recent = await query(
      `SELECT COUNT(*) as cnt FROM otp_codes WHERE phone = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
      [phone]
    );
    if (parseInt((recent[0] as any).cnt) >= 5) {
      throw new AppError('Too many OTP requests. Try again later.', 429);
    }
  }

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store in Redis (primary) with DB as audit trail / fallback
  try {
    await setOtp(phone, code);
  } catch {
    // Redis down — DB-only path
  }
  await query(
    `INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)`,
    [phone, code, expiresAt]
  );

  await sendOTP(phone, code);
  return { otp: code, expiresAt };
}

export async function verifyOTP(
  phone: string,
  code: string
): Promise<{ user: User; accessToken: string; refreshToken: string; isNewUser: boolean }> {
  // Verify OTP — try Redis first, fall back to DB
  let verified = false;
  try {
    const stored = await getOtp(phone);
    if (stored === code) {
      verified = true;
      await deleteOtp(phone);
      await resetOtpAttempts(phone);
    }
  } catch {
    // Redis unavailable — fall through to DB check
  }

  if (!verified) {
    const otp = await queryOne<any>(
      `SELECT * FROM otp_codes
       WHERE phone = $1 AND code = $2 AND verified_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, code]
    );
    if (!otp) {
      await query(
        `UPDATE otp_codes SET attempts = attempts + 1
         WHERE id = (SELECT id FROM otp_codes WHERE phone = $1 AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1)`,
        [phone]
      );
      throw new AppError('Invalid or expired OTP.', 401);
    }
    await query(`UPDATE otp_codes SET verified_at = NOW() WHERE id = $1`, [otp.id]);
  } else {
    // Best-effort: mark the DB row as verified too
    query(`UPDATE otp_codes SET verified_at = NOW() WHERE phone = $1 AND code = $2 AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1`, [phone, code]).catch(() => {});
  }

  // Find or create user
  let user = await queryOne<User>(`SELECT * FROM users WHERE phone = $1`, [phone]);
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    const rows = await query<User>(
      `INSERT INTO users (phone, is_phone_verified) VALUES ($1, TRUE) RETURNING *`,
      [phone]
    );
    user = rows[0];
  } else if (!user.is_phone_verified) {
    await query(`UPDATE users SET is_phone_verified = TRUE WHERE id = $1`, [user.id]);
    user.is_phone_verified = true;
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);

  return { user, accessToken, refreshToken, isNewUser };
}

// ─── JWT ─────────────────────────────────────────────────

function generateAccessToken(user: User): string {
  return jwt.sign(
    { sub: user.id, phone: user.phone, verified: user.is_phone_verified },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
  );
}

async function generateRefreshToken(userId: string, deviceFingerprint?: string): Promise<string> {
  const raw = uuidv4();
  const hash = await bcrypt.hash(raw, 10);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_fingerprint, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hash, deviceFingerprint ?? null, expiresAt]
  );

  // Encode userId + raw token together
  return Buffer.from(`${userId}:${raw}`).toString('base64');
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  let userId: string;
  let raw: string;

  try {
    const decoded = Buffer.from(refreshToken, 'base64').toString();
    [userId, raw] = decoded.split(':');
  } catch {
    throw new AppError('Invalid refresh token.', 401);
  }

  // Find all valid (non-revoked, non-expired) tokens for this user
  const tokens = await query<any>(
    `SELECT * FROM refresh_tokens
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );

  let matched = false;
  let matchedTokenId: string | null = null;

  for (const t of tokens) {
    if (await bcrypt.compare(raw, t.token_hash)) {
      matched = true;
      matchedTokenId = t.id;
      break;
    }
  }

  if (!matched || !matchedTokenId) {
    throw new AppError('Invalid or expired refresh token.', 401);
  }

  // Revoke the used refresh token (rotation)
  await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [matchedTokenId]);

  const user = await queryOne<User>(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (!user) throw new AppError('User not found.', 404);

  const accessToken = generateAccessToken(user);
  const newRefreshToken = await generateRefreshToken(userId);

  return { accessToken, refreshToken: newRefreshToken };
}

export function verifyAccessToken(token: string): { sub: string; phone: string; verified: boolean } {
  try {
    return jwt.verify(token, config.jwt.secret) as any;
  } catch {
    throw new AppError('Invalid or expired access token.', 401);
  }
}

// ─── Error class ─────────────────────────────────────────

export class AppError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'AppError';
  }
}
