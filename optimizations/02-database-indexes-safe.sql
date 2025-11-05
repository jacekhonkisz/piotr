-- ============================================
-- SAFE DATABASE INDEXES
-- ============================================
-- Only creates indexes if the table exists
-- Uses IF EXISTS checks to prevent errors
-- ============================================

DO $$ 
BEGIN

-- ============================================
-- SMART CACHE INDEXES
-- ============================================

-- Current month cache
IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'current_month_cache') THEN
  CREATE INDEX IF NOT EXISTS idx_current_month_cache_client_period
    ON current_month_cache(client_id, period_id);
  
  CREATE INDEX IF NOT EXISTS idx_current_month_cache_last_updated
    ON current_month_cache(last_updated DESC);
    
  RAISE NOTICE '✅ Created indexes for current_month_cache';
END IF;

-- Current week cache
IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'current_week_cache') THEN
  CREATE INDEX IF NOT EXISTS idx_current_week_cache_client_period
    ON current_week_cache(client_id, period_id);
  
  CREATE INDEX IF NOT EXISTS idx_current_week_cache_last_updated
    ON current_week_cache(last_updated DESC);
    
  RAISE NOTICE '✅ Created indexes for current_week_cache';
END IF;

-- Google Ads cache
IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'google_ads_current_month_cache') THEN
  CREATE INDEX IF NOT EXISTS idx_google_ads_cache_client_period
    ON google_ads_current_month_cache(client_id, period_id);
  
  CREATE INDEX IF NOT EXISTS idx_google_ads_cache_last_updated
    ON google_ads_current_month_cache(last_updated DESC);
    
  RAISE NOTICE '✅ Created indexes for google_ads_current_month_cache';
END IF;

-- ============================================
-- CAMPAIGN SUMMARIES INDEXES
-- ============================================

IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaign_summaries') THEN
  -- Main lookup: client + platform + type + date
  CREATE INDEX IF NOT EXISTS idx_campaign_summaries_lookup
    ON campaign_summaries(client_id, summary_type, summary_date DESC);
  
  -- Weekly summaries
  CREATE INDEX IF NOT EXISTS idx_campaign_summaries_weekly
    ON campaign_summaries(client_id, summary_date DESC)
    WHERE summary_type = 'weekly';
  
  -- Monthly summaries
  CREATE INDEX IF NOT EXISTS idx_campaign_summaries_monthly
    ON campaign_summaries(client_id, summary_date DESC)
    WHERE summary_type = 'monthly';
  
  -- Date index
  CREATE INDEX IF NOT EXISTS idx_campaign_summaries_date
    ON campaign_summaries(summary_date DESC);
    
  -- Platform index (if column exists)
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'campaign_summaries' AND column_name = 'platform'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_campaign_summaries_platform
      ON campaign_summaries(client_id, platform, summary_date DESC);
  END IF;
  
  RAISE NOTICE '✅ Created indexes for campaign_summaries';
END IF;

-- ============================================
-- DAILY KPI DATA INDEXES
-- ============================================

IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_kpi_data') THEN
  -- Primary lookup
  CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_client_date
    ON daily_kpi_data(client_id, date DESC);
  
  -- Data source lookup
  CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_source
    ON daily_kpi_data(client_id, data_source, date DESC);
  
  -- Date index
  CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_date
    ON daily_kpi_data(date DESC);
  
  RAISE NOTICE '✅ Created indexes for daily_kpi_data';
END IF;

-- ============================================
-- CAMPAIGNS TABLE INDEXES
-- ============================================

IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns') THEN
  -- Date range lookup
  CREATE INDEX IF NOT EXISTS idx_campaigns_client_date
    ON campaigns(client_id, date_range_start DESC, date_range_end DESC);
  
  -- Campaign ID lookup
  CREATE INDEX IF NOT EXISTS idx_campaigns_client_campaign_id
    ON campaigns(client_id, campaign_id, date_range_start DESC);
  
  RAISE NOTICE '✅ Created indexes for campaigns';
END IF;

