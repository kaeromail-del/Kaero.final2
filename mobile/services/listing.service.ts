import api from './api';

export interface ListingFilters {
  lat?: number; lng?: number; radius?: number; category_id?: number;
  min_price?: number; max_price?: number; condition?: string;
  sort?: 'distance' | 'newest' | 'price'; cursor?: string; limit?: number;
}

export const listingService = {
  async getNearby(filters: ListingFilters = {}) {
    const { data } = await api.get('/listings/nearby', { params: filters });
    return data;
  },
  async search(query: string, filters: ListingFilters = {}) {
    const { data } = await api.get('/listings/search', { params: { q: query, ...filters } });
    return data;
  },
  async getById(id: string) {
    const { data } = await api.get(`/listings/${id}`);
    return data.listing;
  },
  async getByUser(userId: string) {
    const { data } = await api.get(`/listings/user/${userId}`);
    return data.listings;
  },
  async create(listing: any) {
    const { data } = await api.post('/listings', listing);
    return data.listing;
  },
  async update(id: string, updates: any) {
    const { data } = await api.patch(`/listings/${id}`, updates);
    return data.listing;
  },
  async delete(id: string) {
    await api.delete(`/listings/${id}`);
  },
  async toggleFavorite(id: string): Promise<{ favorited: boolean }> {
    const { data } = await api.post(`/listings/${id}/favorite`);
    return data;
  },
  async getMyFavorites() {
    const { data } = await api.get('/listings/favorites/mine');
    return data.listings;
  },
  async getSimilar(id: string) {
    const { data } = await api.get(`/listings/${id}/similar`);
    return data.listings;
  },
  async report(id: string, reason: string, details?: string) {
    await api.post(`/listings/${id}/report`, { reason, details });
  },
};
