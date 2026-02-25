import api from './api';

export const transactionService = {
  async getMyTransactions(role?: 'buyer' | 'seller' | 'all') {
    const { data } = await api.get('/transactions', { params: role ? { role } : {} });
    return data.transactions;
  },
  async getById(id: string) {
    const { data } = await api.get(`/transactions/${id}`);
    return data.transaction;
  },
  async initiatePayment(transactionId: string, paymentMethod: string) {
    const { data } = await api.patch(`/transactions/${transactionId}/payment`, { payment_method: paymentMethod });
    return data.transaction;
  },
  async confirmReceipt(transactionId: string) {
    const { data } = await api.patch(`/transactions/${transactionId}/confirm`);
    return data.transaction;
  },
  async openDispute(transactionId: string) {
    const { data } = await api.post(`/transactions/${transactionId}/dispute`);
    return data.transaction;
  },
  async openDisputeWithReason(transactionId: string, reason: string, details: string, evidenceUrls: string[]) {
    const { data } = await api.post(`/transactions/${transactionId}/dispute`, {
      reason,
      details,
      evidence_urls: evidenceUrls,
    });
    return data.transaction;
  },
  async resolveDispute(transactionId: string, resolution: 'resolved_buyer' | 'resolved_seller') {
    const { data } = await api.patch(`/transactions/${transactionId}/dispute/resolve`, { resolution });
    return data.transaction;
  },
  async leaveReview(transactionId: string, rating: number, reviewText?: string) {
    const { data } = await api.post(`/transactions/${transactionId}/review`, { rating, review_text: reviewText });
    return data.review;
  },
};
