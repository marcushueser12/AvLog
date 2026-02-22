/*
  RLS Full Security Migration
  Ensures no user can access data that isn't theirs.
  Run in Supabase SQL Editor.

  SAFE: Only removes user_profiles UPDATE policy.
  - Users can still: edit entries, upload, verify scans, manage aircraft, etc.
  - All user data operations go through the API (service role) or use existing RLS policies.
  - Removing UPDATE on user_profiles prevents users from modifying credits/plan via direct Supabase calls.
  - Does NOT use FORCE ROW LEVEL SECURITY (could break triggers like handle_new_user).
*/

-- ============================================
-- user_profiles: Remove UPDATE policy
-- Users must NOT be able to update their own profile (e.g. credits, plan_type).
-- Backend uses service role for all profile updates (credits, plan, reminders, etc).
-- ============================================
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- ============================================
-- Unchanged (no action needed):
-- - verified_scans, verified_entries: full CRUD for own user_id (edit, delete, etc.)
-- - aircraft_profiles: full CRUD for own user_id
-- - credit_transactions: SELECT only for own (backend inserts via service role)
-- - support_requests, reviews, cloud_uploads: existing policies remain
