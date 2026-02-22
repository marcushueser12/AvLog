/*
  RLS Performance: support_requests and cloud_uploads
  Fixes auth_rls_initplan by using (select auth.uid()) so auth is evaluated once per query.
  See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
*/

-- support_requests: drop and recreate policies
DROP POLICY IF EXISTS "Users can insert their own support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Users can view their own support requests" ON public.support_requests;

CREATE POLICY "Users can insert their own support requests"
  ON public.support_requests
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own support requests"
  ON public.support_requests
  FOR SELECT
  USING ((select auth.uid()) = user_id);

-- cloud_uploads: drop and recreate policies
DROP POLICY IF EXISTS "Users can insert own cloud_uploads" ON public.cloud_uploads;
DROP POLICY IF EXISTS "Users can select own cloud_uploads" ON public.cloud_uploads;
DROP POLICY IF EXISTS "Users can update own cloud_uploads" ON public.cloud_uploads;
DROP POLICY IF EXISTS "Users can delete own cloud_uploads" ON public.cloud_uploads;

CREATE POLICY "Users can insert own cloud_uploads"
  ON public.cloud_uploads FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can select own cloud_uploads"
  ON public.cloud_uploads FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own cloud_uploads"
  ON public.cloud_uploads FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own cloud_uploads"
  ON public.cloud_uploads FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
