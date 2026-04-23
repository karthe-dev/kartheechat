-- Add forwarded message columns
ALTER TABLE messages ADD COLUMN forwarded BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN forwarded_from VARCHAR(100) DEFAULT NULL;
