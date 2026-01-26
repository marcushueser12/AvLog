-- Migration: Add pilot_ratings column to reviews table
-- This allows pilots to include their certifications/ratings with their reviews
-- Run this in your Supabase SQL Editor

-- Add pilot_ratings column to reviews table
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS pilot_ratings TEXT;

-- Add comment to column
COMMENT ON COLUMN reviews.pilot_ratings IS 'Pilot certifications/ratings (e.g., "Instrument Pilot", "Commercial Pilot", "CFI")';
