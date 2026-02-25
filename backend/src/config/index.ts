import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  database: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kaero',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    enabled: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
  },

  paymob: {
    apiKey: process.env.PAYMOB_API_KEY || '',
    integrationId: parseInt(process.env.PAYMOB_INTEGRATION_ID || '0', 10),
    iframeId: process.env.PAYMOB_IFRAME_ID || '',
    hmacSecret: process.env.PAYMOB_HMAC_SECRET || '',
    enabled: !!(process.env.PAYMOB_API_KEY && process.env.PAYMOB_INTEGRATION_ID),
  },

  platform: {
    feePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '4') / 100,
    minWithdrawal: parseInt(process.env.MIN_WITHDRAWAL_EGP || '100', 10),
  },
} as const;
