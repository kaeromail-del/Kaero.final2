import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableOfflineQueue: false,
});

redis.on('error', (err) => {
  console.warn('[Redis] connection error (non-fatal):', err.message);
});

// ─── OTP helpers ─────────────────────────────────────────

export async function setOtp(phone: string, code: string): Promise<void> {
  await redis.set(`otp:${phone}`, code, 'EX', 600); // 10-min TTL
}

export async function getOtp(phone: string): Promise<string | null> {
  return redis.get(`otp:${phone}`);
}

export async function deleteOtp(phone: string): Promise<void> {
  await redis.del(`otp:${phone}`);
}

export async function incrementOtpAttempts(phone: string): Promise<number> {
  const key = `otp_attempts:${phone}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 600); // start 10-min window
  return count;
}

export async function resetOtpAttempts(phone: string): Promise<void> {
  await redis.del(`otp_attempts:${phone}`);
}
