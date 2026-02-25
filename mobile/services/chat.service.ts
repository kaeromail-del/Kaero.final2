import api from './api';

export const chatService = {
  async getChats() {
    const { data } = await api.get('/chats');
    return data.chats;
  },
  async startChat(listingId: string) {
    const { data } = await api.post('/chats', { listing_id: listingId });
    return data.chat;
  },
  async getMessages(chatId: string, cursor?: string) {
    const { data } = await api.get(`/chats/${chatId}/messages`, { params: cursor ? { cursor } : {} });
    return data;
  },
  async sendMessage(chatId: string, content: string, messageType = 'text', mediaUrl?: string) {
    const { data } = await api.post(`/chats/${chatId}/messages`, {
      message_type: messageType, content, media_url: mediaUrl,
    });
    return data.message;
  },
};
