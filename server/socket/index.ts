import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: 'attendant' | 'client' | 'admin';
    name: string;
  };
}

let io: Server;

export function initializeSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email?: string;
        role?: 'attendant' | 'client' | 'admin';
        name?: string;
      };
      
      socket.user = {
        id: decoded.userId,
        email: decoded.email || '',
        role: decoded.role || 'client',
        name: decoded.name || ''
      };
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    
    if (!user) {
      socket.disconnect();
      return;
    }

    logger.info(`User connected: ${user.email}`, { module: 'Socket' });

    // Join user's personal room
    socket.join(`user:${user.id}`);

    // Join role-based room
    socket.join(`role:${user.role}`);

    // Handle joining conversation room
    socket.on('join:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logger.debug(`User ${user.email} joined conversation ${conversationId}`, { module: 'Socket' });
    });

    // Handle leaving conversation room
    socket.on('leave:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.debug(`User ${user.email} left conversation ${conversationId}`, { module: 'Socket' });
    });

    // Handle sending message
    socket.on('message:send', (data: { conversationId: string; content: string }) => {
      const { conversationId, content } = data;
      
      // Emit to conversation room
      socket.to(`conversation:${conversationId}`).emit('message:new', {
        conversationId,
        content,
        sender: {
          id: user.id,
          name: user.name
        },
        createdAt: new Date().toISOString()
      });

      logger.debug(`Message sent in conversation ${conversationId}`, { module: 'Socket' });
    });

    // Handle typing indicator
    socket.on('typing:start', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:user', {
        conversationId,
        user: {
          id: user.id,
          name: user.name
        }
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId: user.id
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${user.email}`, { module: 'Socket' });
    });
  });

  logger.success('Socket.io server initialized', { module: 'Socket' });

  return io;
}

// Emit events from other parts of the application
export function emitToUser(userId: string, event: string, data: unknown) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToConversation(conversationId: string, event: string, data: unknown) {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
}

export function emitToRole(role: 'attendant' | 'client' | 'admin', event: string, data: unknown) {
  if (io) {
    io.to(`role:${role}`).emit(event, data);
  }
}

export function emitToAll(event: string, data: unknown) {
  if (io) {
    io.emit(event, data);
  }
}

export function getIO(): Server {
  return io;
}
