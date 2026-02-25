import api from './api';

export const aiService = {
  async analyzeImage(imageBase64: string, categoryHint?: string) {
    const { data } = await api.post('/ai/analyze-image', {
      image_base64: imageBase64, category_hint: categoryHint,
    });
    return data;
  },

  async suggestPrice(title: string, condition: string, categoryId?: number) {
    const { data } = await api.post('/ai/price-suggest', {
      title, condition, category_id: categoryId,
    });
    return data;
  },

  async askKaero(message: string): Promise<{ reply: string; mock: boolean }> {
    const { data } = await api.post('/ai/ask', { message });
    return data;
  },

  async trackView(listingId: string) {
    try {
      await api.post(`/listings/${listingId}/view`);
    } catch {
      // Non-critical — silently fail
    }
  },
};
