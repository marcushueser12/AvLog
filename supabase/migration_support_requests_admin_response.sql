-- Add admin_response column for user-facing responses (admin_notes stays for internal use)
ALTER TABLE support_requests 
ADD COLUMN IF NOT EXISTS admin_response TEXT;

COMMENT ON COLUMN support_requests.admin_response IS 'Admin response visible to the user';
COMMENT ON COLUMN support_requests.admin_notes IS 'Internal notes (admin only, not shown to user)';
