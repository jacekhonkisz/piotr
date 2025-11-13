-- ============================================================================
-- FIX WEEKLY CACHE SCHEMA MISMATCH
-- ============================================================================
-- 
-- PROBLEM: current_week_cache table has schema mismatch
-- - Table uses: last_refreshed (not last_updated)
-- - Table requires: period_start, period_end, platform
-- - Code expects: last_updated, no extra fields
--
-- SOLUTION: Standardize table to match migration file and code expectations
-- ============================================================================

-- Check if column exists before altering
DO $$ 
BEGIN
  -- Fix 1: Rename last_refreshed to last_updated (if it exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'current_week_cache' 
    AND column_name = 'last_refreshed'
  ) THEN
    ALTER TABLE current_week_cache 
    RENAME COLUMN last_refreshed TO last_updated;
    RAISE NOTICE '✅ Renamed last_refreshed to last_updated';
  ELSE
    RAISE NOTICE '⏭️  Column last_refreshed does not exist, skipping rename';
  END IF;

  -- Fix 2: Make period_start, period_end, platform nullable (if they exist)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'current_week_cache' 
    AND column_name = 'period_start'
  ) THEN
    ALTER TABLE current_week_cache 
    ALTER COLUMN period_start DROP NOT NULL;
    RAISE NOTICE '✅ Made period_start nullable';
  ELSE
    RAISE NOTICE '⏭️  Column period_start does not exist, skipping';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'current_week_cache' 
    AND column_name = 'period_end'
  ) THEN
    ALTER TABLE current_week_cache 
    ALTER COLUMN period_end DROP NOT NULL;
    RAISE NOTICE '✅ Made period_end nullable';
  ELSE
    RAISE NOTICE '⏭️  Column period_end does not exist, skipping';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'current_week_cache' 
    AND column_name = 'platform'
  ) THEN
    ALTER TABLE current_week_cache 
    ALTER COLUMN platform DROP NOT NULL;
    RAISE NOTICE '✅ Made platform nullable';
  ELSE
    RAISE NOTICE '⏭️  Column platform does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- FIX GOOGLE ADS WEEKLY CACHE (Same issue)
-- ============================================================================

DO $$ 
BEGIN
  -- Fix Google Ads weekly cache if it has the same issue
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'google_ads_current_week_cache'
  ) THEN
    RAISE NOTICE '🔍 Checking google_ads_current_week_cache...';
    
    -- Rename last_refreshed to last_updated
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'google_ads_current_week_cache' 
      AND column_name = 'last_refreshed'
    ) THEN
      ALTER TABLE google_ads_current_week_cache 
      RENAME COLUMN last_refreshed TO last_updated;
      RAISE NOTICE '✅ Google Ads: Renamed last_refreshed to last_updated';
    ELSE
      RAISE NOTICE '⏭️  Google Ads: Column last_refreshed does not exist, skipping';
    END IF;

    -- Make optional fields nullable
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'google_ads_current_week_cache' 
      AND column_name = 'period_start'
    ) THEN
      ALTER TABLE google_ads_current_week_cache 
      ALTER COLUMN period_start DROP NOT NULL;
      RAISE NOTICE '✅ Google Ads: Made period_start nullable';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'google_ads_current_week_cache' 
      AND column_name = 'period_end'
    ) THEN
      ALTER TABLE google_ads_current_week_cache 
      ALTER COLUMN period_end DROP NOT NULL;
      RAISE NOTICE '✅ Google Ads: Made period_end nullable';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'google_ads_current_week_cache' 
      AND column_name = 'platform'
    ) THEN
      ALTER TABLE google_ads_current_week_cache 
      ALTER COLUMN platform DROP NOT NULL;
      RAISE NOTICE '✅ Google Ads: Made platform nullable';
    END IF;
  ELSE
    RAISE NOTICE '⏭️  google_ads_current_week_cache table does not exist';
  END IF;
END $$;

-- ============================================================================
-- VERIFY THE FIXES
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '📊 VERIFICATION RESULTS:';
RAISE NOTICE '';

-- Verify Meta weekly cache schema
RAISE NOTICE '🔵 Meta Weekly Cache Schema:';
SELECT 
  '  ' || column_name || ' (' || data_type || ', nullable: ' || is_nullable || ')' as schema_info
FROM information_schema.columns
WHERE table_name = 'current_week_cache'
ORDER BY ordinal_position;

-- Verify Google Ads weekly cache schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_ads_current_week_cache') THEN
    RAISE NOTICE '';
    RAISE NOTICE '🟢 Google Ads Weekly Cache Schema:';
  END IF;
END $$;

SELECT 
  '  ' || column_name || ' (' || data_type || ', nullable: ' || is_nullable || ')' as schema_info
FROM information_schema.columns
WHERE table_name = 'google_ads_current_week_cache'
ORDER BY ordinal_position;

-- ============================================================================
-- CHECK CURRENT DATA
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '📈 CURRENT CACHE STATUS:';
RAISE NOTICE '';

-- Meta weekly cache status
DO $$
DECLARE
  total_count INTEGER;
  client_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT client_id) 
  INTO total_count, client_count
  FROM current_week_cache;
  
  RAISE NOTICE '🔵 Meta Weekly Cache: % entries for % clients', total_count, client_count;
END $$;

-- Google Ads weekly cache status
DO $$
DECLARE
  total_count INTEGER;
  client_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_ads_current_week_cache') THEN
    SELECT COUNT(*), COUNT(DISTINCT client_id) 
    INTO total_count, client_count
    FROM google_ads_current_week_cache;
    
    RAISE NOTICE '🟢 Google Ads Weekly Cache: % entries for % clients', total_count, client_count;
  END IF;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '✅ ============================================';
RAISE NOTICE '✅  WEEKLY CACHE SCHEMA FIX COMPLETE!';
RAISE NOTICE '✅ ============================================';
RAISE NOTICE '';
RAISE NOTICE 'ℹ️  NEXT STEPS:';
RAISE NOTICE '   1. Manually trigger cache refresh:';
RAISE NOTICE '      POST /api/automated/refresh-current-week-cache';
RAISE NOTICE '   2. Check cache status page - should show entries';
RAISE NOTICE '   3. Verify automatic refresh works (every 3 hours)';
RAISE NOTICE '';

