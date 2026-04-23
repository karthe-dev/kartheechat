-- ============================================
-- KartheeChat - PostgreSQL Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- ============================================
-- Stores registered users with hashed passwords
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username    VARCHAR(50) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);

-- ============================================
-- 2. ROOMS TABLE
-- ============================================
-- Stores both DM (1-on-1) and Group chat rooms
-- is_group = false → DM room (exactly 2 members)
-- is_group = true  → Group room (1+ members)
CREATE TABLE rooms (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    is_group    BOOLEAN NOT NULL DEFAULT FALSE,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rooms_is_group ON rooms(is_group);
CREATE INDEX idx_rooms_created_by ON rooms(created_by);

-- ============================================
-- 3. ROOM_MEMBERS TABLE (Junction Table)
-- ============================================
-- Many-to-Many relationship between users and rooms
-- joined_at tracks when each user joined (used to filter
-- message visibility — users only see messages after join)
CREATE TABLE room_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at     TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,

    UNIQUE(room_id, user_id)
);

CREATE INDEX idx_room_members_room_id ON room_members(room_id);
CREATE INDEX idx_room_members_user_id ON room_members(user_id);
CREATE INDEX idx_room_members_active ON room_members(room_id, is_active);

-- ============================================
-- 4. MESSAGES TABLE
-- ============================================
-- Stores all chat messages (user messages + system logs)
-- sender_id = NULL for system messages (join/leave logs)
-- is_system = true for system-generated messages
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_name VARCHAR(50) NOT NULL,
    content     TEXT NOT NULL,
    is_system   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_room_created ON messages(room_id, created_at);

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View: Get rooms with member count
CREATE VIEW room_summary AS
SELECT
    r.id,
    r.name,
    r.is_group,
    r.created_by,
    r.created_at,
    COUNT(rm.user_id) FILTER (WHERE rm.is_active = TRUE) AS member_count
FROM rooms r
LEFT JOIN room_members rm ON r.id = rm.room_id
GROUP BY r.id;

-- View: Get last message per room (for chat list preview)
CREATE VIEW room_last_message AS
SELECT DISTINCT ON (m.room_id)
    m.room_id,
    m.id AS message_id,
    m.sender_id,
    m.sender_name,
    m.content,
    m.is_system,
    m.created_at
FROM messages m
ORDER BY m.room_id, m.created_at DESC;

-- ============================================
-- SAMPLE QUERIES (for reference)
-- ============================================

-- Get all rooms for a user (with member info)
-- SELECT r.*, rm.joined_at
-- FROM rooms r
-- JOIN room_members rm ON r.id = rm.room_id
-- WHERE rm.user_id = :userId AND rm.is_active = TRUE;

-- Get messages for a room (filtered by user's join time)
-- SELECT m.*
-- FROM messages m
-- JOIN room_members rm ON m.room_id = rm.room_id AND rm.user_id = :userId
-- WHERE m.room_id = :roomId
--   AND m.created_at >= rm.joined_at
-- ORDER BY m.created_at ASC;

-- Get all groups (for Available Groups panel)
-- SELECT r.*, COUNT(rm.user_id) FILTER (WHERE rm.is_active) AS member_count
-- FROM rooms r
-- LEFT JOIN room_members rm ON r.id = rm.room_id
-- WHERE r.is_group = TRUE
-- GROUP BY r.id;

-- Find existing DM room between two users
-- SELECT r.id
-- FROM rooms r
-- JOIN room_members rm1 ON r.id = rm1.room_id AND rm1.user_id = :userId1 AND rm1.is_active
-- JOIN room_members rm2 ON r.id = rm2.room_id AND rm2.user_id = :userId2 AND rm2.is_active
-- WHERE r.is_group = FALSE;

-- Get unread count per room for a user (requires read_receipts table - future)
-- For now, unread tracking is handled client-side via signals
