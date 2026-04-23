-- Add reply columns to messages
ALTER TABLE messages ADD COLUMN reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL DEFAULT NULL;
ALTER TABLE messages ADD COLUMN reply_to_content TEXT DEFAULT NULL;
ALTER TABLE messages ADD COLUMN reply_to_sender VARCHAR(100) DEFAULT NULL;
