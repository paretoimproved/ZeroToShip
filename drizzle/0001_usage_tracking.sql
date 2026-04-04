-- Migration: Add usage tracking table for Enterprise rate limiting
-- Date: 2026-02-01
-- Purpose: Track daily usage of AI generation features to prevent abuse

CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  fresh_briefs_used INTEGER NOT NULL DEFAULT 0,
  validation_requests_used INTEGER NOT NULL DEFAULT 0,
  overage_briefs INTEGER NOT NULL DEFAULT 0,
  overage_amount_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT usage_user_date_unique UNIQUE(user_id, date)
);

-- Index for efficient lookups by user and date
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON usage_tracking(user_id, date);

-- Add RLS policy for usage_tracking
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can only view their own usage records
CREATE POLICY "Users can view own usage" ON usage_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own usage records
CREATE POLICY "Users can insert own usage" ON usage_tracking
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage records
CREATE POLICY "Users can update own usage" ON usage_tracking
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role bypass for server-side operations
CREATE POLICY "Service role full access" ON usage_tracking
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comment on table
COMMENT ON TABLE usage_tracking IS 'Daily usage tracking for AI generation limits per user';
COMMENT ON COLUMN usage_tracking.fresh_briefs_used IS 'Number of fresh AI-generated briefs used today';
COMMENT ON COLUMN usage_tracking.validation_requests_used IS 'Number of deep-dive validations used today';
COMMENT ON COLUMN usage_tracking.overage_briefs IS 'Number of briefs used beyond daily limit (Enterprise only)';
COMMENT ON COLUMN usage_tracking.overage_amount_cents IS 'Total overage charges in cents for this day';
