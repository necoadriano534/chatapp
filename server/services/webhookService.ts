import { db, webhooks } from '../db';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';

// Available webhook events based on API routes
export const webhookEvents = [
  'auth.login',
  'auth.register',
  'auth.logout',
  'user.created',
  'user.updated',
  'user.deleted',
  'conversation.created',
  'conversation.assigned',
  'conversation.closed',
  'conversation.updated',
  'message.created',
  'message.received',
  'channel.created',
  'channel.updated',
  'channel.deleted',
  'webhook.created',
  'webhook.updated',
  'webhook.deleted'
] as const;

export type WebhookEvent = typeof webhookEvents[number];

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: unknown;
}

async function getAuthHeaders(webhook: {
  authType: 'Basic' | 'Bearer' | 'ApiKey' | 'Hawk';
  authConfig: Record<string, unknown> | null;
}): Promise<Record<string, string>> {
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
      // Hawk auth would require more complex implementation
      // For now, add basic Hawk headers
      headers['Authorization'] = `Hawk id="${config.id}", ts="${Date.now()}", nonce="${Math.random().toString(36)}"`;
      break;
  }

  return headers;
}

export async function triggerWebhook(event: WebhookEvent, data: unknown): Promise<void> {
  try {
    const activeWebhooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.active, true));

    const matchingWebhooks = activeWebhooks.filter(w => 
      w.events.includes(event)
    );

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data
    };

    for (const webhook of matchingWebhooks) {
      try {
        const headers = await getAuthHeaders(webhook);
        
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          logger.warn(`Webhook ${webhook.name} failed with status ${response.status}`, {
            module: 'Webhook'
          });
        } else {
          logger.success(`Webhook ${webhook.name} triggered successfully`, {
            module: 'Webhook'
          });
        }
      } catch (error) {
        logger.error(`Failed to trigger webhook ${webhook.name}: ${error}`, {
          module: 'Webhook'
        });
      }
    }
  } catch (error) {
    logger.error(`Error triggering webhooks: ${error}`, { module: 'Webhook' });
  }
}

export function getAvailableEvents(): string[] {
  return [...webhookEvents];
}
