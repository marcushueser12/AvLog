-- Total hours scanned across all verified entries
-- Run this in Supabase SQL Editor to get the exact total

SELECT
  COALESCE(SUM(total_time::numeric), 0) AS total_hours,
  COUNT(*) AS entry_count
FROM verified_entries;
