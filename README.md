# ChatApp

A complete chat application built with modern technologies, featuring real-time messaging, WebAuthn authentication, and webhook integrations.

## 🚀 Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Styling**: TailwindCSS + Radix UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: Socket.io
- **Authentication**: JWT + WebAuthn

## 📁 Project Structure

```
/
├── client/              # Frontend (React)
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route pages
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and contexts
│   └── styles/          # Global styles
├── server/              # Backend (Express)
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── services/        # Business logic
│   ├── socket/          # Socket.io setup
│   ├── utils/           # Helper functions
│   └── db/              # Database schema and connection
├── data/
│   └── logs/            # Application logs
├── vite.config.ts       # Vite configuration
├── drizzle.config.ts    # Drizzle ORM configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── package.json         # Dependencies
```

## 🔧 Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```
4. Set up PostgreSQL and update `DATABASE_URL` in `.env`
5. Run database migrations:
   ```bash
   npm run db:push
   ```
6. Start the development server:
   ```bash
   npm run dev
   ```

## 📝 Database Schema

### Users
- `id`, `name`, `email`, `password`, `role` (attendant/client/admin)
- `preferred_channel`, `remote_jid`, `external_id`
- `created_at`, `updated_at`

### Conversations
- `id`, `protocol` (unique uppercase), `channel_id`
- `client_id`, `attendant_id`, `status` (pending/active/closed)
- `created_at`, `updated_at`

### Messages
- `id`, `conversation_id`, `sender_id`, `content`, `created_at`

### Channels
- `id`, `name`, `type`, `config` (JSONB), `created_at`

### Webhooks
- `id`, `name`, `url`, `events[]`, `auth_type`, `auth_config`
- `active`, `created_at`

## 🌐 API Routes

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/password` - Change password

- `GET /api/users` - List users (with role filter)
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin only)

- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation (clients only)
- `POST /api/conversations/:id/assign` - Assign to attendant
- `POST /api/conversations/:id/close` - Close conversation

- `POST /api/messages` - Send message
- `GET /api/messages/conversation/:id` - Get conversation messages

- `GET /api/channels` - List channels
- `POST /api/channels` - Create channel (admin only)
- `PUT /api/channels/:id` - Update channel
- `DELETE /api/channels/:id` - Delete channel

- `GET /api/webhooks` - List webhooks
- `GET /api/webhooks/events` - List available events
- `POST /api/webhooks` - Create webhook
- `PUT /api/webhooks/:id` - Update webhook
- `DELETE /api/webhooks/:id` - Delete webhook
- `POST /api/webhooks/:id/test` - Test webhook

## 🔐 Authentication

- JWT tokens for API authentication
- WebAuthn support for biometric/security key authentication
  - Face ID
  - Touch ID
  - Windows Hello
  - PIN
  - USB/NFC security keys

## 📤 Webhook Events

Events are automatically generated based on API routes:
- `auth.login`, `auth.register`, `auth.logout`
- `user.created`, `user.updated`, `user.deleted`
- `conversation.created`, `conversation.assigned`, `conversation.closed`
- `message.created`, `message.received`
- `channel.created`, `channel.updated`, `channel.deleted`
- `webhook.created`, `webhook.updated`, `webhook.deleted`

Supported authentication types:
- Basic Auth
- Bearer Token
- API Key
- Hawk

## 📊 Logging

Logs are saved to `./data/logs/{date}.log` with colored output:
- HTTP methods: GET (green), POST (blue), PUT/PATCH (yellow), DELETE (red)
- Log levels: INFO (cyan), WARN (yellow), ERROR (red), DEBUG (magenta)

## 📱 Frontend Pages

- `/login` - User login
- `/register` - User registration
- `/contacts` - Client management (CRUD)
- `/attendants` - Attendant management (CRUD)
- `/supervisors` - Admin management (CRUD)
- `/conversations` - Conversation list
- `/conversations/:id` - Chat interface
- `/settings` - Settings with sub-pages:
  - General (theme, account info)
  - Security (password, WebAuthn)
  - Channels (CRUD)
  - Webhooks (CRUD)