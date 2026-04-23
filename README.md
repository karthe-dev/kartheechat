# 💬 KartheeChat

A full-featured real-time chat application built with **Angular 20** and **NestJS**, structured as a monorepo. Powered by **Supabase** (PostgreSQL + Storage).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 20.3 (Standalone Components, Signals) |
| Backend | NestJS 10 (REST + WebSocket Gateway) |
| Real-time | Socket.IO |
| Auth | JWT + Passport + bcrypt |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage (KartheBucket) |
| Dev Server | Nodemon (auto-restart on changes) |
| Monorepo | npm Workspaces |

---

## Project Structure

```
chat-app/
├── apps/
│   ├── client/                    # Angular frontend
│   │   └── src/
│   │       ├── app/
│   │       │   ├── components/
│   │       │   │   └── toast.component.ts
│   │       │   ├── guards/
│   │       │   │   └── auth.guard.ts
│   │       │   ├── pages/
│   │       │   │   ├── login/
│   │       │   │   ├── chat/
│   │       │   │   └── settings/
│   │       │   ├── services/
│   │       │   │   ├── auth.service.ts
│   │       │   │   ├── auth.interceptor.ts
│   │       │   │   ├── chat.service.ts
│   │       │   │   └── toast.service.ts
│   │       │   ├── app.routes.ts
│   │       │   ├── app.config.ts
│   │       │   └── app.component.ts
│   │       ├── styles.scss
│   │       └── index.html
│   │
│   └── server/                    # NestJS backend
│       ├── src/
│       │   ├── auth/
│       │   ├── chat/
│       │   ├── user/
│       │   ├── supabase/
│       │   ├── app.module.ts
│       │   └── main.ts
│       └── nodemon.json
│
├── libs/shared/src/index.ts       # Shared TypeScript interfaces
│
├── db/
│   ├── schema.sql
│   ├── cleanup_functions.sql
│   ├── migration_reactions.sql
│   ├── migration_files.sql
│   ├── migration_avatar.sql
│   ├── migration_forward.sql
│   ├── migration_pin.sql
│   ├── migration_theme.sql
│   ├── migration_delete.sql
│   ├── migration_reply.sql
│   ├── migration_read_receipts.sql
│   └── README.md
│
└── package.json
```

---

## Database Schema

| Table | Columns |
|-------|---------|
| `users` | id, username, password, avatar_url, theme, created_at |
| `rooms` | id, name, is_group, created_by, pinned_message_id, created_at |
| `room_members` | id, room_id, user_id, joined_at, left_at, is_active |
| `messages` | id, room_id, sender_id, sender_name, content, is_system, reactions, file_url, file_name, file_type, forwarded, forwarded_from, deleted_for, deleted_for_everyone, reply_to_id, reply_to_content, reply_to_sender, status, read_by, created_at |

---

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | JWT | Get current user (with theme) |
| GET | `/api/auth/users` | JWT | List all users (with avatars) |
| POST | `/api/auth/avatar` | JWT | Upload profile avatar |
| POST | `/api/auth/reset-password` | JWT | Change password |
| POST | `/api/auth/theme` | JWT | Update dark/light theme |

