-- LogExtract Database Schema
-- Run this SQL in your Supabase SQL Editor after creating your project

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER DEFAULT 3 NOT NULL, -- Starting credits for new users
  plan_type TEXT DEFAULT 'free' NOT NULL, -- 'free', 'basic', 'premium'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verified scans (stores metadata about verified logbook pages)
CREATE TABLE IF NOT EXISTS verified_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER,
  mode TEXT NOT NULL, -- 'single' or 'spread'
  status TEXT DEFAULT 'verified' NOT NULL, -- 'verified', 'archived'
  timestamp BIGINT, -- Original scan timestamp
  image_rotations INTEGER[], -- Rotation in degrees for each image
  expected_entries INTEGER, -- Expected count hint
  clarity_score INTEGER, -- 0-100 score
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verified logbook entries (extracted data from verified scans)
CREATE TABLE IF NOT EXISTS verified_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scan_id UUID REFERENCES verified_scans(id) ON DELETE CASCADE NOT NULL,
  
  -- Entry data
  date DATE,
  aircraft_id TEXT,
  aircraft_type TEXT,
  from_location TEXT,
  to_location TEXT,
  route TEXT,
  total_time DECIMAL(4,1),
  day DECIMAL(4,1),
  night DECIMAL(4,1),
  cross_country TEXT,
  pic TEXT,
  sic TEXT,
  dual_received TEXT,
  dual_given TEXT,
  instrument TEXT,
  simulated_instrument TEXT,
  approaches TEXT,
  landings_day TEXT,
  landings_night TEXT,
  comments TEXT,
  
  -- Metadata
  is_verified BOOLEAN DEFAULT true,
  ai_confidence TEXT, -- 'high', 'low'
  reconciliation_confidence TEXT, -- 'high', 'low'
  uncertain_fields TEXT[], -- Array of field names that were flagged
  row_anchor TEXT, -- Physical line number from the page
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit transactions (audit trail for all credit changes)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL, -- positive for grants/purchases, negative for usage
  type TEXT NOT NULL, -- 'purchase', 'scan_usage', 'manual_grant', 'bonus', 'refund'
  scan_id UUID REFERENCES verified_scans(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_verified_scans_user_id ON verified_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_verified_scans_created_at ON verified_scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verified_entries_user_id ON verified_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_verified_entries_scan_id ON verified_entries(scan_id);
CREATE INDEX IF NOT EXISTS idx_verified_entries_date ON verified_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- Row Level Security (RLS) - Enable for all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/modify their own data

-- User profiles policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Verified scans policies
CREATE POLICY "Users can view own scans"
  ON verified_scans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans"
  ON verified_scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scans"
  ON verified_scans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scans"
  ON verified_scans FOR DELETE
  USING (auth.uid() = user_id);

-- Verified entries policies
CREATE POLICY "Users can view own entries"
  ON verified_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON verified_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON verified_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON verified_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Credit transactions policies (users can view their own transactions)
CREATE POLICY "Users can view own transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Note: Credit transactions are INSERTED by the backend (not by users directly)
-- The backend uses service role key, which bypasses RLS

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, credits, plan_type)
  VALUES (NEW.id, 3, 'free'); -- Default: 3 credits for new users
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_verified_scans_updated_at ON verified_scans;
CREATE TRIGGER update_verified_scans_updated_at
  BEFORE UPDATE ON verified_scans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_verified_entries_updated_at ON verified_entries;
CREATE TRIGGER update_verified_entries_updated_at
  BEFORE UPDATE ON verified_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
