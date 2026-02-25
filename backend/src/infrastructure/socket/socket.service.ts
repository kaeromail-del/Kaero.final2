import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { query, queryOne } from '../database/pool';

let io: Server;

interface AuthSocket extends Socket {
  userId?: string;
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: config.cors.origin, methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  // ── JWT auth middleware ─────────────────────────────────
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Missing auth token'));
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId!;

    // ── Join a chat room ────────────────────────────────
    socket.on('join_chat', async (chatId: string) => {
      try {
        const chat = await queryOne<any>('SELECT * FROM chats WHERE id = $1', [chatId]);
        if (!chat) return socket.emit('error', { message: 'Chat not found' });
        if (chat.buyer_id !== userId && chat.seller_id !== userId) {
          return socket.emit('error', { message: 'Forbidden' });
        }
        socket.join(`chat_${chatId}`);
        socket.emit('joined', { chatId });
      } catch { socket.emit('error', { message: 'Failed to join chat' }); }
    });

    socket.on('leave_chat', (chatId: string) => {
      socket.leave(`chat_${chatId}`);
    });

    // ── Send a message ──────────────────────────────────
    socket.on('send_message', async (data: { chatId: string; content: string; message_type?: string }) => {
      try {
        const { chatId, content, message_type = 'text' } = data;
        if (!content?.trim()) return;

        const chat = await queryOne<any>('SELECT * FROM chats WHERE id = $1', [chatId]);
        if (!chat) return socket.emit('error', { message: 'Chat not found' });
        if (chat.buyer_id !== userId && chat.seller_id !== userId) return socket.emit('error', { message: 'Forbidden' });
        if (chat.is_blocked) return socket.emit('error', { message: 'Chat is blocked' });

        const sender = await queryOne<any>('SELECT full_name, avatar_url FROM users WHERE id = $1', [userId]);

        const message = await queryOne<any>(
          `INSERT INTO messages (chat_id, sender_id, message_type, content)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [chatId, userId, message_type, content.trim()]
        );
        await query('UPDATE chats SET last_message_at = NOW() WHERE id = $1', [chatId]);

        const fullMessage = {
          ...message,
          sender_name: sender?.full_name,
          sender_avatar: sender?.avatar_url,
        };

        // Broadcast to everyone in the room (including sender for confirmation)
        io.to(`chat_${chatId}`).emit('new_message', fullMessage);
      } catch { socket.emit('error', { message: 'Failed to send message' }); }
    });

    // ── Typing indicator ────────────────────────────────
    socket.on('typing', (data: { chatId: string; isTyping: boolean }) => {
      socket.to(`chat_${data.chatId}`).emit('user_typing', { userId, isTyping: data.isTyping });
    });

    socket.on('disconnect', () => {
      // Socket.io auto-cleans rooms on disconnect
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
