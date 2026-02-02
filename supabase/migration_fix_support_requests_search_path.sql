-- Migration: Fix function_search_path_mutable security warning
-- Adds SET search_path to update_support_requests_updated_at function
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION update_support_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
