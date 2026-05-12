-- Aggregate dashboard stats in the database (avoids PostgREST default ~1000 row limit on SELECT).

CREATE OR REPLACE FUNCTION public.safe_hours_numeric(val text)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
BEGIN
  IF val IS NULL OR btrim(val) = '' THEN
    RETURN 0;
  END IF;
  RETURN val::double precision;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_logbook_stats_for_user(p_user_id uuid)
RETURNS TABLE (
  total_time double precision,
  pic double precision,
  night double precision,
  instrument double precision,
  cross_country double precision,
  multi_engine bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(COALESCE(v.total_time, 0)::double precision), 0)::double precision,
    COALESCE(SUM(public.safe_hours_numeric(v.pic::text)), 0)::double precision,
    COALESCE(SUM(COALESCE(v.night, 0)::double precision), 0)::double precision,
    COALESCE(SUM(public.safe_hours_numeric(v.instrument::text)), 0)::double precision,
    COALESCE(SUM(public.safe_hours_numeric(v.cross_country::text)), 0)::double precision,
    COUNT(*) FILTER (
      WHERE lower(coalesce(v.aircraft_type, '')) LIKE '%multi%'
         OR lower(coalesce(v.aircraft_type, '')) LIKE '%twin%'
    )::bigint
  FROM public.verified_entries v
  WHERE v.user_id = p_user_id;
$$;

COMMENT ON FUNCTION public.get_logbook_stats_for_user(uuid) IS
  'Single-row aggregates for GET /api/verified/stats; no row-fetch limit.';

REVOKE ALL ON FUNCTION public.safe_hours_numeric(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_logbook_stats_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_hours_numeric(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_logbook_stats_for_user(uuid) TO service_role;
