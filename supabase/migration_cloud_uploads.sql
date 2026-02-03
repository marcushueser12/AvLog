-- Cloud uploads: mobile capture → desktop review
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Table: cloud_uploads
CREATE TABLE IF NOT EXISTS public.cloud_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  upload_group_id UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_uploads_user_id ON public.cloud_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_uploads_status ON public.cloud_uploads(status);
CREATE INDEX IF NOT EXISTS idx_cloud_uploads_created_at ON public.cloud_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_uploads_upload_group_id ON public.cloud_uploads(upload_group_id) WHERE upload_group_id IS NOT NULL;

COMMENT ON TABLE public.cloud_uploads IS 'Logbook scan images uploaded from mobile for desktop extraction';
COMMENT ON COLUMN public.cloud_uploads.upload_group_id IS 'When set, rows with the same id form a spread pair for import on desktop.';

-- 2. RLS
ALTER TABLE public.cloud_uploads ENABLE ROW LEVEL SECURITY;

-- Users can only INSERT their own rows
CREATE POLICY "Users can insert own cloud_uploads"
  ON public.cloud_uploads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only SELECT their own rows
CREATE POLICY "Users can select own cloud_uploads"
  ON public.cloud_uploads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can only UPDATE their own rows (for marking processed)
CREATE POLICY "Users can update own cloud_uploads"
  ON public.cloud_uploads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only DELETE their own rows (remove from cloud)
CREATE POLICY "Users can delete own cloud_uploads"
  ON public.cloud_uploads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Storage bucket: logbook_scans
-- Create bucket via Dashboard: Storage → New bucket → name: logbook_scans, Public: OFF
-- Or via SQL (Supabase creates bucket):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logbook_scans',
  'logbook_scans',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS: users can access only their folder (auth.uid()/*)
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logbook_scans'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own folder"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'logbook_scans'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logbook_scans'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Realtime: enable for cloud_uploads so desktop can subscribe to new uploads.
-- In Supabase Dashboard: Database → Replication → add "cloud_uploads" to supabase_realtime.
-- Or run (may require superuser): ALTER PUBLICATION supabase_realtime ADD TABLE public.cloud_uploads;
