-- Add message status tracking
-- 'sent' = single tick, 'delivered' = double gray tick, 'read' = double blue tick
ALTER TABLE messages ADD COLUMN status VARCHAR(10) DEFAULT 'sent';
ALTER TABLE messages ADD COLUMN read_by TEXT[] DEFAULT '{}';
