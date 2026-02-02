-- Migration: Add how_did_you_hear_about_us to user_profiles
-- Stores optional signup referral source (from AuthModal signup form)
-- Run this in your Supabase SQL Editor

-- Add column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS how_did_you_hear_about_us TEXT;

COMMENT ON COLUMN user_profiles.how_did_you_hear_about_us IS 'Optional: How the user heard about LogExtract (from signup form)';

-- Update handle_new_user to copy value from auth.users.raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, credits, plan_type, how_did_you_hear_about_us)
  VALUES (
    NEW.id,
    3, -- Default: 3 credits for new users
    'free',
    NULLIF(TRIM(NEW.raw_user_meta_data->>'howDidYouHearAboutUs'), '')
  );
  RETURN NEW;
END;
$$;

-- For existing users who signed up before this migration, the column will be NULL.
-- New signups will have the value copied from user_metadata automatically.
