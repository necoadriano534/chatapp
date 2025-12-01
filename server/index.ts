import express from 'express';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { requestLogger, errorHandler } from './middleware/requestLogger';
import { apiLimiter, authLimiter, messageLimiter, webauthnLimiter } from './middleware/rateLimiter';
import { initializeSocket } from './socket';
import logger from './utils/logger';

// Routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import conversationsRoutes from './routes/conversations';
import messagesRoutes from './routes/messages';
import channelsRoutes from './routes/channels';
import webhooksRoutes from './routes/webhooks';
import webauthnRoutes from './routes/webauthn';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
initializeSocket(httpServer);

// Middleware
app.use(express.json());
// Note: cookie-parser is included for potential future use, but authentication uses
// JWT Bearer tokens in the Authorization header, which provides inherent CSRF protection.
// No CSRF middleware is needed because tokens are not stored/sent in cookies.
app.use(cookieParser());
app.use(requestLogger);

// Apply rate limiting
// Note: In production with multiple instances, use a Redis store for rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', apiLimiter, usersRoutes);
app.use('/api/conversations', apiLimiter, conversationsRoutes);
app.use('/api/messages', messageLimiter, messagesRoutes);
app.use('/api/channels', apiLimiter, channelsRoutes);
app.use('/api/webhooks', apiLimiter, webhooksRoutes);
app.use('/api/webauthn', webauthnLimiter, webauthnRoutes);

// Health check (no rate limiting)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  logger.success(`Server running on port ${PORT}`, { module: 'Server' });
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`, { module: 'Server' });
});

export default app;
