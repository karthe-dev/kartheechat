-- Add pinned message to rooms
ALTER TABLE rooms ADD COLUMN pinned_message_id UUID REFERENCES messages(id) ON DELETE SET NULL DEFAULT NULL;
