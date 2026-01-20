-- Migration: Add solo, ground_received, and ground_given fields to verified_entries
-- Also creates aircraft_profiles table if it doesn't exist
-- Run this in your Supabase SQL Editor

-- Add new columns to verified_entries table
ALTER TABLE verified_entries 
ADD COLUMN IF NOT EXISTS solo TEXT,
ADD COLUMN IF NOT EXISTS ground_received TEXT,
ADD COLUMN IF NOT EXISTS ground_given TEXT;

-- Create aircraft_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS aircraft_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  aircraft_id TEXT NOT NULL, -- Tail number/registration (e.g., "N123AB")
  equipment_type TEXT, -- Full equipment description
  type_code TEXT, -- ICAO type code (e.g., "C172", "SR22")
  year TEXT, -- Year (YYYY format)
  make TEXT, -- Manufacturer (e.g., "Cessna")
  model TEXT, -- Model name (e.g., "172S")
  gear_type TEXT, -- "Fixed", "Retractable", etc.
  engine_type TEXT, -- "Single", "Twin", "Turbo", etc.
  category_class TEXT, -- "Airplane/Single Engine Land", etc.
  complex BOOLEAN DEFAULT false,
  high_performance BOOLEAN DEFAULT false,
  pressurized BOOLEAN DEFAULT false,
  taa BOOLEAN DEFAULT false, -- Technically Advanced Aircraft
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, aircraft_id) -- One profile per aircraft per user
);

-- Create indexes for aircraft_profiles
CREATE INDEX IF NOT EXISTS idx_aircraft_profiles_user_id ON aircraft_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_profiles_aircraft_id ON aircraft_profiles(aircraft_id);

-- Enable RLS on aircraft_profiles
ALTER TABLE aircraft_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for aircraft_profiles
CREATE POLICY "Users can view own aircraft profiles"
  ON aircraft_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own aircraft profiles"
  ON aircraft_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own aircraft profiles"
  ON aircraft_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own aircraft profiles"
  ON aircraft_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at for aircraft_profiles
DROP TRIGGER IF EXISTS update_aircraft_profiles_updated_at ON aircraft_profiles;
CREATE TRIGGER update_aircraft_profiles_updated_at
  BEFORE UPDATE ON aircraft_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
