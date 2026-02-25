// ─── User ────────────────────────────────────────────────
export interface User {
  id: string;
  phone: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_phone_verified: boolean;
  is_id_verified: boolean;
  trust_score: number;
  total_reviews: number;
  location: { lat: number; lng: number } | null;
  preferred_radius: number;
  preferred_language: 'ar' | 'en';
  behavioral_score: number;
  is_banned: boolean;
  created_at: Date;
  updated_at: Date;
  last_active_at: Date | null;
}

// ─── Category ────────────────────────────────────────────
export interface Category {
  id: number;
  parent_id: number | null;
  name_en: string;
  name_ar: string;
  icon_url: string | null;
  ai_keywords: string[];
  commission_rate: number;
  is_active: boolean;
  display_order: number;
}

// ─── Listing ─────────────────────────────────────────────
export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';
export type ListingStatus = 'active' | 'reserved' | 'sold' | 'deleted' | 'under_review';
export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export interface VerificationImage {
  url: string;
  timestamp: string;
  exif_data: Record<string, unknown> | null;
  hash: string;
}

export interface Listing {
  id: string;
  seller_id: string;
  ai_generated_title: string | null;
  ai_generated_description: string | null;
  ai_suggested_price: number | null;
  user_edited_title: string;
  user_edited_description: string;
  final_price: number;
  original_price: number | null;
  category_id: number | null;
  condition: ListingCondition;
  status: ListingStatus;
  location: { lat: number; lng: number };
  is_ai_generated: boolean;
  ai_confidence_score: number | null;
  verification_images: VerificationImage[];
  primary_image_url: string;
  additional_images: string[];
  view_count: number;
  favorite_count: number;
  offer_count: number;
  fraud_risk_score: number;
  moderation_status: ModerationStatus;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

// ─── Offer ───────────────────────────────────────────────
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface Offer {
  id: string;
  listing_id: string;
  buyer_id: string;
  offered_price: number;
  message: string | null;
  status: OfferStatus;
  is_exchange_proposal: boolean;
  exchange_listing_id: string | null;
  created_at: Date;
  expires_at: Date;
}

// ─── Transaction ─────────────────────────────────────────
export type PaymentMethod = 'fawry' | 'instapay' | 'vodafone_cash' | 'wallet' | 'cash';
export type PaymentStatus = 'pending' | 'held' | 'released' | 'refunded' | 'disputed';
export type DisputeStatus = 'none' | 'opened' | 'under_review' | 'resolved_buyer' | 'resolved_seller';

export interface Transaction {
  id: string;
  offer_id: string | null;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  agreed_price: number;
  platform_fee: number;
  seller_receives: number;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  escrow_hold_until: Date | null;
  buyer_confirmation: boolean;
  seller_confirmation: boolean;
  dispute_status: DisputeStatus;
  completed_at: Date | null;
  created_at: Date;
}

// ─── Review ──────────────────────────────────────────────
export interface Review {
  id: string;
  transaction_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  review_text: string | null;
  category: 'buyer' | 'seller';
  is_verified_purchase: boolean;
  created_at: Date;
}

// ─── Chat / Message ──────────────────────────────────────
export type MessageType = 'text' | 'image' | 'voice' | 'location' | 'offer' | 'system';

export interface Chat {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  offer_id: string | null;
  last_message_at: Date | null;
  is_blocked: boolean;
  created_at: Date;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  message_type: MessageType;
  content: string | null;
  media_url: string | null;
  is_read: boolean;
  created_at: Date;
}
