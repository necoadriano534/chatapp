import { Router } from 'express';
import { db, messages, conversations, users } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';
import { triggerWebhook } from '../services/webhookService';
import logger from '../utils/logger';

const router = Router();

// Send message to conversation
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { conversationId, content } = req.body;
    const user = req.user!;

    if (!conversationId || !content) {
      return res.status(400).json({ error: 'Conversation ID and content are required' });
    }

    // Get conversation
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Check permission
    if (user.role === 'client') {
      if (conversation.clientId !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (conversation.status !== 'active') {
        return res.status(400).json({ error: 'Conversation is not active yet' });
      }
    }

    if (user.role === 'attendant') {
      if (conversation.attendantId !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Create message
    const [message] = await db
      .insert(messages)
      .values({
        conversationId,
        senderId: user.id,
        content
      })
      .returning();

    // Update conversation timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    // Get sender info
    const messageWithSender = {
      ...message,
      sender: {
        id: user.id,
        name: user.name
      }
    };

    await triggerWebhook('message.created', {
      messageId: message.id,
      conversationId,
      senderId: user.id
    });

    logger.success(`Message sent in conversation ${conversation.protocol}`, { module: 'Messages' });

    res.status(201).json(messageWithSender);
  } catch (error) {
    logger.error(`Failed to send message: ${error}`, { module: 'Messages' });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages for a conversation
router.get('/conversation/:conversationId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params;
    const user = req.user!;

    // Get conversation
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Check permission
    if (user.role === 'client' && conversation.clientId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (user.role === 'attendant' && 
        conversation.attendantId !== user.id && 
        conversation.status !== 'pending') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    // Get sender info for each message
    const messagesWithSenders = await Promise.all(
      conversationMessages.map(async (msg) => {
        const [sender] = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, msg.senderId));
        return { ...msg, sender };
      })
    );

    res.json(messagesWithSenders);
  } catch (error) {
    logger.error(`Failed to get messages: ${error}`, { module: 'Messages' });
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

export default router;