-- ============================================
-- GOOGLE ADS CAMPAIGNS TABLE INDEXES
-- ============================================

IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'google_ads_campaigns') THEN
  -- Date range lookup
  CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client_date
    ON google_ads_campaigns(client_id, date_range_start DESC, date_range_end DESC);
  
  -- Campaign ID lookup
  CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client_campaign_id
    ON google_ads_campaigns(client_id, campaign_id);
  
  RAISE NOTICE '✅ Created indexes for google_ads_campaigns';
END IF;

-- ============================================
-- REPORTS TABLE INDEXES
-- ============================================

IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reports') THEN
  -- Duplicate checking
  CREATE INDEX IF NOT EXISTS idx_reports_duplicate_check
    ON reports(client_id, date_range_start, date_range_end);
  
  -- Recent reports
  CREATE INDEX IF NOT EXISTS idx_reports_client_generated
    ON reports(client_id, generated_at DESC);
  
  -- Date range lookup
  CREATE INDEX IF NOT EXISTS idx_reports_date_range
    ON reports(date_range_start DESC, date_range_end DESC);
  
  RAISE NOTICE '✅ Created indexes for reports';
END IF;

-- ============================================
-- GENERATED REPORTS INDEXES (optional table)
-- ============================================

IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'generated_reports') THEN
  -- Main lookup
  CREATE INDEX IF NOT EXISTS idx_generated_reports_client_period
    ON generated_reports(client_id, period_start, period_end, report_type);
  
  -- Status filtering
  CREATE INDEX IF NOT EXISTS idx_generated_reports_status
    ON generated_reports(client_id, status, generated_at DESC);
  
  -- Type filtering
  CREATE INDEX IF NOT EXISTS idx_generated_reports_type
    ON generated_reports(client_id, report_type, generated_at DESC);
  
  RAISE NOTICE '✅ Created indexes for generated_reports';
ELSE
  RAISE NOTICE '⏭️  Skipping generated_reports (table does not exist)';
END IF;

-- ============================================
-- CLIENTS TABLE INDEXES
-- ============================================

IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clients') THEN
  -- Email lookup
  CREATE INDEX IF NOT EXISTS idx_clients_email
    ON clients(email)
    WHERE email IS NOT NULL;
  
  -- Name lookup
  CREATE INDEX IF NOT EXISTS idx_clients_name
    ON clients(name);
  
  RAISE NOTICE '✅ Created indexes for clients';
END IF;

-- ============================================
-- PROFILES TABLE INDEXES
-- ============================================

IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
  -- Email lookup
  CREATE INDEX IF NOT EXISTS idx_profiles_email
    ON profiles(email)
    WHERE email IS NOT NULL;
  
  RAISE NOTICE '✅ Created indexes for profiles';
END IF;

END $$;

-- ============================================
-- ANALYZE TABLES (only if they exist)
-- ============================================

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'current_month_cache') THEN
    EXECUTE 'ANALYZE current_month_cache';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'current_week_cache') THEN
    EXECUTE 'ANALYZE current_week_cache';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'google_ads_current_month_cache') THEN
    EXECUTE 'ANALYZE google_ads_current_month_cache';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaign_summaries') THEN
    EXECUTE 'ANALYZE campaign_summaries';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_kpi_data') THEN
    EXECUTE 'ANALYZE daily_kpi_data';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns') THEN
    EXECUTE 'ANALYZE campaigns';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'google_ads_campaigns') THEN
    EXECUTE 'ANALYZE google_ads_campaigns';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reports') THEN
    EXECUTE 'ANALYZE reports';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'generated_reports') THEN
    EXECUTE 'ANALYZE generated_reports';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clients') THEN
    EXECUTE 'ANALYZE clients';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
    EXECUTE 'ANALYZE profiles';
  END IF;
  
  RAISE NOTICE '✅ Analyzed all existing tables';
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show created indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Show total index size
SELECT 
  pg_size_pretty(SUM(pg_relation_size(indexname::regclass))) AS total_index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';

-- Show count
SELECT 
  COUNT(*) as total_indexes_created
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';

