import { Router } from 'express';
import { db, webhooks } from '../db';
import { eq } from 'drizzle-orm';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { triggerWebhook, getAvailableEvents } from '../services/webhookService';
import logger from '../utils/logger';

const router = Router();

// Get available webhook events
router.get('/events', authenticate, (_req, res) => {
  res.json(getAvailableEvents());
});

// Get all webhooks
router.get('/', authenticate, requireRole('admin'), async (_req, res) => {
  try {
    const result = await db.select().from(webhooks);
    res.json(result);
  } catch (error) {
    logger.error(`Failed to get webhooks: ${error}`, { module: 'Webhooks' });
    res.status(500).json({ error: 'Failed to get webhooks' });
  }
});

// Get webhook by ID
router.get('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, req.params.id));

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json(webhook);
  } catch (error) {
    logger.error(`Failed to get webhook: ${error}`, { module: 'Webhooks' });
    res.status(500).json({ error: 'Failed to get webhook' });
  }
});

// Create webhook
router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { name, url, events, authType, authConfig = {}, active = true } = req.body;

    if (!name || !url || !events || !authType) {
      return res.status(400).json({ error: 'Name, URL, events and authType are required' });
    }

    const validAuthTypes = ['Basic', 'Bearer', 'ApiKey', 'Hawk'];
    if (!validAuthTypes.includes(authType)) {
      return res.status(400).json({ error: `Invalid authType. Must be one of: ${validAuthTypes.join(', ')}` });
    }

    // Validate events
    const availableEvents = getAvailableEvents();
    const invalidEvents = events.filter((e: string) => !availableEvents.includes(e));
    if (invalidEvents.length > 0) {
      return res.status(400).json({ 
        error: `Invalid events: ${invalidEvents.join(', ')}`,
        availableEvents 
      });
    }

    const [webhook] = await db
      .insert(webhooks)
      .values({
        name,
        url,
        events,
        authType: authType as 'Basic' | 'Bearer' | 'ApiKey' | 'Hawk',
        authConfig,
        active
      })
      .returning();

    await triggerWebhook('webhook.created', { webhookId: webhook.id, name: webhook.name });

    logger.success(`Webhook created: ${name}`, { module: 'Webhooks' });

    res.status(201).json(webhook);
  } catch (error) {
    logger.error(`Failed to create webhook: ${error}`, { module: 'Webhooks' });
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// Update webhook
router.put('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, url, events, authType, authConfig, active } = req.body;

    const updateData: Record<string, unknown> = {};

    if (name) updateData.name = name;
    if (url) updateData.url = url;
    if (events) {
      const availableEvents = getAvailableEvents();
      const invalidEvents = events.filter((e: string) => !availableEvents.includes(e));
      if (invalidEvents.length > 0) {
        return res.status(400).json({ 
          error: `Invalid events: ${invalidEvents.join(', ')}`,
          availableEvents 
        });
      }
      updateData.events = events;
    }
    if (authType) {
      const validAuthTypes = ['Basic', 'Bearer', 'ApiKey', 'Hawk'];
      if (!validAuthTypes.includes(authType)) {
        return res.status(400).json({ error: `Invalid authType. Must be one of: ${validAuthTypes.join(', ')}` });
      }
      updateData.authType = authType;
    }
    if (authConfig) updateData.authConfig = authConfig;
    if (typeof active === 'boolean') updateData.active = active;

    const [webhook] = await db
      .update(webhooks)
      .set(updateData)
      .where(eq(webhooks.id, id))
      .returning();

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await triggerWebhook('webhook.updated', { webhookId: webhook.id, name: webhook.name });

    logger.success(`Webhook updated: ${webhook.name}`, { module: 'Webhooks' });

    res.json(webhook);
  } catch (error) {
    logger.error(`Failed to update webhook: ${error}`, { module: 'Webhooks' });
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// Delete webhook
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const [webhook] = await db
      .delete(webhooks)
      .where(eq(webhooks.id, id))
      .returning({ id: webhooks.id, name: webhooks.name });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await triggerWebhook('webhook.deleted', { webhookId: webhook.id });

    logger.success(`Webhook deleted: ${webhook.name}`, { module: 'Webhooks' });

    res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    logger.error(`Failed to delete webhook: ${error}`, { module: 'Webhooks' });
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// Test webhook
router.post('/:id/test', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id));

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Send test webhook
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook' }
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const config = webhook.authConfig || {};

    switch (webhook.authType) {
      case 'Basic':
        const username = config.username as string || '';
        const password = config.password as string || '';
        headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        break;
      case 'Bearer':
        headers['Authorization'] = `Bearer ${config.token as string || ''}`;
        break;
      case 'ApiKey':
        const headerName = config.headerName as string || 'X-API-Key';
        headers[headerName] = config.apiKey as string || '';
        break;
      case 'Hawk':
        headers['Authorization'] = `Hawk id="${config.id}", ts="${Date.now()}", nonce="${Math.random().toString(36)}"`;
        break;
    }

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload)
      });

      res.json({
        success: response.ok,
        status: response.status,
        statusText: response.statusText
      });
    } catch (fetchError) {
      res.json({
        success: false,
        error: fetchError instanceof Error ? fetchError.message : 'Failed to reach webhook URL'
      });
    }
  } catch (error) {
    logger.error(`Failed to test webhook: ${error}`, { module: 'Webhooks' });
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

export default router;
