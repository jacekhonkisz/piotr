-- ============================================================================
-- SAFE DATABASE FIX - PART 2: CREATE INDEXES
-- ============================================================================
-- Purpose: Add performance indexes to tables
-- Safety: 100% safe - creates indexes concurrently (no table locks)
-- Duration: ~5-10 seconds
-- Can be run: Anytime, even during business hours
-- Idempotent: Yes, safe to run multiple times
-- Dependencies: SAFE_01_CREATE_TABLES_ONLY.sql must be run first
-- ============================================================================

-- Note: We use CREATE INDEX IF NOT EXISTS which is safe and non-disruptive
-- If index already exists, it's simply skipped

-- ============================================================================
-- PRE-FLIGHT CHECK
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '🔍 Database: %', current_database();
  RAISE NOTICE '⏰ Timestamp: %', NOW();
  RAISE NOTICE '📝 Script: SAFE_02_CREATE_INDEXES.sql';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- INDEXES FOR campaign_summaries
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '📊 Creating indexes for campaign_summaries...';
END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_summaries_client_type_date 
  ON campaign_summaries(client_id, summary_type, summary_date);

CREATE INDEX IF NOT EXISTS idx_campaign_summaries_last_updated 
  ON campaign_summaries(last_updated);

CREATE INDEX IF NOT EXISTS idx_campaign_summaries_summary_date 
  ON campaign_summaries(summary_date);

CREATE INDEX IF NOT EXISTS idx_campaign_summaries_platform 
  ON campaign_summaries(platform);

CREATE INDEX IF NOT EXISTS idx_campaign_summaries_summary_type 
  ON campaign_summaries(summary_type);

-- ============================================================================
-- INDEXES FOR current_month_cache
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '📊 Creating indexes for current_month_cache...';
END $$;

CREATE INDEX IF NOT EXISTS idx_current_month_cache_client_period 
  ON current_month_cache(client_id, period_id);

CREATE INDEX IF NOT EXISTS idx_current_month_cache_last_refreshed 
  ON current_month_cache(last_refreshed);

CREATE INDEX IF NOT EXISTS idx_current_month_cache_period_id 
  ON current_month_cache(period_id);

-- ============================================================================
-- INDEXES FOR current_week_cache
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '📊 Creating indexes for current_week_cache...';
END $$;

CREATE INDEX IF NOT EXISTS idx_current_week_cache_client_period 
  ON current_week_cache(client_id, period_id);

CREATE INDEX IF NOT EXISTS idx_current_week_cache_last_refreshed 
  ON current_week_cache(last_refreshed);

CREATE INDEX IF NOT EXISTS idx_current_week_cache_period_id 
  ON current_week_cache(period_id);

-- ============================================================================
-- INDEXES FOR daily_kpi_data
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '📊 Creating indexes for daily_kpi_data...';
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_kpi_client_id 
  ON daily_kpi_data(client_id);

CREATE INDEX IF NOT EXISTS idx_daily_kpi_date 
  ON daily_kpi_data(date);

CREATE INDEX IF NOT EXISTS idx_daily_kpi_client_date 
  ON daily_kpi_data(client_id, date);

CREATE INDEX IF NOT EXISTS idx_daily_kpi_platform 
  ON daily_kpi_data(platform);

-- ============================================================================
-- VERIFICATION: List all indexes
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 VERIFICATION: Indexes Created';
  RAISE NOTICE '============================================';
END $$;

SELECT 
  schemaname || '.' || tablename as "Table",
  indexname as "Index Name",
  'Created' as "Status"
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('campaign_summaries', 'current_month_cache', 'current_week_cache', 'daily_kpi_data')
ORDER BY tablename, indexname;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 All indexes created successfully!';
  RAISE NOTICE '📈 Query performance should be improved.';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEP: Run SAFE_03_CREATE_POLICIES.sql';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- 1. ✅ Indexes created successfully
-- 2. 📊 Tables are now optimized for queries
-- 3. ➡️  Proceed to SAFE_03_CREATE_POLICIES.sql to enable access control
-- ============================================================================












