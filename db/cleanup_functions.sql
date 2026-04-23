-- ============================================
-- KartheeChat - Cleanup Functions
-- Run this in Supabase SQL Editor to create
-- ============================================

-- 1. Clear all messages only (keeps rooms & users)
CREATE OR REPLACE FUNCTION clear_all_messages()
RETURNS TEXT AS $$
DECLARE
  msg_count INT;
BEGIN
  SELECT COUNT(*) INTO msg_count FROM messages;
  DELETE FROM messages;
  RETURN 'Deleted ' || msg_count || ' messages';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clear all rooms (deletes rooms + members + messages via CASCADE)
CREATE OR REPLACE FUNCTION clear_all_rooms()
RETURNS TEXT AS $$
DECLARE
  room_count INT;
  msg_count INT;
  member_count INT;
BEGIN
  SELECT COUNT(*) INTO msg_count FROM messages;
  SELECT COUNT(*) INTO member_count FROM room_members;
  SELECT COUNT(*) INTO room_count FROM rooms;
  DELETE FROM messages;
  DELETE FROM room_members;
  DELETE FROM rooms;
  RETURN 'Deleted ' || room_count || ' rooms, ' || member_count || ' memberships, ' || msg_count || ' messages';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Full reset (rooms + messages + users - EVERYTHING)
CREATE OR REPLACE FUNCTION clear_everything()
RETURNS TEXT AS $$
DECLARE
  user_count INT;
  room_count INT;
  msg_count INT;
BEGIN
  SELECT COUNT(*) INTO msg_count FROM messages;
  SELECT COUNT(*) INTO room_count FROM rooms;
  SELECT COUNT(*) INTO user_count FROM users;
  DELETE FROM messages;
  DELETE FROM room_members;
  DELETE FROM rooms;
  DELETE FROM users;
  RETURN 'FULL RESET: ' || user_count || ' users, ' || room_count || ' rooms, ' || msg_count || ' messages deleted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Clear file references from messages (set file columns to NULL)
CREATE OR REPLACE FUNCTION clear_file_references()
RETURNS TEXT AS $$
DECLARE
  file_count INT;
BEGIN
  SELECT COUNT(*) INTO file_count FROM messages WHERE file_url IS NOT NULL;
  UPDATE messages SET file_url = NULL, file_name = NULL, file_type = NULL WHERE file_url IS NOT NULL;
  RETURN 'Cleared ' || file_count || ' file references. Delete bucket files from Supabase Storage dashboard.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Scheduled cleanup: Delete messages older than N days
CREATE OR REPLACE FUNCTION clear_old_messages(days_old INT DEFAULT 30)
RETURNS TEXT AS $$
DECLARE
  msg_count INT;
BEGIN
  SELECT COUNT(*) INTO msg_count FROM messages WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
  DELETE FROM messages WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
  RETURN 'Deleted ' || msg_count || ' messages older than ' || days_old || ' days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- HOW TO USE (run in SQL Editor):
-- ============================================
-- Clear only messages:
--   SELECT clear_all_messages();
--
-- Clear rooms + members + messages:
--   SELECT clear_all_rooms();
--
-- Full reset (users + rooms + messages):
--   SELECT clear_everything();
--
-- Clear file references:
--   SELECT clear_file_references();
--
-- Delete messages older than 7 days:
--   SELECT clear_old_messages(7);
--
-- ============================================
-- STORAGE BUCKET CLEANUP
-- ============================================
-- Delete only chat files (keep avatars):
-- DELETE FROM storage.objects WHERE bucket_id = 'KartheBucket' AND name NOT LIKE 'avatars/%';
--
-- Delete everything in bucket (including avatars):
-- DELETE FROM storage.objects WHERE bucket_id = 'KartheBucket';
--
-- Manual: Dashboard → Storage → KartheBucket → Select files → Delete
--
-- ============================================
-- WEEKLY CRON JOB (keeps users + avatars)
-- ============================================
-- Enable pg_cron extension first:
-- Supabase Dashboard → Database → Extensions → pg_cron → Enable
--
-- Schedule weekly cleanup (Sunday midnight UTC):
--
--   SELECT cron.schedule(
--     'weekly-cleanup',
--     '0 0 * * 0',
--     $$
--       DELETE FROM messages;
--       DELETE FROM room_members;
--       DELETE FROM rooms;
--       DELETE FROM storage.objects WHERE bucket_id = 'KartheBucket' AND name NOT LIKE 'avatars/%';
--     $$
--   );
--
-- Verify scheduled jobs:
--   SELECT * FROM cron.job;
--
-- Remove the cron job:
--   SELECT cron.unschedule('weekly-cleanup');
