/*
  Migration: Track when we send "inactive" reminder email.
  Used to email users who have saved at least one scan but haven't saved one in over 7 days.
  Reminds them the mobile version is now live. One-time per user.
  Run this in your Supabase SQL Editor.
*/

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS inactive_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.inactive_reminder_sent_at IS 'When we sent the "you haven''t scanned in over a week, mobile is live" re-engagement email; NULL = not sent yet';
