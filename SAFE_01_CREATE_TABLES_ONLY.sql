-- ============================================================================
-- SAFE DATABASE FIX - PART 1: CREATE TABLES ONLY
-- ============================================================================
-- Purpose: Create missing tables WITHOUT touching existing data or policies
-- Safety: 100% safe - zero disruption to existing functionality
-- Duration: ~2-5 seconds
-- Can be run: Anytime, even during business hours
-- Idempotent: Yes, safe to run multiple times
-- ============================================================================

-- ============================================================================
-- PRE-FLIGHT CHECK: Verify we're in the right database
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '🔍 Database: %', current_database();
  RAISE NOTICE '🔍 User: %', current_user;
  RAISE NOTICE '⏰ Timestamp: %', NOW();
  RAISE NOTICE '📝 Script: SAFE_01_CREATE_TABLES_ONLY.sql';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- 1. CREATE campaign_summaries TABLE (if missing)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_summaries') THEN
    RAISE NOTICE '📊 Creating campaign_summaries table...';
    
    CREATE TABLE campaign_summaries (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
      summary_type TEXT CHECK (summary_type IN ('weekly', 'monthly')) NOT NULL,
      summary_date DATE NOT NULL,
      total_spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
      total_impressions BIGINT DEFAULT 0 NOT NULL,
      total_clicks BIGINT DEFAULT 0 NOT NULL,
      total_conversions BIGINT DEFAULT 0 NOT NULL,
      average_ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
      average_cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
      average_cpa DECIMAL(8,2) DEFAULT 0 NOT NULL,
      active_campaigns INTEGER DEFAULT 0 NOT NULL,
      total_campaigns INTEGER DEFAULT 0 NOT NULL,
      campaign_data JSONB,
      meta_tables JSONB,
      data_source TEXT DEFAULT 'meta_api',
      platform TEXT DEFAULT 'meta' NOT NULL,
      click_to_call BIGINT DEFAULT 0,
      email_contacts BIGINT DEFAULT 0,
      booking_step_1 BIGINT DEFAULT 0,
      reservations BIGINT DEFAULT 0,
      reservation_value DECIMAL(12,2) DEFAULT 0,
      booking_step_2 BIGINT DEFAULT 0,
      last_updated TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      
      UNIQUE(client_id, summary_type, summary_date)
    );
    
    RAISE NOTICE '✅ campaign_summaries table created';
  ELSE
    RAISE NOTICE '⏭️  campaign_summaries table already exists, skipping';
  END IF;
END $$;

-- ============================================================================
-- 2. CREATE current_month_cache TABLE (if missing)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'current_month_cache') THEN
    RAISE NOTICE '📊 Creating current_month_cache table...';
    
    CREATE TABLE current_month_cache (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      period_id TEXT NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      platform TEXT DEFAULT 'meta' NOT NULL,
      cache_data JSONB NOT NULL,
      last_refreshed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      
      UNIQUE(client_id, period_id)
    );
    
    RAISE NOTICE '✅ current_month_cache table created';
  ELSE
    RAISE NOTICE '⏭️  current_month_cache table already exists, skipping';
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE current_week_cache TABLE (if missing)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'current_week_cache') THEN
    RAISE NOTICE '📊 Creating current_week_cache table...';
    
    CREATE TABLE current_week_cache (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      period_id TEXT NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      platform TEXT DEFAULT 'meta' NOT NULL,
      cache_data JSONB NOT NULL,
      last_refreshed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      
      UNIQUE(client_id, period_id)
    );
    
    RAISE NOTICE '✅ current_week_cache table created';
  ELSE
    RAISE NOTICE '⏭️  current_week_cache table already exists, skipping';
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE daily_kpi_data TABLE (if missing)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_kpi_data') THEN
    RAISE NOTICE '📊 Creating daily_kpi_data table...';
    
    CREATE TABLE daily_kpi_data (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
      date DATE NOT NULL,
      platform TEXT DEFAULT 'meta' NOT NULL,
      
      total_clicks BIGINT DEFAULT 0 NOT NULL,
      total_impressions BIGINT DEFAULT 0 NOT NULL,
      total_spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
      total_conversions BIGINT DEFAULT 0 NOT NULL,
      reach BIGINT DEFAULT 0,
      
      click_to_call BIGINT DEFAULT 0 NOT NULL,
      email_contacts BIGINT DEFAULT 0 NOT NULL,
      booking_step_1 BIGINT DEFAULT 0 NOT NULL,
      reservations BIGINT DEFAULT 0 NOT NULL,
      reservation_value DECIMAL(12,2) DEFAULT 0 NOT NULL,
      booking_step_2 BIGINT DEFAULT 0 NOT NULL,
      
      average_ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
      average_cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
      roas DECIMAL(8,2) DEFAULT 0 NOT NULL,
      cost_per_reservation DECIMAL(8,2) DEFAULT 0 NOT NULL,
      
      data_source TEXT DEFAULT 'api' NOT NULL,
      campaigns_count INTEGER DEFAULT 0 NOT NULL,
      last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      
      UNIQUE(client_id, date, platform)
    );
    
    RAISE NOTICE '✅ daily_kpi_data table created';
  ELSE
    RAISE NOTICE '⏭️  daily_kpi_data table already exists, skipping';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION: Check all tables now exist
-- ============================================================================
DO $$
DECLARE
  missing_count INTEGER := 0;
  table_name TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 VERIFICATION:';
  RAISE NOTICE '============================================';
  
  FOR table_name IN 
    SELECT t FROM unnest(ARRAY['campaign_summaries', 'current_month_cache', 'current_week_cache', 'daily_kpi_data']) AS t
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = table_name) THEN
      RAISE NOTICE '✅ % exists', table_name;
    ELSE
      RAISE NOTICE '❌ % MISSING', table_name;
      missing_count := missing_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  IF missing_count = 0 THEN
    RAISE NOTICE '🎉 SUCCESS! All critical tables exist.';
  ELSE
    RAISE NOTICE '⚠️  WARNING: % table(s) still missing!', missing_count;
  END IF;
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- 1. ✅ If all tables exist, proceed to SAFE_02_CREATE_INDEXES.sql
-- 2. ⚠️  If tables missing, check error messages above
-- 3. 📊 Run VERIFY_DATABASE_STATUS.sql to see current state
-- ============================================================================







