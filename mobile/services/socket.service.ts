import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;

  async connect(): Promise<Socket> {
    if (this.socket?.connected) return this.socket;

    const token = await SecureStore.getItemAsync('access_token');

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  async joinChat(chatId: string) {
    const socket = await this.connect();
    socket.emit('join_chat', chatId);
  }

  leaveChat(chatId: string) {
    this.socket?.emit('leave_chat', chatId);
  }

  sendMessage(chatId: string, content: string) {
    this.socket?.emit('send_message', { chatId, content });
  }

  sendTyping(chatId: string, isTyping: boolean) {
    this.socket?.emit('typing', { chatId, isTyping });
  }

  onNewMessage(handler: (msg: any) => void) {
    this.socket?.on('new_message', handler);
  }

  onTyping(handler: (data: { userId: string; isTyping: boolean }) => void) {
    this.socket?.on('user_typing', handler);
  }

  offNewMessage(handler?: (msg: any) => void) {
    if (handler) this.socket?.off('new_message', handler);
    else this.socket?.removeAllListeners('new_message');
  }

  offTyping() {
    this.socket?.removeAllListeners('user_typing');
  }
}

export const socketService = new SocketService();
