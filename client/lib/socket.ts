import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function initializeSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Event emitters
export function joinConversation(conversationId: string) {
  if (socket) {
    socket.emit('join:conversation', conversationId);
  }
}

export function leaveConversation(conversationId: string) {
  if (socket) {
    socket.emit('leave:conversation', conversationId);
  }
}

export function sendMessage(conversationId: string, content: string) {
  if (socket) {
    socket.emit('message:send', { conversationId, content });
  }
}

export function startTyping(conversationId: string) {
  if (socket) {
    socket.emit('typing:start', conversationId);
  }
}

export function stopTyping(conversationId: string) {
  if (socket) {
    socket.emit('typing:stop', conversationId);
  }
}
