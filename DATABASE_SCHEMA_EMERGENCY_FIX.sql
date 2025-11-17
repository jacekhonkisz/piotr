-- ============================================================================
-- EMERGENCY DATABASE SCHEMA FIX
-- ============================================================================
-- Date: October 1, 2025
-- Issue: campaign_summaries table missing - reports system completely broken
-- Action: Create all missing critical tables for data persistence
-- ============================================================================

-- ============================================================================
-- 1. CAMPAIGN SUMMARIES TABLE (CRITICAL - MISSING!)
-- ============================================================================
-- This table stores historical monthly and weekly data for the last 13 months

CREATE TABLE IF NOT EXISTS campaign_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  summary_type TEXT CHECK (summary_type IN ('weekly', 'monthly')) NOT NULL,
  summary_date DATE NOT NULL, -- Start date of the period
  total_spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
  total_impressions BIGINT DEFAULT 0 NOT NULL,
  total_clicks BIGINT DEFAULT 0 NOT NULL,
  total_conversions BIGINT DEFAULT 0 NOT NULL,
  average_ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
  average_cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
  average_cpa DECIMAL(8,2) DEFAULT 0 NOT NULL,
  active_campaigns INTEGER DEFAULT 0 NOT NULL,
  total_campaigns INTEGER DEFAULT 0 NOT NULL,
  campaign_data JSONB, -- Detailed campaign breakdown
  meta_tables JSONB, -- Placement, demographic, ad relevance data
  data_source TEXT DEFAULT 'meta_api',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique summaries per client, type, and date
  UNIQUE(client_id, summary_type, summary_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_client_type_date ON campaign_summaries(client_id, summary_type, summary_date);
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_last_updated ON campaign_summaries(last_updated);
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_summary_date ON campaign_summaries(summary_date);

-- Add platform column (if not exists) for Meta/Google separation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_summaries' AND column_name = 'platform'
  ) THEN
    ALTER TABLE campaign_summaries ADD COLUMN platform TEXT DEFAULT 'meta' NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_campaign_summaries_platform ON campaign_summaries(platform);
  END IF;
END $$;

