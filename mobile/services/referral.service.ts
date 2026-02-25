import api from './api';

export const referralService = {
  async getMyReferral() {
    const { data } = await api.get('/referral/me');
    return data as {
      referral_code: string;
      referral_credits: number;
      total_referred: number;
      friends: { full_name: string; created_at: string; has_transacted: boolean }[];
    };
  },
  async applyCode(code: string) {
    const { data } = await api.post('/referral/apply', { code });
    return data as { message: string; credits_earned: number };
  },
  async validatePromo(code: string, orderAmount: number) {
    const { data } = await api.post('/promo/validate', { code, order_amount: orderAmount });
    return data as {
      valid: boolean;
      code: string;
      discount_type: string;
      discount_value: number;
      discount_amount: number;
      final_amount: number;
      promo_id: string;
    };
  },
  async boostListing(listingId: string, tier: 'basic' | 'standard' | 'premium') {
    const { data } = await api.post(`/listings/${listingId}/boost`, { tier });
    return data as { message: string; boosted_until: string; tier: string; price_egp: number };
  },
};
