import express from 'express';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { requestLogger, errorHandler } from './middleware/requestLogger';
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
app.use(cookieParser());
app.use(requestLogger);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/webauthn', webauthnRoutes);

// Health check
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
