-- Add MEL (Multi-Engine Land) time column to verified_entries
-- This stores multi-engine land time extracted from logbook pages
ALTER TABLE verified_entries ADD COLUMN IF NOT EXISTS mel TEXT;
