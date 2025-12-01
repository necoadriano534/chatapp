import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, users } from '../db';
import { eq, and } from 'drizzle-orm';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { triggerWebhook } from '../services/webhookService';
import logger from '../utils/logger';

const router = Router();

// Get all users (with optional role filter)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { role } = req.query;
    
    let query = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        preferredChannel: users.preferredChannel,
        remoteJid: users.remoteJid,
        externalId: users.externalId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(users);

    if (role) {
      query = query.where(eq(users.role, role as 'attendant' | 'client' | 'admin')) as typeof query;
    }

    const result = await query;
    res.json(result);
  } catch (error) {
    logger.error(`Failed to get users: ${error}`, { module: 'Users' });
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        preferredChannel: users.preferredChannel,
        remoteJid: users.remoteJid,
        externalId: users.externalId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(users)
      .where(eq(users.id, req.params.id));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    logger.error(`Failed to get user: ${error}`, { module: 'Users' });
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Create user (admin only)
router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { name, email, password, role = 'client', preferredChannel, remoteJid, externalId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    // Check if email exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        role: role as 'attendant' | 'client' | 'admin',
        preferredChannel,
        remoteJid,
        externalId
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        preferredChannel: users.preferredChannel,
        remoteJid: users.remoteJid,
        externalId: users.externalId,
        createdAt: users.createdAt
      });

    await triggerWebhook('user.created', user);

    logger.success(`User created: ${email}`, { module: 'Users' });

    res.status(201).json(user);
  } catch (error) {
    logger.error(`Failed to create user: ${error}`, { module: 'Users' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, preferredChannel, remoteJid, externalId, password } = req.body;

    // Check permission - users can update themselves, admins can update anyone
    if (req.user!.id !== id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Non-admins can't change role
    if (role && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change user roles' });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (preferredChannel !== undefined) updateData.preferredChannel = preferredChannel;
    if (remoteJid !== undefined) updateData.remoteJid = remoteJid;
    if (externalId !== undefined) updateData.externalId = externalId;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        preferredChannel: users.preferredChannel,
        remoteJid: users.remoteJid,
        externalId: users.externalId,
        updatedAt: users.updatedAt
      });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await triggerWebhook('user.updated', user);

    logger.success(`User updated: ${user.email}`, { module: 'Users' });

    res.json(user);
  } catch (error) {
    logger.error(`Failed to update user: ${error}`, { module: 'Users' });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.user!.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const [user] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id, email: users.email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await triggerWebhook('user.deleted', { id: user.id });

    logger.success(`User deleted: ${user.email}`, { module: 'Users' });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error(`Failed to delete user: ${error}`, { module: 'Users' });
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
