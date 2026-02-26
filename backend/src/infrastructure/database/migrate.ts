import { pool } from './pool';

const UP = `
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ─── Users ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  full_name VARCHAR(100),
  avatar_url VARCHAR(500),
  is_phone_verified BOOLEAN DEFAULT FALSE,
  is_id_verified BOOLEAN DEFAULT FALSE,
  id_image_url VARCHAR(500),
  selfie_image_url VARCHAR(500),
  trust_score DECIMAL(3,2) DEFAULT 0.00 CHECK (trust_score >= 0 AND trust_score <= 5),
  total_reviews INTEGER DEFAULT 0,
  location GEOGRAPHY(POINT,4326),
  preferred_radius INTEGER DEFAULT 2000,
  fcm_token VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  stripe_customer_id VARCHAR(100),
  fawry_customer_token VARCHAR(100),
  preferred_language VARCHAR(2) DEFAULT 'ar',
  device_fingerprint VARCHAR(255),
  behavioral_score DECIMAL(5,2) DEFAULT 100.00
);

-- ─── Categories ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES categories(id),
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  icon_url VARCHAR(255),
  ai_keywords JSONB DEFAULT '[]',
  commission_rate DECIMAL(4,3) DEFAULT 0.040,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0
);

-- ─── Listings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ai_generated_title VARCHAR(200),
  ai_generated_description TEXT,
  ai_suggested_price DECIMAL(10,2),
  user_edited_title VARCHAR(200) NOT NULL,
  user_edited_description TEXT NOT NULL,
  final_price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  category_id INTEGER REFERENCES categories(id),
  condition VARCHAR(20) CHECK (condition IN ('new','like_new','good','fair','poor')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','reserved','sold','deleted','under_review')),
  location GEOGRAPHY(POINT,4326) NOT NULL,
  location_accuracy INTEGER,
  is_ai_generated BOOLEAN DEFAULT TRUE,
  ai_confidence_score DECIMAL(3,2),
  verification_images JSONB NOT NULL DEFAULT '[]',
  primary_image_url VARCHAR(500) NOT NULL,
  additional_images JSONB DEFAULT '[]',
  view_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  offer_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),
  is_featured BOOLEAN DEFAULT FALSE,
  featured_until TIMESTAMP,
  search_vector TSVECTOR,
  fraud_risk_score DECIMAL(3,2) DEFAULT 0.00,
  moderation_status VARCHAR(20) DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected','flagged'))
);

-- ─── Offers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  offered_price DECIMAL(10,2) NOT NULL,
  counter_price DECIMAL(10,2),
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired','countered')),
  is_exchange_proposal BOOLEAN DEFAULT FALSE,
  exchange_listing_id UUID REFERENCES listings(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '48 hours'),
  seller_response_time INTEGER
);

-- ─── Transactions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES offers(id),
  listing_id UUID REFERENCES listings(id),
  buyer_id UUID REFERENCES users(id),
  seller_id UUID REFERENCES users(id),
  agreed_price DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  seller_receives DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20) CHECK (payment_method IN ('fawry','instapay','vodafone_cash','wallet','cash')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','held','released','refunded','disputed')),
  escrow_hold_until TIMESTAMP,
  buyer_confirmation BOOLEAN DEFAULT FALSE,
  seller_confirmation BOOLEAN DEFAULT FALSE,
  dispute_status VARCHAR(20) DEFAULT 'none' CHECK (dispute_status IN ('none','opened','under_review','resolved_buyer','resolved_seller')),
  dispute_reason TEXT,
  dispute_evidence JSONB,
  police_report_url VARCHAR(500),
  refund_amount DECIMAL(10,2),
  refunded_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  qr_code_data VARCHAR(255),
  meeting_location GEOGRAPHY(POINT,4326),
  meeting_address TEXT
);

-- ─── Reviews ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  reviewer_id UUID REFERENCES users(id),
  reviewee_id UUID REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  category VARCHAR(20) CHECK (category IN ('buyer','seller')),
  is_verified_purchase BOOLEAN DEFAULT TRUE,
  helpful_count INTEGER DEFAULT 0,
  reported_count INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── Chats ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id),
  buyer_id UUID REFERENCES users(id),
  seller_id UUID REFERENCES users(id),
  offer_id UUID REFERENCES offers(id),
  created_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP,
  is_blocked BOOLEAN DEFAULT FALSE,
  block_reason TEXT
);

-- ─── Messages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text','image','voice','location','offer','system')),
  content TEXT,
  media_url VARCHAR(500),
  voice_duration INTEGER,
  location GEOGRAPHY(POINT,4326),
  offer_amount DECIMAL(10,2),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- ─── User Favorites ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites (user_id);

-- ─── Reports ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL,
  details TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_listing ON reports (listing_id);

-- ─── Notifications ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

-- ─── Fraud Detection Logs ────────────────────────────────
CREATE TABLE IF NOT EXISTS fraud_detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  listing_id UUID REFERENCES listings(id),
  transaction_id UUID REFERENCES transactions(id),
  detection_type VARCHAR(50),
  risk_score DECIMAL(3,2),
  triggered_rules JSONB,
  action_taken VARCHAR(20),
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── Subscriptions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  plan_type VARCHAR(20) CHECK (plan_type IN ('free','premium')),
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  payment_id VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  benefits_used JSONB DEFAULT '{}'
);

-- ─── Refresh Tokens ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device_fingerprint VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

-- ─── OTP Codes ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ═══ INDEXES ═════════════════════════════════════════════

-- Geospatial
CREATE INDEX IF NOT EXISTS idx_listings_location ON listings USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST (location);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_listings_search ON listings USING GIN (search_vector);

-- B-tree lookups
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings (category_id);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings (seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_category_created ON listings (category_id, created_at DESC);

-- Partial index for active listings
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings (created_at DESC) WHERE status = 'active';

-- Chat / message lookups
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_participants ON chats (buyer_id, seller_id);

-- Offers
CREATE INDEX IF NOT EXISTS idx_offers_listing ON offers (listing_id);
CREATE INDEX IF NOT EXISTS idx_offers_buyer ON offers (buyer_id);

-- Auth
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes (phone, created_at DESC);

-- ═══ ADDENDUM: live-database upgrades (idempotent) ════════
-- Add counter_price column if upgrading from an older schema
ALTER TABLE IF EXISTS offers ADD COLUMN IF NOT EXISTS counter_price DECIMAL(10,2);
-- Add is_admin column to users
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
-- Add id_verification_status column to users
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_verification_status VARCHAR(20) DEFAULT 'none';
-- Widen status constraint to include 'countered'
DO $$ BEGIN
  ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_status_check;
  ALTER TABLE offers ADD CONSTRAINT offers_status_check
    CHECK (status IN ('pending','accepted','rejected','expired','countered'));
EXCEPTION WHEN others THEN NULL; END $$;

-- ── Phase 3: Referral system ──────────────────────────────
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12) UNIQUE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS referral_credits INTEGER DEFAULT 0;

-- Generate referral codes for existing users who don't have one
UPDATE users SET referral_code = UPPER(SUBSTRING(MD5(id::text || phone) FROM 1 FOR 8)) WHERE referral_code IS NULL;

-- ── Phase 3: Promo codes ──────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  max_uses INTEGER DEFAULT 100,
  used_count INTEGER DEFAULT 0,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID REFERENCES promo_codes(id),
  user_id UUID REFERENCES users(id),
  transaction_id UUID REFERENCES transactions(id),
  discount_applied DECIMAL(10,2),
  used_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (code_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes (code) WHERE is_active = TRUE;

-- ── Phase 3: Boost (listings already have is_featured / featured_until) ──
-- Ensure boost_tier exists for tiered boosts
ALTER TABLE IF EXISTS listings ADD COLUMN IF NOT EXISTS boost_tier VARCHAR(10) DEFAULT NULL;

-- ── Phase 4: Seller Wallet ─────────────────────────────────
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS wallet_pending DECIMAL(12,2) DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('credit','debit','fee','withdrawal','referral_bonus','promo_credit')),
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2),
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(20),
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(20) NOT NULL CHECK (method IN ('bank_transfer','vodafone_cash','instapay','fawry')),
  account_details JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected')),
  admin_notes TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON withdrawal_requests (user_id, created_at DESC);

-- ── Phase 4: Paymob payment intent tracking ───────────────
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  provider VARCHAR(20) DEFAULT 'paymob',
  provider_order_id VARCHAR(100),
  provider_payment_key VARCHAR(500),
  amount_cents INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  webhook_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_intents_tx ON payment_intents (transaction_id);

-- ── Phase 4: Premium subscriptions (table already exists, add missing columns) ──
ALTER TABLE IF EXISTS subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS subscriptions ADD COLUMN IF NOT EXISTS paymob_subscription_id VARCHAR(100);

-- ── Phase 5: AI & Intelligence ────────────────────────────
-- Track which listings a user has viewed (for personalized feed)
CREATE TABLE IF NOT EXISTS user_listing_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id),
  price_range VARCHAR(20),
  viewed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_views_user ON user_listing_views (user_id, viewed_at DESC);

-- Moderation audit log
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('auto_approved','auto_flagged','auto_rejected','manual_approved','manual_rejected')),
  reason TEXT,
  triggered_keywords JSONB DEFAULT '[]',
  risk_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Store AI assistant conversation context per user (last 20 msgs, rolling)
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS ai_conversation JSONB DEFAULT '[]';

-- ═══ TRIGGER: auto-update search_vector ══════════════════

CREATE OR REPLACE FUNCTION update_listing_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.user_edited_title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.user_edited_description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_listing_search_vector ON listings;
CREATE TRIGGER trg_listing_search_vector
  BEFORE INSERT OR UPDATE OF user_edited_title, user_edited_description ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_search_vector();

-- ═══ TRIGGER: auto-update updated_at ═════════════════════

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_listings_updated ON listings;
CREATE TRIGGER trg_listings_updated
  BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ─── Performance Indexes ────────────────────────────────────────────────────

-- Listings: most common query patterns
CREATE INDEX IF NOT EXISTS idx_listings_status_moderation
  ON listings(status, moderation_status);

CREATE INDEX IF NOT EXISTS idx_listings_seller_id
  ON listings(seller_id);

CREATE INDEX IF NOT EXISTS idx_listings_category_id
  ON listings(category_id);

CREATE INDEX IF NOT EXISTS idx_listings_created_at
  ON listings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_featured
  ON listings(is_featured, featured_until)
  WHERE is_featured = TRUE;

CREATE INDEX IF NOT EXISTS idx_listings_fraud_risk
  ON listings(fraud_risk_score)
  WHERE fraud_risk_score > 0.5;

-- Full-text search vector (already likely has GiST index from PostGIS, add btree for tsvector)
CREATE INDEX IF NOT EXISTS idx_listings_search_vector
  ON listings USING GIN(search_vector);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id
  ON transactions(buyer_id);

CREATE INDEX IF NOT EXISTS idx_transactions_seller_id
  ON transactions(seller_id);

CREATE INDEX IF NOT EXISTS idx_transactions_payment_status
  ON transactions(payment_status);

CREATE INDEX IF NOT EXISTS idx_transactions_listing_id
  ON transactions(listing_id);

-- Offers
CREATE INDEX IF NOT EXISTS idx_offers_listing_id
  ON offers(listing_id);

CREATE INDEX IF NOT EXISTS idx_offers_buyer_id
  ON offers(buyer_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC);

-- Wallet transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id
  ON wallet_transactions(user_id, created_at DESC);

-- User listing views (personalized feed)
CREATE INDEX IF NOT EXISTS idx_user_listing_views_user_id
  ON user_listing_views(user_id, viewed_at DESC);

-- Chats / messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id
  ON messages(chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chats_participants
  ON chats(buyer_id, seller_id);

-- Reports
CREATE INDEX IF NOT EXISTS idx_reports_listing_id
  ON reports(listing_id);
`;

const DOWN = `
DROP TABLE IF EXISTS otp_codes CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS fraud_detection_logs CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS update_listing_search_vector CASCADE;
DROP FUNCTION IF EXISTS update_timestamp CASCADE;
`;

async function main() {
  const direction = process.argv[2];

  if (direction === 'down') {
    console.log('⬇ Rolling back migration...');
    await pool.query(DOWN);
    console.log('✓ Rollback complete.');
  } else {
    console.log('⬆ Running migration...');
    await pool.query(UP);
    console.log('✓ Migration complete.');
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
