-- Manual application of Google Ads migrations
-- This script applies the missing Google Ads tables and cache structures

-- 1. Create google_ads_tables_data table
CREATE TABLE IF NOT EXISTS google_ads_tables_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Network performance (equivalent to Meta's placement performance)
  network_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Demographic performance (exact equivalent to Meta's demographic performance)
  demographic_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Quality score metrics (equivalent to Meta's ad relevance results)
  quality_score_metrics JSONB DEFAULT '[]'::jsonb,
  
  -- Device performance (equivalent to Meta's device performance)
  device_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Keyword performance (Google Ads specific)
  keyword_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(client_id, date_range_start, date_range_end)
);

-- Create indexes for google_ads_tables_data
CREATE INDEX IF NOT EXISTS idx_google_ads_tables_data_client_id ON google_ads_tables_data(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_tables_data_date_range ON google_ads_tables_data(date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_google_ads_tables_data_created_at ON google_ads_tables_data(created_at);

-- Enable RLS for google_ads_tables_data
ALTER TABLE google_ads_tables_data ENABLE ROW LEVEL SECURITY;

-- RLS Policy for google_ads_tables_data
DROP POLICY IF EXISTS "Users can access google_ads_tables_data for their clients" ON google_ads_tables_data;
CREATE POLICY "Users can access google_ads_tables_data for their clients" ON google_ads_tables_data
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = google_ads_tables_data.client_id
      AND (
        -- Admin can access all
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR
        -- Client can access their own
        c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Grant permissions for google_ads_tables_data
GRANT ALL ON google_ads_tables_data TO authenticated;
GRANT ALL ON google_ads_tables_data TO service_role;

-- 2. Create google_ads_current_month_cache table
CREATE TABLE IF NOT EXISTS google_ads_current_month_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL, -- Format: "2025-09"
  cache_data JSONB NOT NULL, -- Cached Google Ads report data
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique cache per client per period
  UNIQUE(client_id, period_id)
);

-- 3. Create google_ads_current_week_cache table
CREATE TABLE IF NOT EXISTS google_ads_current_week_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL, -- Format: "2025-W36" (ISO week format)
  cache_data JSONB NOT NULL, -- Cached Google Ads weekly report data
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique cache per client per week
  UNIQUE(client_id, period_id)
);

-- 4. Create indexes for cache tables
CREATE INDEX IF NOT EXISTS idx_google_ads_current_month_cache_client_period ON google_ads_current_month_cache(client_id, period_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_current_month_cache_last_updated ON google_ads_current_month_cache(last_updated);

CREATE INDEX IF NOT EXISTS idx_google_ads_current_week_cache_client_period ON google_ads_current_week_cache(client_id, period_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_current_week_cache_last_updated ON google_ads_current_week_cache(last_updated);

-- 5. Enable RLS policies for cache tables
ALTER TABLE google_ads_current_month_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_current_week_cache ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for monthly cache
DROP POLICY IF EXISTS "Users can access Google Ads monthly cache for their clients" ON google_ads_current_month_cache;
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

-- 7. RLS Policies for weekly cache
DROP POLICY IF EXISTS "Users can access Google Ads weekly cache for their clients" ON google_ads_current_week_cache;
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

-- 8. Auto-cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_google_ads_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM google_ads_current_month_cache 
  WHERE last_updated < NOW() - INTERVAL '7 days';
  
  DELETE FROM google_ads_current_week_cache 
  WHERE last_updated < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 9. Grant permissions for cache tables
GRANT ALL ON google_ads_current_month_cache TO authenticated;
GRANT ALL ON google_ads_current_month_cache TO service_role;
GRANT ALL ON google_ads_current_week_cache TO authenticated;
GRANT ALL ON google_ads_current_week_cache TO service_role;

-- 10. Add table comments for documentation
COMMENT ON TABLE google_ads_tables_data IS 'Google Ads performance tables data (network, demographic, quality, device, keyword)';
COMMENT ON TABLE google_ads_current_month_cache IS 'Smart cache for Google Ads monthly data with 3-hour TTL';
COMMENT ON TABLE google_ads_current_week_cache IS 'Smart cache for Google Ads weekly data with 3-hour TTL';

-- Verification queries
SELECT 'google_ads_tables_data table created' as status;
SELECT 'google_ads_current_month_cache table created' as status;
SELECT 'google_ads_current_week_cache table created' as status;

