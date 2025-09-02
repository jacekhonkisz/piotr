-- Create Google Ads smart caching tables (mirroring Meta ads caching system)
-- This implements the same 3-hour caching strategy for Google Ads

-- 1. Create google_ads_current_month_cache table
CREATE TABLE google_ads_current_month_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL, -- Format: "2025-08"
  cache_data JSONB NOT NULL, -- Cached Google Ads report data
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique cache per client per period
  UNIQUE(client_id, period_id)
);

-- 2. Create google_ads_current_week_cache table
CREATE TABLE google_ads_current_week_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL, -- Format: "2025-W33" (ISO week format)
  cache_data JSONB NOT NULL, -- Cached Google Ads weekly report data
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique cache per client per week
  UNIQUE(client_id, period_id)
);

-- 3. Create indexes for fast lookups (matching Meta cache structure)
CREATE INDEX idx_google_ads_current_month_cache_client_period ON google_ads_current_month_cache(client_id, period_id);
CREATE INDEX idx_google_ads_current_month_cache_last_updated ON google_ads_current_month_cache(last_updated);

CREATE INDEX idx_google_ads_current_week_cache_client_period ON google_ads_current_week_cache(client_id, period_id);
CREATE INDEX idx_google_ads_current_week_cache_last_updated ON google_ads_current_week_cache(last_updated);

-- 4. Enable RLS policies (matching Meta cache security)
ALTER TABLE google_ads_current_month_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_current_week_cache ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for monthly cache
CREATE POLICY "Users can access Google Ads monthly cache for their clients" ON google_ads_current_month_cache
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = google_ads_current_month_cache.client_id
      AND (
        -- Admin can access all
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR
        -- Client can access their own
        c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- 6. RLS Policies for weekly cache
CREATE POLICY "Users can access Google Ads weekly cache for their clients" ON google_ads_current_week_cache
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = google_ads_current_week_cache.client_id
      AND (
        -- Admin can access all
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR
        -- Client can access their own
        c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- 7. Auto-cleanup functions (matching Meta cache cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_google_ads_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM google_ads_current_month_cache 
  WHERE last_updated < NOW() - INTERVAL '7 days';
  
  DELETE FROM google_ads_current_week_cache 
  WHERE last_updated < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 8. Grant permissions
GRANT ALL ON google_ads_current_month_cache TO authenticated;
GRANT ALL ON google_ads_current_month_cache TO service_role;
GRANT ALL ON google_ads_current_week_cache TO authenticated;
GRANT ALL ON google_ads_current_week_cache TO service_role;

-- 9. Add table comments for documentation
COMMENT ON TABLE google_ads_current_month_cache IS 'Smart cache for Google Ads monthly data with 3-hour TTL';
COMMENT ON TABLE google_ads_current_week_cache IS 'Smart cache for Google Ads weekly data with 3-hour TTL';
