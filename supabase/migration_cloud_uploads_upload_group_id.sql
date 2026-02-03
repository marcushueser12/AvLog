-- Add upload_group_id to cloud_uploads so spread pairs uploaded from mobile are grouped.
-- Run after migration_cloud_uploads.sql.

ALTER TABLE public.cloud_uploads
ADD COLUMN IF NOT EXISTS upload_group_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_cloud_uploads_upload_group_id
ON public.cloud_uploads(upload_group_id)
WHERE upload_group_id IS NOT NULL;

COMMENT ON COLUMN public.cloud_uploads.upload_group_id IS 'When set, rows with the same id form a spread pair for import on desktop.';
