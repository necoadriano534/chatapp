import { pgTable, text, timestamp, uuid, pgEnum, jsonb, boolean, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['attendant', 'client', 'admin']);
export const conversationStatusEnum = pgEnum('conversation_status', ['pending', 'active', 'closed']);
export const channelTypeEnum = pgEnum('channel_type', ['whatsapp', 'telegram', 'email', 'webchat', 'sms']);
export const webhookAuthTypeEnum = pgEnum('webhook_auth_type', ['Basic', 'Bearer', 'ApiKey', 'Hawk']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: userRoleEnum('role').notNull().default('client'),
  preferredChannel: text('preferred_channel'),
  remoteJid: text('remote_jid'),
  externalId: text('external_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Channels table
export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: channelTypeEnum('type').notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Conversations table
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  protocol: text('protocol').notNull().unique(),
  channelId: uuid('channel_id').references(() => channels.id),
  clientId: uuid('client_id').references(() => users.id).notNull(),
  attendantId: uuid('attendant_id').references(() => users.id),
  status: conversationStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Messages table
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  senderId: uuid('sender_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Webhooks table
export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  events: text('events').array().notNull(),
  authType: webhookAuthTypeEnum('auth_type').notNull(),
  authConfig: jsonb('auth_config').$type<Record<string, unknown>>().default({}),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Protocols table (for protocol generation tracking)
export const protocols = pgTable('protocols', {
  id: uuid('id').primaryKey().defaultRandom(),
  protocol: text('protocol').notNull().unique(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// WebAuthn credentials table
export const webauthnCredentials = pgTable('webauthn_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  deviceType: text('device_type'),
  transports: text('transports').array(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  clientConversations: many(conversations, { relationName: 'client' }),
  attendantConversations: many(conversations, { relationName: 'attendant' }),
  messages: many(messages),
  webauthnCredentials: many(webauthnCredentials)
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  client: one(users, {
    fields: [conversations.clientId],
    references: [users.id],
    relationName: 'client'
  }),
  attendant: one(users, {
    fields: [conversations.attendantId],
    references: [users.id],
    relationName: 'attendant'
  }),
  channel: one(channels, {
    fields: [conversations.channelId],
    references: [channels.id]
  }),
  messages: many(messages),
  protocols: many(protocols)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id]
  })
}));

export const channelsRelations = relations(channels, ({ many }) => ({
  conversations: many(conversations)
}));

export const protocolsRelations = relations(protocols, ({ one }) => ({
  conversation: one(conversations, {
    fields: [protocols.conversationId],
    references: [conversations.id]
  })
}));

export const webauthnCredentialsRelations = relations(webauthnCredentials, ({ one }) => ({
  user: one(users, {
    fields: [webauthnCredentials.userId],
    references: [users.id]
  })
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type Protocol = typeof protocols.$inferSelect;
export type NewProtocol = typeof protocols.$inferInsert;
export type WebAuthnCredential = typeof webauthnCredentials.$inferSelect;
export type NewWebAuthnCredential = typeof webauthnCredentials.$inferInsert;
