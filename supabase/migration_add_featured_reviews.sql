-- Migration: Add featured column to reviews table
-- Allows admins to manually select which reviews appear in the Featured Reviews section
-- Run this in your Supabase SQL Editor

ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN reviews.featured IS 'If true, this review appears in the Featured Reviews section';

CREATE INDEX IF NOT EXISTS idx_reviews_featured ON reviews(featured) WHERE featured = true;
