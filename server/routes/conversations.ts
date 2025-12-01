import { Router } from 'express';
import { db, conversations, messages, users, protocols } from '../db';
import { eq, and, or, desc } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';
import { triggerWebhook } from '../services/webhookService';
import { generateProtocol } from '../utils/helpers';
import logger from '../utils/logger';

const router = Router();

// Get all conversations (filtered by user role)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { status } = req.query;
    const user = req.user!;

    let whereCondition;

    if (user.role === 'client') {
      // Clients can only see their own conversations
      whereCondition = eq(conversations.clientId, user.id);
    } else if (user.role === 'attendant') {
      // Attendants can see pending conversations or their assigned conversations
      whereCondition = or(
        eq(conversations.status, 'pending'),
        eq(conversations.attendantId, user.id)
      );
    }
    // Admins can see all conversations

    let query = db
      .select({
        id: conversations.id,
        protocol: conversations.protocol,
        channelId: conversations.channelId,
        clientId: conversations.clientId,
        attendantId: conversations.attendantId,
        status: conversations.status,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt
      })
      .from(conversations)
      .orderBy(desc(conversations.createdAt));

    if (whereCondition) {
      query = query.where(whereCondition) as typeof query;
    }

    if (status) {
      const statusCondition = eq(conversations.status, status as 'pending' | 'active' | 'closed');
      if (whereCondition) {
        query = query.where(and(whereCondition, statusCondition)) as typeof query;
      } else {
        query = query.where(statusCondition) as typeof query;
      }
    }

    const result = await query;

    // Get client and attendant info for each conversation
    const conversationsWithUsers = await Promise.all(
      result.map(async (conv) => {
        const [client] = await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, conv.clientId));

        let attendant = null;
        if (conv.attendantId) {
          const [att] = await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, conv.attendantId));
          attendant = att;
        }

        // Get last message
        const [lastMessage] = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        return {
          ...conv,
          client,
          attendant,
          lastMessage
        };
      })
    );

    res.json(conversationsWithUsers);
  } catch (error) {
    logger.error(`Failed to get conversations: ${error}`, { module: 'Conversations' });
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Get single conversation with messages
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

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

    // Get client info
    const [client] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, conversation.clientId));

    // Get attendant info
    let attendant = null;
    if (conversation.attendantId) {
      const [att] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, conversation.attendantId));
      attendant = att;
    }

    // Get messages
    const conversationMessages = await db
      .select({
        id: messages.id,
        content: messages.content,
        senderId: messages.senderId,
        createdAt: messages.createdAt
      })
      .from(messages)
      .where(eq(messages.conversationId, id))
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

    res.json({
      ...conversation,
      client,
      attendant,
      messages: messagesWithSenders
    });
  } catch (error) {
    logger.error(`Failed to get conversation: ${error}`, { module: 'Conversations' });
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Create conversation (clients only)
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { channelId, initialMessage } = req.body;

    // Only clients can create conversations
    if (user.role !== 'client') {
      return res.status(403).json({ error: 'Only clients can create conversations' });
    }

    // Generate unique protocol
    let protocol = generateProtocol();
    
    // Ensure protocol is unique
    let existing = await db
      .select()
      .from(conversations)
      .where(eq(conversations.protocol, protocol));
    
    while (existing.length > 0) {
      protocol = generateProtocol();
      existing = await db
        .select()
        .from(conversations)
        .where(eq(conversations.protocol, protocol));
    }

    // Create conversation
    const [conversation] = await db
      .insert(conversations)
      .values({
        protocol,
        channelId,
        clientId: user.id,
        status: 'pending'
      })
      .returning();

    // Create protocol record
    await db
      .insert(protocols)
      .values({
        protocol,
        conversationId: conversation.id
      });

    // Create initial message if provided
    if (initialMessage) {
      await db
        .insert(messages)
        .values({
          conversationId: conversation.id,
          senderId: user.id,
          content: initialMessage
        });
    }

    await triggerWebhook('conversation.created', conversation);

    logger.success(`Conversation created: ${protocol}`, { module: 'Conversations' });

    res.status(201).json(conversation);
  } catch (error) {
    logger.error(`Failed to create conversation: ${error}`, { module: 'Conversations' });
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Assign conversation to attendant
router.post('/:id/assign', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    if (user.role !== 'attendant' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only attendants and admins can assign conversations' });
    }

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.status !== 'pending') {
      return res.status(400).json({ error: 'Conversation is not pending' });
    }

    const [updated] = await db
      .update(conversations)
      .set({
        attendantId: user.id,
        status: 'active',
        updatedAt: new Date()
      })
      .where(eq(conversations.id, id))
      .returning();

    await triggerWebhook('conversation.assigned', {
      conversationId: updated.id,
      attendantId: user.id
    });

    logger.success(`Conversation ${updated.protocol} assigned to ${user.email}`, { module: 'Conversations' });

    res.json(updated);
  } catch (error) {
    logger.error(`Failed to assign conversation: ${error}`, { module: 'Conversations' });
    res.status(500).json({ error: 'Failed to assign conversation' });
  }
});

// Close conversation
router.post('/:id/close', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Check permission
    if (user.role === 'client' && conversation.clientId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (user.role === 'attendant' && conversation.attendantId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [updated] = await db
      .update(conversations)
      .set({
        status: 'closed',
        updatedAt: new Date()
      })
      .where(eq(conversations.id, id))
      .returning();

    await triggerWebhook('conversation.closed', {
      conversationId: updated.id
    });

    logger.success(`Conversation ${updated.protocol} closed`, { module: 'Conversations' });

    res.json(updated);
  } catch (error) {
    logger.error(`Failed to close conversation: ${error}`, { module: 'Conversations' });
    res.status(500).json({ error: 'Failed to close conversation' });
  }
});

export default router;
