-- ============================================================================
-- FIX WEEKLY CACHE SCHEMA MISMATCH - CLEAN VERSION
-- ============================================================================
-- This version works in Supabase SQL Editor (no standalone RAISE NOTICE)
-- ============================================================================

-- Fix Meta Weekly Cache
DO $$ 
BEGIN
  -- Fix 1: Rename last_refreshed to last_updated
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'current_week_cache' 
    AND column_name = 'last_refreshed'
  ) THEN
    ALTER TABLE current_week_cache 
    RENAME COLUMN last_refreshed TO last_updated;
    RAISE NOTICE '✅ Meta: Renamed last_refreshed to last_updated';
  ELSE
    RAISE NOTICE '⏭️  Meta: Column last_refreshed does not exist, already fixed';
  END IF;

  -- Fix 2: Make optional fields nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'current_week_cache' 
    AND column_name = 'period_start'
  ) THEN
    ALTER TABLE current_week_cache ALTER COLUMN period_start DROP NOT NULL;
    RAISE NOTICE '✅ Meta: Made period_start nullable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'current_week_cache' 
    AND column_name = 'period_end'
  ) THEN
    ALTER TABLE current_week_cache ALTER COLUMN period_end DROP NOT NULL;
    RAISE NOTICE '✅ Meta: Made period_end nullable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'current_week_cache' 
    AND column_name = 'platform'
  ) THEN
    ALTER TABLE current_week_cache ALTER COLUMN platform DROP NOT NULL;
    RAISE NOTICE '✅ Meta: Made platform nullable';
  END IF;
END $$;

-- Fix Google Ads Weekly Cache
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_ads_current_week_cache') THEN
    RAISE NOTICE '⏭️  google_ads_current_week_cache table does not exist';
    RETURN;
  END IF;
  
  RAISE NOTICE '🔍 Checking google_ads_current_week_cache...';
  
  -- Rename last_refreshed to last_updated
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_ads_current_week_cache' 
    AND column_name = 'last_refreshed'
  ) THEN
    ALTER TABLE google_ads_current_week_cache 
    RENAME COLUMN last_refreshed TO last_updated;
    RAISE NOTICE '✅ Google: Renamed last_refreshed to last_updated';
  ELSE
    RAISE NOTICE '⏭️  Google: Column last_refreshed does not exist, already fixed';
  END IF;

  -- Make optional fields nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_ads_current_week_cache' 
    AND column_name = 'period_start'
  ) THEN
    ALTER TABLE google_ads_current_week_cache ALTER COLUMN period_start DROP NOT NULL;
    RAISE NOTICE '✅ Google: Made period_start nullable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_ads_current_week_cache' 
    AND column_name = 'period_end'
  ) THEN
    ALTER TABLE google_ads_current_week_cache ALTER COLUMN period_end DROP NOT NULL;
    RAISE NOTICE '✅ Google: Made period_end nullable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_ads_current_week_cache' 
    AND column_name = 'platform'
  ) THEN
    ALTER TABLE google_ads_current_week_cache ALTER COLUMN platform DROP NOT NULL;
    RAISE NOTICE '✅ Google: Made platform nullable';
  END IF;
END $$;

-- Verify Meta weekly cache schema
SELECT 
  '🔵 Meta Weekly Cache Schema' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'current_week_cache'
ORDER BY ordinal_position;

-- Verify Google Ads weekly cache schema (if exists)
SELECT 
  '🟢 Google Ads Weekly Cache Schema' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'google_ads_current_week_cache'
ORDER BY ordinal_position;

-- Show current cache status
SELECT 
  '🔵 Meta Weekly Cache Status' as info,
  COUNT(*) as total_entries,
  COUNT(DISTINCT client_id) as unique_clients,
  MAX(last_updated) as newest_entry
FROM current_week_cache;

SELECT 
  '🟢 Google Ads Weekly Cache Status' as info,
  COUNT(*) as total_entries,
  COUNT(DISTINCT client_id) as unique_clients,
  MAX(last_updated) as newest_entry
FROM google_ads_current_week_cache;

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '✅  WEEKLY CACHE SCHEMA FIX COMPLETE!';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'ℹ️  NEXT STEPS:';
  RAISE NOTICE '   1. Run the test: SUPER_SIMPLE_TEST.sql';
  RAISE NOTICE '   2. Trigger refresh: POST /api/automated/refresh-current-week-cache';
  RAISE NOTICE '   3. Check cache status page';
  RAISE NOTICE '';
END $$;



