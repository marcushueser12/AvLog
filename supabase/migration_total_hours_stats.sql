-- Function for landing page total hours counter (efficient single aggregate query)
-- Called via RPC, no RLS needed (returns aggregate only, no user data)
CREATE OR REPLACE FUNCTION get_total_hours_estimate()
RETURNS double precision
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(total_time)::double precision, 0)
  FROM verified_entries
  WHERE total_time IS NOT NULL;
$$;
