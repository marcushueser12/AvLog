-- Total flight hours for one user (sum of total_time on all verified entries)
-- Replace the UUID with the user's id from auth.users / user_profiles / Dashboard → Authentication.

SELECT
  user_id,
  COALESCE(SUM(total_time::numeric), 0) AS total_hours,
  COUNT(*) AS entry_count
FROM verified_entries
WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid
GROUP BY user_id;

-- Optional: include email from auth (run as service role or in SQL Editor; requires access to auth.users)

-- SELECT
--   u.email,
--   ve.user_id,
--   COALESCE(SUM(ve.total_time::numeric), 0) AS total_hours,
--   COUNT(*) AS entry_count
-- FROM verified_entries ve
-- JOIN auth.users u ON u.id = ve.user_id
-- WHERE ve.user_id = '00000000-0000-0000-0000-000000000000'::uuid
-- GROUP BY ve.user_id, u.email;
