import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, users } from '../db';
import { eq } from 'drizzle-orm';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth';
import { triggerWebhook } from '../services/webhookService';
import logger from '../utils/logger';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'client' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    // Check if user exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        role: role as 'attendant' | 'client' | 'admin'
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role
      });

    const token = generateToken(user.id);

    await triggerWebhook('auth.register', { userId: user.id, email: user.email });

    logger.success(`User registered: ${email}`, { module: 'Auth' });

    res.status(201).json({
      user,
      token
    });
  } catch (error) {
    logger.error(`Registration failed: ${error}`, { module: 'Auth' });
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    await triggerWebhook('auth.login', { userId: user.id, email: user.email });

    logger.success(`User logged in: ${email}`, { module: 'Auth' });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    logger.error(`Login failed: ${error}`, { module: 'Auth' });
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        preferredChannel: users.preferredChannel,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.id, req.user!.id));

    res.json(user);
  } catch (error) {
    logger.error(`Failed to get user: ${error}`, { module: 'Auth' });
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update password
router.put('/password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id));

    const validPassword = await bcrypt.compare(currentPassword, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id));

    logger.success(`Password updated for user: ${user.email}`, { module: 'Auth' });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error(`Password update failed: ${error}`, { module: 'Auth' });
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Logout (client-side will remove token, but we can trigger webhook)
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  await triggerWebhook('auth.logout', { userId: req.user!.id });
  logger.info(`User logged out: ${req.user!.email}`, { module: 'Auth' });
  res.json({ message: 'Logged out successfully' });
});

export default router;
