import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, users } from '../db';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';

// JWT secret - in production, this should always be set via environment variable
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const jwtSecret = JWT_SECRET || 'development-only-secret-do-not-use-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'attendant' | 'client' | 'admin';
    name: string;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        name: users.name
      })
      .from(users)
      .where(eq(users.id, decoded.userId));
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication failed', { module: 'Auth' });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles: ('attendant' | 'client' | 'admin')[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

export function generateToken(userId: string): string {
  return jwt.sign(
    { userId },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}
