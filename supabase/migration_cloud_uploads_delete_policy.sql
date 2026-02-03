-- Allow users to delete their own cloud_uploads (manual remove from cloud).
-- Run in Supabase SQL Editor if cloud_uploads already exists.

CREATE POLICY "Users can delete own cloud_uploads"
  ON public.cloud_uploads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
