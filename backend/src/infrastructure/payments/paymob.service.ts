/**
 * Paymob Payment Gateway — Egypt
 * Docs: https://developers.paymob.com
 *
 * Flow:
 *   1. authenticate()       → api_token
 *   2. createOrder()        → order_id
 *   3. createPaymentKey()   → payment_key (expires in ~1hr)
 *   4. Redirect buyer to iframe or card widget using payment_key
 *   5. Paymob POSTs webhook to /api/v1/payments/webhook on completion
 */

import { config } from '../../config';
import { query, queryOne } from '../database/pool';

const PAYMOB_API = 'https://accept.paymob.com/api';

// ─── Auth token (cached in memory, refresh on 401) ────────

let cachedToken: string | null = null;
let tokenFetchedAt = 0;

async function authenticate(): Promise<string> {
  // Tokens last ~1 hour — refresh 5 min before expiry
  if (cachedToken && Date.now() - tokenFetchedAt < 55 * 60 * 1000) {
    return cachedToken;
  }
  const res = await fetch(`${PAYMOB_API}/auth/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: config.paymob.apiKey }),
  });
  if (!res.ok) throw new Error(`Paymob auth failed: ${res.status}`);
  const data = await res.json() as { token: string };
  cachedToken = data.token;
  tokenFetchedAt = Date.now();
  return cachedToken;
}

// ─── Create Paymob order ──────────────────────────────────

async function createOrder(token: string, amountCents: number, currency = 'EGP'): Promise<string> {
  const res = await fetch(`${PAYMOB_API}/ecommerce/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: token,
      delivery_needed: false,
      amount_cents: amountCents,
      currency,
      items: [],
    }),
  });
  if (!res.ok) throw new Error(`Paymob create order failed: ${res.status}`);
  const data = await res.json() as { id: number };
  return String(data.id);
}

// ─── Create payment key ───────────────────────────────────

interface BillingData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

async function createPaymentKey(
  token: string,
  orderId: string,
  amountCents: number,
  billing: BillingData,
  integrationId: number,
): Promise<string> {
  const res = await fetch(`${PAYMOB_API}/acceptance/payment_keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: token,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: orderId,
      billing_data: {
        first_name: billing.firstName || 'N/A',
        last_name: billing.lastName || 'N/A',
        email: billing.email || 'notprovided@kaero.app',
        phone_number: billing.phone,
        apartment: 'N/A',
        floor: 'N/A',
        street: 'N/A',
        building: 'N/A',
        shipping_method: 'PKG',
        postal_code: 'N/A',
        city: 'Cairo',
        country: 'EG',
        state: 'Cairo',
      },
      currency: 'EGP',
      integration_id: integrationId,
    }),
  });
  if (!res.ok) throw new Error(`Paymob payment key failed: ${res.status}`);
  const data = await res.json() as { token: string };
  return data.token;
}

// ─── Public: initiate a payment ───────────────────────────

export interface PaymobPaymentResult {
  paymentKey: string;
  orderId: string;
  iframeUrl: string;
}

export async function initiatePaymobPayment(
  transactionId: string,
  amountEGP: number,
  buyer: { full_name: string; email?: string; phone: string },
): Promise<PaymobPaymentResult> {
  if (!config.paymob.enabled) {
    // Dev fallback: return a mock result
    return {
      paymentKey: 'mock_payment_key_dev',
      orderId: 'mock_order_' + Date.now(),
      iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${config.paymob.iframeId}?payment_token=mock`,
    };
  }

  const amountCents = Math.round(amountEGP * 100);
  const nameParts = (buyer.full_name || 'Kaero User').split(' ');

  const token = await authenticate();
  const orderId = await createOrder(token, amountCents);
  const paymentKey = await createPaymentKey(token, orderId, amountCents, {
    firstName: nameParts[0] ?? 'Kaero',
    lastName: nameParts.slice(1).join(' ') || 'User',
    email: buyer.email ?? 'notprovided@kaero.app',
    phone: buyer.phone,
  }, config.paymob.integrationId);

  const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${config.paymob.iframeId}?payment_token=${paymentKey}`;

  // Persist intent
  await query(
    `INSERT INTO payment_intents (transaction_id, provider, provider_order_id, provider_payment_key, amount_cents)
     VALUES ($1, 'paymob', $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [transactionId, orderId, paymentKey, amountCents],
  );

  return { paymentKey, orderId, iframeUrl };
}

// ─── Webhook HMAC verification ────────────────────────────

import { createHmac } from 'crypto';

/**
 * Paymob sends a webhook with HMAC-SHA512 signature.
 * Concatenate specific fields in order and verify.
 */
export function verifyPaymobWebhook(body: Record<string, any>, receivedHmac: string): boolean {
  if (!config.paymob.hmacSecret) return true; // skip in dev
  const fields = [
    'amount_cents', 'created_at', 'currency', 'error_occured',
    'has_parent_transaction', 'id', 'integration_id', 'is_3d_secure',
    'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
    'is_voided', 'order', 'owner', 'pending', 'source_data.pan',
    'source_data.sub_type', 'source_data.type', 'success',
  ];
  const obj = body as Record<string, any>;
  const str = fields.map(f => {
    const keys = f.split('.');
    let val: any = obj;
    for (const k of keys) val = val?.[k];
    return String(val ?? '');
  }).join('');
  const expected = createHmac('sha512', config.paymob.hmacSecret).update(str).digest('hex');
  return expected === receivedHmac;
}
