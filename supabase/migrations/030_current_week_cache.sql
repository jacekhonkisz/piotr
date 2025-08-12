-- Create current_week_cache table for 3-hour weekly caching strategy
CREATE TABLE current_week_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL, -- Format: "2025-W33" (ISO week format)
  cache_data JSONB NOT NULL, -- Cached weekly report data
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique cache per client per week
  UNIQUE(client_id, period_id)
);

-- Index for fast lookups
CREATE INDEX idx_current_week_cache_client_period ON current_week_cache(client_id, period_id);
CREATE INDEX idx_current_week_cache_last_updated ON current_week_cache(last_updated);

-- RLS policies
ALTER TABLE current_week_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access cache for clients they have access to
CREATE POLICY "Users can access weekly cache for their clients" ON current_week_cache
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = current_week_cache.client_id
      AND (
        -- Admin can access all
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR
        -- Client can access their own
        c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Auto-cleanup old weekly cache entries (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_weekly_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM current_week_cache 
  WHERE last_updated < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Note: Cleanup function created, but scheduled execution would need to be set up via cron or other scheduling system 