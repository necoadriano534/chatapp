import { Router } from 'express';
import { db, channels } from '../db';
import { eq } from 'drizzle-orm';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { triggerWebhook } from '../services/webhookService';
import logger from '../utils/logger';

const router = Router();

// Get all channels
router.get('/', authenticate, async (_req, res) => {
  try {
    const result = await db.select().from(channels);
    res.json(result);
  } catch (error) {
    logger.error(`Failed to get channels: ${error}`, { module: 'Channels' });
    res.status(500).json({ error: 'Failed to get channels' });
  }
});

// Get channel by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, req.params.id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json(channel);
  } catch (error) {
    logger.error(`Failed to get channel: ${error}`, { module: 'Channels' });
    res.status(500).json({ error: 'Failed to get channel' });
  }
});

// Create channel (admin only)
router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { name, type, config = {} } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const validTypes = ['whatsapp', 'telegram', 'email', 'webchat', 'sms'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const [channel] = await db
      .insert(channels)
      .values({
        name,
        type: type as 'whatsapp' | 'telegram' | 'email' | 'webchat' | 'sms',
        config
      })
      .returning();

    await triggerWebhook('channel.created', channel);

    logger.success(`Channel created: ${name}`, { module: 'Channels' });

    res.status(201).json(channel);
  } catch (error) {
    logger.error(`Failed to create channel: ${error}`, { module: 'Channels' });
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// Update channel (admin only)
router.put('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, type, config } = req.body;

    const updateData: Record<string, unknown> = {};
    
    if (name) updateData.name = name;
    if (type) {
      const validTypes = ['whatsapp', 'telegram', 'email', 'webchat', 'sms'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      }
      updateData.type = type;
    }
    if (config) updateData.config = config;

    const [channel] = await db
      .update(channels)
      .set(updateData)
      .where(eq(channels.id, id))
      .returning();

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    await triggerWebhook('channel.updated', channel);

    logger.success(`Channel updated: ${channel.name}`, { module: 'Channels' });

    res.json(channel);
  } catch (error) {
    logger.error(`Failed to update channel: ${error}`, { module: 'Channels' });
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// Delete channel (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const [channel] = await db
      .delete(channels)
      .where(eq(channels.id, id))
      .returning({ id: channels.id, name: channels.name });

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    await triggerWebhook('channel.deleted', { id: channel.id });

    logger.success(`Channel deleted: ${channel.name}`, { module: 'Channels' });

    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    logger.error(`Failed to delete channel: ${error}`, { module: 'Channels' });
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

export default router;
