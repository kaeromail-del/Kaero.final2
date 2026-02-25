/**
 * Kaero Backend API Client
 * Connects the web app to the Kaero backend (auth, listings, offers, chats, transactions, etc.)
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const STORAGE_ACCESS = 'kaero_access_token';
const STORAGE_REFRESH = 'kaero_refresh_token';
const STORAGE_USER = 'kaero_user';

export function getStoredTokens() {
  return {
    accessToken: localStorage.getItem(STORAGE_ACCESS),
    refreshToken: localStorage.getItem(STORAGE_REFRESH),
  };
}

export function setStoredTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem(STORAGE_ACCESS, accessToken);
  if (refreshToken) localStorage.setItem(STORAGE_REFRESH, refreshToken);
}

export function setStoredUser(user) {
  if (user) localStorage.setItem(STORAGE_USER, JSON.stringify(user));
}

export function getStoredUser() {
  const u = localStorage.getItem(STORAGE_USER);
  return u ? JSON.parse(u) : null;
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_ACCESS);
  localStorage.removeItem(STORAGE_REFRESH);
  localStorage.removeItem(STORAGE_USER);
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const tok = localStorage.getItem(STORAGE_ACCESS);
  if (tok) config.headers.Authorization = `Bearer ${tok}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      const refresh = localStorage.getItem(STORAGE_REFRESH);
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: refresh });
          setStoredTokens(data.accessToken, data.refreshToken);
          orig.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(orig);
        } catch {
          clearAuth();
        }
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  requestOTP: (phone) => api.post('/auth/otp/request', { phone }),
  verifyOTP: (phone, code) => api.post('/auth/otp/verify', { phone, code }),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
};

// Users
export const userApi = {
  me: () => api.get('/users/me'),
  updateMe: (data) => api.patch('/users/me', data),
  updateLocation: (lat, lng) => api.put('/users/me/location', { lat, lng }),
  get: (id) => api.get(`/users/${id}`),
};

// Categories
export const categoryApi = {
  list: () => api.get('/categories'),
  children: (id) => api.get(`/categories/${id}/children`),
};

// Listings
export const listingApi = {
  nearby: (params) => api.get('/listings/nearby', { params }),
  search: (params) => api.get('/listings/search', { params }),
  get: (id) => api.get(`/listings/${id}`),
  create: (data) => api.post('/listings', data),
  update: (id, data) => api.patch(`/listings/${id}`, data),
  delete: (id) => api.delete(`/listings/${id}`),
  byUser: (userId) => api.get(`/listings/user/${userId}`),
};

// Offers
export const offerApi = {
  create: (data) => api.post('/offers', data),
  byListing: (listingId) => api.get(`/offers/listing/${listingId}`),
  my: () => api.get('/offers/my'),
  accept: (id) => api.patch(`/offers/${id}/accept`),
  reject: (id) => api.patch(`/offers/${id}/reject`),
};

// Chats
export const chatApi = {
  list: () => api.get('/chats'),
  messages: (id, params) => api.get(`/chats/${id}/messages`, { params }),
  create: (listingId) => api.post('/chats', { listing_id: listingId }),
  sendMessage: (chatId, body) => api.post(`/chats/${chatId}/messages`, body),
};

// Transactions
export const transactionApi = {
  list: (params) => api.get('/transactions', { params }),
  get: (id) => api.get(`/transactions/${id}`),
  payment: (id, paymentMethod) => api.patch(`/transactions/${id}/payment`, { payment_method: paymentMethod }),
  confirm: (id) => api.patch(`/transactions/${id}/confirm`),
  dispute: (id) => api.post(`/transactions/${id}/dispute`),
  review: (id, rating, reviewText) => api.post(`/transactions/${id}/review`, { rating, review_text: reviewText }),
};

// AI
export const aiApi = {
  analyzeImage: (imageBase64, categoryHint) =>
    api.post('/ai/analyze-image', { image_base64: imageBase64, category_hint: categoryHint }),
  priceSuggest: (data) => api.post('/ai/price-suggest', data),
};

// Health
export const healthCheck = () => axios.get(API_BASE.replace('/api/v1', '') + '/health');

export default api;
