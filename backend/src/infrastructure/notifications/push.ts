import { query, queryOne } from '../database/pool';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// ── Send Expo push notification to a single user ──────────
export async function notifyUser(userId: string, type: string, payload: PushPayload) {
  // 1. Persist in-app notification
  await queryOne(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, payload.title, payload.body, JSON.stringify(payload.data ?? {})]
  );

  // 2. Send Expo push if token registered
  const user = await queryOne<any>(`SELECT fcm_token FROM users WHERE id = $1`, [userId]);
  const token = user?.fcm_token;
  if (!token || !token.startsWith('ExponentPushToken')) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default',
        badge: 1,
      }),
    });
  } catch {
    // Non-fatal: push failed but in-app notification persisted
  }
}

// ── Convenience helpers ───────────────────────────────────

export async function notifyNewOffer(sellerId: string, buyerName: string, listingTitle: string, listingId: string, offerId: string) {
  await notifyUser(sellerId, 'new_offer', {
    title: `New offer from ${buyerName}`,
    body: `On: ${listingTitle}`,
    data: { screen: 'listing', listingId, offerId },
  });
}

export async function notifyOfferAccepted(buyerId: string, listingTitle: string, listingId: string, transactionId: string) {
  await notifyUser(buyerId, 'offer_accepted', {
    title: 'Offer accepted!',
    body: `Your offer on "${listingTitle}" was accepted. Proceed to payment.`,
    data: { screen: 'payment', transactionId, listingId },
  });
}

export async function notifyOfferRejected(buyerId: string, listingTitle: string) {
  await notifyUser(buyerId, 'offer_rejected', {
    title: 'Offer declined',
    body: `Your offer on "${listingTitle}" was not accepted.`,
    data: { screen: 'home' },
  });
}

export async function notifyNewMessage(recipientId: string, senderName: string, chatId: string) {
  await notifyUser(recipientId, 'new_message', {
    title: `Message from ${senderName}`,
    body: 'Tap to read',
    data: { screen: 'chat', chatId },
  });
}

export async function notifyPaymentReceived(sellerId: string, amount: number, listingTitle: string, transactionId: string) {
  await notifyUser(sellerId, 'payment_received', {
    title: `Payment received — EGP ${amount}`,
    body: `For: ${listingTitle}`,
    data: { screen: 'payment', transactionId },
  });
}

export async function notifyReviewReceived(userId: string, reviewerName: string, rating: number) {
  await notifyUser(userId, 'review_received', {
    title: `${reviewerName} left you a ${rating}★ review`,
    body: 'View your profile to see the review.',
    data: { screen: 'profile' },
  });
}

export async function notifyOfferCountered(buyerId: string, listingTitle: string, counterPrice: number, listingId: string, offerId: string) {
  await notifyUser(buyerId, 'offer_countered', {
    title: 'Seller made a counter offer',
    body: `Counter offer of ${counterPrice.toLocaleString()} EGP on "${listingTitle}"`,
    data: { screen: 'offers', listingId, offerId },
  });
}