### Chat

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/chat/dm/:userId` | JWT | Start/get DM room |
| POST | `/api/chat/group` | JWT | Create group chat |
| POST | `/api/chat/group/:roomId/join` | JWT | Join a group |
| POST | `/api/chat/group/:roomId/leave` | JWT | Exit a group |
| GET | `/api/chat/groups` | JWT | List all available groups |
| GET | `/api/chat/rooms` | JWT | Get user's rooms |
| GET | `/api/chat/rooms/:roomId/messages` | JWT | Get messages (`?since=`) |
| POST | `/api/chat/rooms/:roomId/pin` | JWT | Pin/unpin a message |
| POST | `/api/chat/upload/:roomId` | JWT | Upload file/image with caption |
| POST | `/api/chat/forward` | JWT | Forward message to a room |
| POST | `/api/chat/forward-to-user` | JWT | Forward message to a user |
| POST | `/api/chat/messages/:id/delete-for-me` | JWT | Delete message for self |
| POST | `/api/chat/messages/:id/delete-for-everyone` | JWT | Delete message for all |

### Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `sendMessage` | Client → Server | Send message (with optional reply) |
| `newMessage` | Server → Clients | Broadcast new message |
| `joinRoom` | Client → Server | Join a socket room |
| `markRead` | Client → Server | Mark messages as read |
| `typing` / `stopTyping` | Bidirectional | Typing indicators |
| `reactMessage` | Client → Server | React to a message |
| `messageReacted` | Server → Clients | Broadcast reaction update |
| `messageDeleted` | Server → Clients | Broadcast delete-for-everyone |
| `messagePinned` | Server → Clients | Broadcast pin/unpin |
| `messagesDelivered` | Server → Clients | Messages marked delivered |
| `messagesRead` | Server → Clients | Messages marked read |
| `roomCreated` | Server → Clients | New room notification |
| `groupListUpdated` | Server → All | Group list changed |
| `userJoined` / `userLeft` | Server → Clients | Member join/leave |
| `userOnline` / `userOffline` | Server → All | Online status |
| `onlineUsersList` | Server → Client | Full online users list on connect |

---

## Features

### Authentication & Account
- Register / Login with JWT tokens
- Profile avatar upload (Supabase Storage, 2MB max)
- Password reset (current + new password)
- Account settings page (`/settings`)
- Dark / Light theme toggle (saved to DB per user)
- Toast notifications for success/error feedback

### Messaging
- **Individual (DM) chat** — 1-on-1 messaging
- **Group chat** — Create, join, exit groups
- **Real-time messaging** via Socket.IO
- **Message formatting** — `*bold*` `_italic_` `~strikethrough~` + multiline (Shift+Enter)
- **Emoji picker** — 7 categories, 500+ native Unicode emojis
- **File/image sharing** — Upload with caption, 2MB limit, Supabase Storage
- **Notification sound** — Web Audio API beep for incoming messages

### Message Reactions
- Hover message → 😊 button → quick picker: 👍 ❤️ 😂 😮 😢 🙏
- Reactions display as chips below bubble with count
- Click chip to toggle your reaction (add/remove)
- Your reacted chips highlighted in green
- Real-time sync via socket

### Message Reply
- Hover message → ↩️ Reply button
- Reply bar appears above input with sender name + preview
- Sent message shows quoted reply inside bubble (green left border)
- Click reply preview → smooth scroll to original message with highlight pulse
- ✕ to cancel reply

### Message Forwarding
- Hover message → ↪️ Forward button
- Modal with **Chats** and **Users** tabs
- Forward to existing room or directly to a user (auto-creates DM)
- Forwarded messages show "↪ Forwarded from username" label
- Toast confirmation

### Message Pinning
- Hover message → 📌 Pin button
- Pinned message bar appears below chat header
- Click pinned bar → scroll to original message with highlight
- ✕ to unpin
- Real-time sync — all members see pin/unpin

### Message Deletion
- Hover message → 🗑️ Delete button
- Confirmation dialog with message preview:
  - **Delete for everyone** (red) — only for your own messages, replaces with "🚫 This message was deleted"
  - **Delete for me** (gray) — hides from your view only
  - **Cancel** — closes dialog
- Real-time sync for delete-for-everyone

### Read Receipts (WhatsApp-style ticks)
- **✓ Single gray tick** — Message sent, recipient offline
- **✓✓ Double gray tick** — Message delivered (recipient online)
- **✓✓ Double blue tick** — Message read (recipient opened chat)
- Auto-delivery: marks delivered when recipient connects
- Auto-read: marks read when recipient opens the room
- Real-time tick updates via socket

### Typing Indicators
- Shown in three places: chat header, sidebar preview, above input
- Per-room tracking for accurate indicators
- Group support: "alice, bob are typing..."
- Auto-clears after 1.5 seconds of inactivity

### Online/Offline Status
- Green dot on avatars for online users
- "online" / "offline" text in Users tab and chat header
- Full online users list sent on connect (no stale data)
- Real-time updates via socket events

### Unread Message Badges
- Green count badge per chat in sidebar
- Bold room name + green timestamp for unread chats (like WhatsApp)
- Darker preview text for unread chats
- Badge and styling clears instantly when chat is opened
- Last message preview with timestamp in sidebar

### Search
- Search bar below sidebar tabs
- Filters chats, users, and groups in real-time
- Case-insensitive matching

### Groups
- Discoverable via Groups tab
- Join confirmation prompt
- System messages for join/leave events
- Message visibility starts from join time (no history leak)
- Non-members see locked screen with Join button
- Exit group with system log broadcast
- NEW badge on Groups tab for new groups

### User Avatars
- Upload from Settings page
- Displayed everywhere: sidebar, chat list, user list, chat header
- Falls back to first-letter circle if no avatar

### Dark / Light Theme
- 🌙/☀️ toggle in sidebar header
- Theme preference saved to Supabase DB per user
- Persists across sessions and devices
- Full dark theme: sidebar, chat, bubbles, input, modals, login, settings

### Mobile Responsive
- Full-screen sidebar ↔ chat toggle on mobile (≤576px)
- ← Back button in chat header
- Touch-optimized sizes
- Responsive login and settings pages
- Thinner scrollbars on mobile

### Data Management
- Supabase SQL cleanup functions:
  - `SELECT clear_all_messages();`
  - `SELECT clear_all_rooms();`
  - `SELECT clear_everything();`
  - `SELECT clear_old_messages(7);`
- Weekly auto-cleanup via pg_cron (keeps users)
- Storage: `DELETE FROM storage.objects WHERE bucket_id = 'KartheBucket';`

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase account

### Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Run `db/schema.sql` in SQL Editor
3. Run all migration files in `db/` folder
4. Run `db/cleanup_functions.sql`
5. Create storage bucket `KartheBucket` (Public)
6. Disable RLS on all tables
7. Set Project URL + service_role key in `apps/server/src/supabase/supabase.service.ts`

### Installation

```bash
cd chat-app
npm install
```

### Running

```bash
# Both with auto-reload
npm run dev

