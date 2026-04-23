# KartheeChat - Database Schema

## ER Diagram

```
┌──────────────────┐       ┌──────────────────────┐       ┌──────────────────┐
│      users       │       │    room_members       │       │      rooms       │
├──────────────────┤       ├──────────────────────┤       ├──────────────────┤
│ id (PK, UUID)    │──┐    │ id (PK, UUID)        │    ┌──│ id (PK, UUID)    │
│ username (UNIQUE)│  │    │ room_id (FK) ────────│────┘  │ name             │
│ password         │  └────│ user_id (FK)         │       │ is_group         │
│ created_at       │       │ joined_at            │       │ created_by (FK)──│──┐
│ updated_at       │       │ left_at              │       │ created_at       │  │
└──────────────────┘       │ is_active            │       │ updated_at       │  │
        │                  │                      │       └──────────────────┘  │
        │                  │ UNIQUE(room_id,      │              │              │
        │                  │        user_id)      │              │              │
        │                  └──────────────────────┘              │              │
        │                                                        │              │
        │                  ┌──────────────────────┐              │              │
        │                  │     messages          │              │              │
        │                  ├──────────────────────┤              │              │
        │                  │ id (PK, UUID)        │              │              │
        └──────────────────│ sender_id (FK)       │              │              │
                           │ sender_name          │              │              │
                           │ room_id (FK) ────────│──────────────┘              │
                           │ content              │                             │
                           │ is_system            │         users.id ───────────┘
                           │ created_at           │
                           └──────────────────────┘
```

## Tables Summary

| Table | Purpose | Row Count Estimate |
|-------|---------|-------------------|
| `users` | Registered users | Low (hundreds) |
| `rooms` | DM + Group chat rooms | Medium (thousands) |
| `room_members` | User ↔ Room membership (M:N) | Medium (thousands) |
| `messages` | All chat messages + system logs | High (millions) |

## Mapping: In-Memory → PostgreSQL

| In-Memory | PostgreSQL | Notes |
|-----------|-----------|-------|
| `User.id` | `users.id` (UUID) | Auto-generated |
| `User.username` | `users.username` (VARCHAR UNIQUE) | |
| `User.password` | `users.password` (VARCHAR) | bcrypt hash |
| `Room.id` | `rooms.id` (UUID) | Auto-generated |
| `Room.name` | `rooms.name` (VARCHAR) | "dm" for DMs |
| `Room.isGroup` | `rooms.is_group` (BOOLEAN) | |
| `Room.createdBy` | `rooms.created_by` (FK → users) | |
| `Room.members[]` | `room_members` table | Junction table |
| `Room.joinedAt[userId]` | `room_members.joined_at` | Per-user join time |
| `Message.id` | `messages.id` (UUID) | Auto-generated |
| `Message.senderId` | `messages.sender_id` (FK → users) | NULL for system |
| `Message.senderName` | `messages.sender_name` (VARCHAR) | Denormalized for perf |
| `Message.roomId` | `messages.room_id` (FK → rooms) | |
| `Message.content` | `messages.content` (TEXT) | Supports emojis |
| `Message.timestamp` | `messages.created_at` (TIMESTAMPTZ) | |
| `Message.isSystem` | `messages.is_system` (BOOLEAN) | Join/leave logs |

## Key Design Decisions

1. **`room_members.is_active`** — Soft delete for group exits. When a user leaves, `is_active = FALSE` and `left_at` is set. This preserves history while hiding the room from the user's list.

2. **`room_members.joined_at`** — Critical for message visibility. Users only see messages sent after their join time. Query: `WHERE m.created_at >= rm.joined_at`.

3. **`messages.sender_name`** — Denormalized from `users.username` for read performance. Avoids JOIN on every message fetch.

4. **`messages.sender_id = NULL`** for system messages — System messages (join/leave) don't have a real sender. `is_system = TRUE` flag distinguishes them.

5. **DM room uniqueness** — Enforced at application level. Query checks for existing room with both users before creating.

6. **Indexes** — Optimized for the most common queries:
   - `idx_messages_room_created` → Fetching messages for a room (sorted by time)
   - `idx_room_members_active` → Getting active members of a room
   - `idx_users_username` → Login lookup

## Future Tables (when needed)

| Table | Purpose |
|-------|---------|
| `read_receipts` | Track last read message per user per room (blue ticks) |
| `attachments` | File/image uploads linked to messages |
| `user_profiles` | Avatars, bio, status |
| `push_tokens` | Push notification device tokens |
