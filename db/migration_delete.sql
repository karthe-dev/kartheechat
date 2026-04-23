-- Add delete columns to messages
ALTER TABLE messages ADD COLUMN deleted_for TEXT[] DEFAULT '{}';
ALTER TABLE messages ADD COLUMN deleted_for_everyone BOOLEAN DEFAULT FALSE;
