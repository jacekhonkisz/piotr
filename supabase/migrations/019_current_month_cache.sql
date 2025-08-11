-- Create current_month_cache table for 3-hour caching strategy
CREATE TABLE current_month_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL, -- Format: "2025-08"
  cache_data JSONB NOT NULL, -- Cached report data
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique cache per client per period
  UNIQUE(client_id, period_id)
);

-- Index for fast lookups
CREATE INDEX idx_current_month_cache_client_period ON current_month_cache(client_id, period_id);
CREATE INDEX idx_current_month_cache_last_updated ON current_month_cache(last_updated);

-- RLS policies
ALTER TABLE current_month_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access cache for clients they have access to
CREATE POLICY "Users can access cache for their clients" ON current_month_cache
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = current_month_cache.client_id
      AND (
        -- Admin can access all
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR
        -- Client can access their own
        c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Auto-cleanup old cache entries (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM current_month_cache 
  WHERE last_updated < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Note: Cleanup function created, but scheduled execution would need to be set up via cron or other scheduling system 