-- RLS Performance Optimization Migration
-- Run this SQL in your Supabase SQL Editor to fix performance warnings
-- This optimizes RLS policies by using (select auth.uid()) instead of auth.uid()
-- and consolidates multiple permissive policies where possible

-- Drop existing policies to recreate them with optimizations
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

DROP POLICY IF EXISTS "Users can view own scans" ON verified_scans;
DROP POLICY IF EXISTS "Users can insert own scans" ON verified_scans;
DROP POLICY IF EXISTS "Users can update own scans" ON verified_scans;
DROP POLICY IF EXISTS "Users can delete own scans" ON verified_scans;

DROP POLICY IF EXISTS "Users can view own entries" ON verified_entries;
DROP POLICY IF EXISTS "Users can insert own entries" ON verified_entries;
DROP POLICY IF EXISTS "Users can update own entries" ON verified_entries;
DROP POLICY IF EXISTS "Users can delete own entries" ON verified_entries;

DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;

DROP POLICY IF EXISTS "Users can view own aircraft profiles" ON aircraft_profiles;
DROP POLICY IF EXISTS "Users can insert own aircraft profiles" ON aircraft_profiles;
DROP POLICY IF EXISTS "Users can update own aircraft profiles" ON aircraft_profiles;
DROP POLICY IF EXISTS "Users can delete own aircraft profiles" ON aircraft_profiles;

DROP POLICY IF EXISTS "Anyone can view approved reviews" ON reviews;
DROP POLICY IF EXISTS "Users can view own reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can submit reviews" ON reviews;

-- Recreate user_profiles policies with optimization
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Recreate verified_scans policies with optimization
CREATE POLICY "Users can view own scans"
  ON verified_scans FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own scans"
  ON verified_scans FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own scans"
  ON verified_scans FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own scans"
  ON verified_scans FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Recreate verified_entries policies with optimization
CREATE POLICY "Users can view own entries"
  ON verified_entries FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own entries"
  ON verified_entries FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own entries"
  ON verified_entries FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own entries"
  ON verified_entries FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Recreate credit_transactions policies with optimization
CREATE POLICY "Users can view own transactions"
  ON credit_transactions FOR SELECT
  USING ((select auth.uid()) = user_id);

-- Recreate aircraft_profiles policies with optimization
CREATE POLICY "Users can view own aircraft profiles"
  ON aircraft_profiles FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own aircraft profiles"
  ON aircraft_profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own aircraft profiles"
  ON aircraft_profiles FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own aircraft profiles"
  ON aircraft_profiles FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Recreate reviews policies with optimization and consolidation
-- Combined SELECT policy: Anyone can view approved reviews, OR users can view their own unapproved reviews
CREATE POLICY "View approved or own reviews"
  ON reviews FOR SELECT
  USING (
    approved = true 
    OR (select auth.uid()) = user_id
  );

-- Authenticated users can insert their own reviews
CREATE POLICY "Authenticated users can submit reviews"
  ON reviews FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id OR user_id IS NULL);
