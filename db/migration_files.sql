-- Add file attachment columns to messages table
ALTER TABLE messages ADD COLUMN file_url TEXT DEFAULT NULL;
ALTER TABLE messages ADD COLUMN file_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE messages ADD COLUMN file_type VARCHAR(100) DEFAULT NULL;