# Or individually
npm run start:server    # http://localhost:3000 (nodemon)
npm run start:client    # http://localhost:4200 (ng serve)
```

### Testing

1. Open http://localhost:4200 in two browsers
2. Register two users
3. Users tab → click user → DM
4. Groups tab → create/join groups
5. Test: emojis, reactions, reply, forward, pin, delete, file upload
6. Test: typing indicators, online status, read receipts
7. Test: dark mode, search, mobile viewport (F12 → device toolbar)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Angular 20 Client                         │
│                                                              │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌─────────────┐  │
│  │  Login   │ │    Chat    │ │ Settings │ │  Services    │  │
│  │  Page    │ │    Page    │ │   Page   │ │ Auth/Chat    │  │
│  │          │ │ Search     │ │ Avatar   │ │ Toast        │  │
│  │          │ │ Tabs       │ │ Password │ │ Interceptor  │  │
│  │          │ │ Messages   │ │ Theme    │ │              │  │
│  │          │ │ Reactions  │ │          │ │              │  │
│  │          │ │ Reply/Fwd  │ │          │ │              │  │
│  │          │ │ Pin/Delete │ │          │ │              │  │
│  │          │ │ Emoji/File │ │          │ │              │  │
│  └──────────┘ └────────────┘ └──────────┘ └─────────────┘  │
│                     │ HTTP + WebSocket │                      │
└─────────────────────┼─────────────────┼──────────────────────┘
                      │                 │
┌─────────────────────┼─────────────────┼──────────────────────┐
│                   NestJS Server (Nodemon)                     │
│  ┌──────────────────┐  ┌─────────────────────┐               │
│  │ AuthController    │  │ ChatController       │               │
│  │ register/login    │  │ rooms/messages       │               │
│  │ avatar/password   │  │ groups/upload        │               │
│  │ theme             │  │ forward/pin/delete   │               │
│  └──────────────────┘  └─────────────────────┘               │
│  ┌───────────────────────────────────────────────┐           │
│  │            ChatGateway (Socket.IO)             │           │
│  │ messages | typing | reactions | read receipts  │           │
│  │ online | pin | delete | forward | delivery     │           │
│  └───────────────────────────────────────────────┘           │
│                      │                                        │
└──────────────────────┼────────────────────────────────────────┘
                       │
┌──────────────────────┼────────────────────────────────────────┐
│                   Supabase Cloud                               │
│  ┌───────────┐ ┌───────────┐ ┌────────────┐ ┌─────────────┐  │
│  │  users    │ │  rooms    │ │  messages  │ │ KartheBucket │  │
│  │ +avatar   │ │ +pin      │ │ +reactions │ │ (Storage)    │  │
│  │ +theme    │ │ room_     │ │ +files     │ │ avatars/     │  │
│  │           │ │ members   │ │ +forward   │ │ chat files/  │  │
│  │           │ │           │ │ +reply     │ │              │  │
│  │           │ │           │ │ +delete    │ │              │  │
│  │           │ │           │ │ +status    │ │              │  │
│  │           │ │           │ │ +read_by   │ │              │  │
│  └───────────┘ └───────────┘ └────────────┘ └─────────────┘  │
│  ┌───────────────────────────────────────────────┐           │
│  │  pg_cron: weekly cleanup (keeps users)         │           │
│  └───────────────────────────────────────────────┘           │
└───────────────────────────────────────────────────────────────┘
```
