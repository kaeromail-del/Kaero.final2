import api from './api';

export interface WalletSummary {
  balance: number;
  pending: number;
  total_earned: number;
  total_withdrawn: number;
  recent_transactions: WalletTx[];
}

export interface WalletTx {
  id: string;
  type: 'credit' | 'debit' | 'fee' | 'withdrawal' | 'referral_bonus' | 'promo_credit';
  amount: number;
  description: string;
  reference_type: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  method: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  created_at: string;
  processed_at: string | null;
  admin_notes: string | null;
}

export const walletService = {
  async getSummary(): Promise<WalletSummary> {
    const { data } = await api.get('/wallet/me');
    return data;
  },
  async getTransactions(offset = 0): Promise<WalletTx[]> {
    const { data } = await api.get('/wallet/transactions', { params: { offset, limit: 30 } });
    return data.transactions;
  },
  async requestWithdrawal(payload: {
    amount: number;
    method: 'bank_transfer' | 'vodafone_cash' | 'instapay' | 'fawry';
    account_details: Record<string, string>;
  }) {
    const { data } = await api.post('/wallet/withdraw', payload);
    return data;
  },
  async getWithdrawals(): Promise<WithdrawalRequest[]> {
    const { data } = await api.get('/wallet/withdrawals');
    return data.withdrawals;
  },
  async initiatePaymobPayment(transactionId: string) {
    const { data } = await api.post('/wallet/paymob/initiate', { transaction_id: transactionId });
    return data as { paymentKey: string; orderId: string; iframeUrl: string };
  },
};
