import api from './api';
import * as SecureStore from 'expo-secure-store';

export const authService = {
  async requestOtp(phone: string) {
    const { data } = await api.post('/auth/otp/request', { phone });
    return data;
  },
  async verifyOtp(phone: string, otp: string) {
    const { data } = await api.post('/auth/otp/verify', { phone, otp });
    if (data.access_token) {
      await SecureStore.setItemAsync('access_token', data.access_token);
      await SecureStore.setItemAsync('refresh_token', data.refresh_token);
    }
    return data;
  },
  async logout() {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
  },
};
