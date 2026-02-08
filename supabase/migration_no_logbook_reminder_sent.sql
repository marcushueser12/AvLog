/*
  Migration: Track when we send "no logbook uploaded" reminder email.
  Used to email users 3+ days after signup who have never uploaded a logbook page.
  Run this in your Supabase SQL Editor.
*/

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS no_logbook_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.no_logbook_reminder_sent_at IS 'When we sent the try on desktop / upload a logbook page re-engagement email; NULL = not sent yet';
