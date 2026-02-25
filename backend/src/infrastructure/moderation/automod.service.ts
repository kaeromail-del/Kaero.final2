/**
 * Auto-Moderation Service
 * Runs keyword-based content screening on listing titles and descriptions.
 * Results are logged to moderation_logs and used to set moderation_status.
 */

import { query } from '../database/pool';

// ─── Keyword Lists ────────────────────────────────────────

const PROHIBITED_KEYWORDS: string[] = [
  // Weapons
  'gun', 'pistol', 'rifle', 'shotgun', 'weapon', 'ammunition', 'ammo', 'bullet', 'firearm', 'silencer',
  'سلاح', 'مسدس', 'بندقية', 'طلقات', 'ذخيرة', 'رشاش',
  // Drugs
  'cocaine', 'heroin', 'drug', 'marijuana', 'cannabis', 'meth', 'weed', 'narcotics',
  'مخدر', 'كوكايين', 'هيروين', 'حشيش', 'مواد مخدرة',
  // Adult
  'porn', 'xxx', 'adult content', 'escort',
  // Stolen
  'stolen item', 'no serial', 'blacklisted imei',
];

const HIGH_RISK_KEYWORDS: string[] = [
  'fake', 'replica', 'counterfeit', 'copy watch', 'mirror copy', 'grade a copy', 'class a copy',
  'تقليد', 'مقلد', 'كوبي', 'نسخة', 'تقليد فاخر',
  'hack', 'cracked', 'pirated', 'keygen',
  'money transfer', 'western union', 'wire transfer outside',
];

// ─── Types ────────────────────────────────────────────────

export interface ModerationResult {
  status: 'approved' | 'flagged' | 'rejected';
  risk_score: number;
  triggered_keywords: string[];
  reason: string | null;
}

// ─── Main Function ────────────────────────────────────────

export async function moderateListing(
  listingId: string,
  title: string,
  description: string,
): Promise<ModerationResult> {
  const text = `${title} ${description}`.toLowerCase();

  const triggeredProhibited = PROHIBITED_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()));
  const triggeredHighRisk = HIGH_RISK_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()));
  const allTriggered = [...triggeredProhibited, ...triggeredHighRisk];

  let status: ModerationResult['status'];
  let riskScore: number;
  let reason: string | null = null;
  let action: string;

  if (triggeredProhibited.length > 0) {
    status = 'rejected';
    riskScore = 1.0;
    reason = `Prohibited content detected: ${triggeredProhibited.join(', ')}`;
    action = 'auto_rejected';
  } else if (triggeredHighRisk.length > 0) {
    status = 'flagged';
    riskScore = 0.7;
    reason = `High-risk keywords detected: ${triggeredHighRisk.join(', ')}`;
    action = 'auto_flagged';
  } else {
    status = 'approved';
    riskScore = 0.0;
    action = 'auto_approved';
  }

  // Log to moderation_logs (non-blocking — if it fails, listing still goes through)
  query(
    `INSERT INTO moderation_logs (listing_id, action, reason, triggered_keywords, risk_score)
     VALUES ($1, $2, $3, $4, $5)`,
    [listingId, action, reason, JSON.stringify(allTriggered), riskScore],
  ).catch(() => {});

  return { status, risk_score: riskScore, triggered_keywords: allTriggered, reason };
}
