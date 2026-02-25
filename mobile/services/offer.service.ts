import api from './api';

export const offerService = {
  async create(offer: { listing_id: string; offered_price: number; message?: string; is_exchange_proposal?: boolean }) {
    const { data } = await api.post('/offers', offer);
    return data.offer;
  },
  async getMyOffers() {
    const { data } = await api.get('/offers/my');
    return data.offers;
  },
  async getListingOffers(listingId: string) {
    const { data } = await api.get(`/offers/listing/${listingId}`);
    return data.offers;
  },
  async accept(offerId: string) {
    const { data } = await api.patch(`/offers/${offerId}/accept`);
    return data;
  },
  async reject(offerId: string) {
    const { data } = await api.patch(`/offers/${offerId}/reject`);
    return data;
  },
  async counter(offerId: string, counterPrice: number) {
    const { data } = await api.patch(`/offers/${offerId}/counter`, { counter_price: counterPrice });
    return data;
  },
  async cancel(offerId: string) {
    const { data } = await api.patch(`/offers/${offerId}/cancel`);
    return data;
  },
  async acceptCounter(offerId: string) {
    const { data } = await api.patch(`/offers/${offerId}/accept-counter`);
    return data;
  },
};
