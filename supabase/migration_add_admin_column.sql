-- Migration: Add is_admin column to user_profiles table
-- This allows setting admin status directly in the database
-- Run this in your Supabase SQL Editor

-- Add is_admin column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false NOT NULL;

-- Create index for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(is_admin) WHERE is_admin = true;

-- Add comment to column
COMMENT ON COLUMN user_profiles.is_admin IS 'Indicates if the user has admin privileges';

-- Example: Set a user as admin by email (replace with your email)
-- UPDATE user_profiles 
-- SET is_admin = true 
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');

-- Or set by user_id directly:
-- UPDATE user_profiles SET is_admin = true WHERE user_id = 'user-uuid-here';
