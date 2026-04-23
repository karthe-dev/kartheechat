-- Add reactions column to messages table
-- reactions format: { "😂": ["userId1", "userId2"], "❤️": ["userId3"] }
ALTER TABLE messages ADD COLUMN reactions JSONB DEFAULT '{}';
