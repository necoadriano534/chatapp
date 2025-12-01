import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const method = req.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    
    // Don't log static assets
    if (req.path.startsWith('/assets') || req.path.includes('.')) {
      return;
    }
    
    logger.http(
      method,
      req.path,
      res.statusCode,
      req.method !== 'GET' ? { body: req.body, duration: `${duration}ms` } : { duration: `${duration}ms` }
    );
  });
  
  next();
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  logger.error(err.message, { module: 'ErrorHandler', path: req.path });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}