-- Add conversion metrics columns (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_summaries' AND column_name = 'click_to_call'
  ) THEN
    ALTER TABLE campaign_summaries ADD COLUMN click_to_call BIGINT DEFAULT 0;
    ALTER TABLE campaign_summaries ADD COLUMN email_contacts BIGINT DEFAULT 0;
    ALTER TABLE campaign_summaries ADD COLUMN booking_step_1 BIGINT DEFAULT 0;
    ALTER TABLE campaign_summaries ADD COLUMN reservations BIGINT DEFAULT 0;
    ALTER TABLE campaign_summaries ADD COLUMN reservation_value DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE campaign_summaries ADD COLUMN booking_step_2 BIGINT DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- 2. CURRENT MONTH CACHE TABLE (Check if exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS current_month_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL, -- Format: "2025-09"
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  cache_data JSONB NOT NULL,
  last_refreshed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(client_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_current_month_cache_client_period ON current_month_cache(client_id, period_id);
CREATE INDEX IF NOT EXISTS idx_current_month_cache_last_refreshed ON current_month_cache(last_refreshed);

-- Add platform column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'current_month_cache' AND column_name = 'platform'
  ) THEN
    ALTER TABLE current_month_cache ADD COLUMN platform TEXT DEFAULT 'meta' NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. CURRENT WEEK CACHE TABLE (Check if exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS current_week_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL, -- Format: "2025-W40"
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  cache_data JSONB NOT NULL,
  last_refreshed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(client_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_current_week_cache_client_period ON current_week_cache(client_id, period_id);
CREATE INDEX IF NOT EXISTS idx_current_week_cache_last_refreshed ON current_week_cache(last_refreshed);

-- Add platform column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'current_week_cache' AND column_name = 'platform'
  ) THEN
    ALTER TABLE current_week_cache ADD COLUMN platform TEXT DEFAULT 'meta' NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. DAILY KPI DATA TABLE (Check if exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_kpi_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  
  -- Core metrics
  total_clicks BIGINT DEFAULT 0 NOT NULL,
  total_impressions BIGINT DEFAULT 0 NOT NULL,
  total_spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
  total_conversions BIGINT DEFAULT 0 NOT NULL,
  
  -- Conversion metrics
  click_to_call BIGINT DEFAULT 0 NOT NULL,
  email_contacts BIGINT DEFAULT 0 NOT NULL,
  booking_step_1 BIGINT DEFAULT 0 NOT NULL,
  reservations BIGINT DEFAULT 0 NOT NULL,
  reservation_value DECIMAL(12,2) DEFAULT 0 NOT NULL,
  booking_step_2 BIGINT DEFAULT 0 NOT NULL,
  
  -- Calculated metrics
  average_ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
  average_cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
  roas DECIMAL(8,2) DEFAULT 0 NOT NULL,
  cost_per_reservation DECIMAL(8,2) DEFAULT 0 NOT NULL,
  
  -- Metadata
  data_source TEXT DEFAULT 'api' NOT NULL,
  campaigns_count INTEGER DEFAULT 0 NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(client_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_kpi_client_id ON daily_kpi_data(client_id);
CREATE INDEX IF NOT EXISTS idx_daily_kpi_date ON daily_kpi_data(date);
CREATE INDEX IF NOT EXISTS idx_daily_kpi_client_date ON daily_kpi_data(client_id, date);

-- Add platform column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_kpi_data' AND column_name = 'platform'
  ) THEN
    ALTER TABLE daily_kpi_data ADD COLUMN platform TEXT DEFAULT 'meta' NOT NULL;
    
    -- Update unique constraint to include platform
    ALTER TABLE daily_kpi_data DROP CONSTRAINT IF EXISTS daily_kpi_data_client_id_date_key;
    ALTER TABLE daily_kpi_data ADD CONSTRAINT daily_kpi_data_client_id_date_platform_key 
      UNIQUE(client_id, date, platform);
  END IF;
END $$;

-- Add reach column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_kpi_data' AND column_name = 'reach'
  ) THEN
    ALTER TABLE daily_kpi_data ADD COLUMN reach BIGINT DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- 5. RLS POLICIES FOR CAMPAIGN_SUMMARIES
-- ============================================================================
ALTER TABLE campaign_summaries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all campaign summaries" ON campaign_summaries;
DROP POLICY IF EXISTS "Admins can insert campaign summaries" ON campaign_summaries;
DROP POLICY IF EXISTS "Admins can update campaign summaries" ON campaign_summaries;
DROP POLICY IF EXISTS "Admins can delete campaign summaries" ON campaign_summaries;
DROP POLICY IF EXISTS "Clients can view their own campaign summaries" ON campaign_summaries;

-- Create RLS policies
CREATE POLICY "Admins can view all campaign summaries" ON campaign_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert campaign summaries" ON campaign_summaries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update campaign summaries" ON campaign_summaries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete campaign summaries" ON campaign_summaries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Clients can view their own campaign summaries" ON campaign_summaries
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE email = (
        SELECT email FROM auth.users 
        WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 6. RLS POLICIES FOR CACHE TABLES
-- ============================================================================

-- Current Month Cache
ALTER TABLE current_month_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can access all month cache" ON current_month_cache;
DROP POLICY IF EXISTS "Users can access cache for their clients" ON current_month_cache;

CREATE POLICY "Service role can access all month cache" ON current_month_cache
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can access cache for their clients" ON current_month_cache
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = current_month_cache.client_id
      AND (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Current Week Cache
ALTER TABLE current_week_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can access all week cache" ON current_week_cache;
DROP POLICY IF EXISTS "Users can access weekly cache for their clients" ON current_week_cache;

CREATE POLICY "Service role can access all week cache" ON current_week_cache
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can access weekly cache for their clients" ON current_week_cache
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = current_week_cache.client_id
      AND (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Daily KPI Data
ALTER TABLE daily_kpi_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all daily KPI data" ON daily_kpi_data;
DROP POLICY IF EXISTS "Admins can insert daily KPI data" ON daily_kpi_data;
DROP POLICY IF EXISTS "Admins can update daily KPI data" ON daily_kpi_data;
DROP POLICY IF EXISTS "Service role can access all daily KPI data" ON daily_kpi_data;

CREATE POLICY "Admins can view all daily KPI data" ON daily_kpi_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert daily KPI data" ON daily_kpi_data
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update daily KPI data" ON daily_kpi_data
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can access all daily KPI data" ON daily_kpi_data
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 7. UTILITY FUNCTIONS
-- ============================================================================

-- Function to clean up old campaign summaries (older than 13 months)
CREATE OR REPLACE FUNCTION cleanup_old_campaign_summaries()
RETURNS void AS $$
BEGIN
  DELETE FROM campaign_summaries 
  WHERE summary_date < CURRENT_DATE - INTERVAL '13 months';
  
  RAISE NOTICE 'Cleaned up old campaign summaries older than 13 months';
END;
$$ LANGUAGE plpgsql;

-- Function to get summary with fallback logic
CREATE OR REPLACE FUNCTION get_campaign_summary(
  p_client_id UUID,
  p_summary_type TEXT,
  p_summary_date DATE
)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  summary_type TEXT,
  summary_date DATE,
  total_spend DECIMAL(12,2),
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_conversions BIGINT,
  average_ctr DECIMAL(5,2),
  average_cpc DECIMAL(8,2),
  average_cpa DECIMAL(8,2),
  active_campaigns INTEGER,
  total_campaigns INTEGER,
  campaign_data JSONB,
  meta_tables JSONB,
  data_source TEXT,
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.client_id,
    cs.summary_type,
    cs.summary_date,
    cs.total_spend,
    cs.total_impressions,
    cs.total_clicks,
    cs.total_conversions,
    cs.average_ctr,
    cs.average_cpc,
    cs.average_cpa,
    cs.active_campaigns,
    cs.total_campaigns,
    cs.campaign_data,
    cs.meta_tables,
    cs.data_source,
    cs.last_updated,
    cs.created_at
  FROM campaign_summaries cs
  WHERE cs.client_id = p_client_id
    AND cs.summary_type = p_summary_type
    AND cs.summary_date = p_summary_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. VERIFICATION QUERIES
-- ============================================================================

-- Verify all critical tables exist
DO $$
DECLARE
  missing_tables TEXT := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_summaries') THEN
    missing_tables := missing_tables || 'campaign_summaries, ';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'current_month_cache') THEN
    missing_tables := missing_tables || 'current_month_cache, ';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'current_week_cache') THEN
    missing_tables := missing_tables || 'current_week_cache, ';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_kpi_data') THEN
    missing_tables := missing_tables || 'daily_kpi_data, ';
  END IF;
  
  IF missing_tables = '' THEN
    RAISE NOTICE '✅ All critical tables exist!';
  ELSE
    RAISE NOTICE '⚠️  Missing tables: %', TRIM(TRAILING ', ' FROM missing_tables);
  END IF;
END $$;

-- Show table counts
SELECT 
  'campaign_summaries' as table_name,
  COUNT(*) as row_count
FROM campaign_summaries
UNION ALL
SELECT 
  'current_month_cache',
  COUNT(*)
FROM current_month_cache
UNION ALL
SELECT 
  'current_week_cache',
  COUNT(*)
FROM current_week_cache
UNION ALL
SELECT 
  'daily_kpi_data',
  COUNT(*)
FROM daily_kpi_data;

-- ============================================================================
-- SCRIPT COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Verify tables were created successfully
-- 2. Run data backfill for September 2025
-- 3. Check cron jobs are configured properly
-- 4. Monitor archival process for October 1st (next month)
-- ============================================================================










