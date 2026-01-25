-- Reviews Table for LogExtract
-- Run this SQL in your Supabase SQL Editor

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable for anonymous reviews
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT, -- Optional, for follow-up if needed
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  approved BOOLEAN DEFAULT false NOT NULL, -- Admin must approve before showing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(approved) WHERE approved = true;
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view approved reviews
CREATE POLICY "Anyone can view approved reviews"
  ON reviews FOR SELECT
  USING (approved = true);

-- Authenticated users can insert their own reviews
CREATE POLICY "Authenticated users can submit reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own unapproved reviews
CREATE POLICY "Users can view own reviews"
  ON reviews FOR SELECT
  USING (auth.uid() = user_id);

-- Admin can view and update all reviews (using service role key)
-- Note: Admin operations should use service role key which bypasses RLS
-- For admin UI, you'll need to create a function that uses SECURITY DEFINER

-- Function for admins to approve/reject reviews
CREATE OR REPLACE FUNCTION approve_review(review_id UUID, approve_status BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE reviews
  SET approved = approve_status,
      updated_at = NOW()
  WHERE id = review_id;
END;
$$;

-- Function to get all reviews (including unapproved) for admin
CREATE OR REPLACE FUNCTION get_all_reviews()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  reviewer_name TEXT,
  reviewer_email TEXT,
  rating INTEGER,
  review_text TEXT,
  approved BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.reviewer_name, r.reviewer_email, r.rating, 
         r.review_text, r.approved, r.created_at, r.updated_at
  FROM reviews r
  ORDER BY r.created_at DESC;
END;
$$;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
