-- ============================================================================
-- CLEAR ALL CURRENT PERIOD CACHES FOR ALL CLIENTS
-- ============================================================================
-- This script deletes all smart cache entries for current month and week
-- for ALL clients (Meta & Google Ads), forcing a fresh fetch with all data
-- ============================================================================

-- Get current period IDs
DO $$
DECLARE
  current_month_period_id TEXT;
  current_week_period_id TEXT;
  deleted_count INTEGER;
BEGIN
  -- Calculate current month period ID
  current_month_period_id := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Calculate current week period ID (format: YYYY-WW, e.g., 2026-W02)
  -- Using ISO week calculation
  current_week_period_id := TO_CHAR(CURRENT_DATE, 'IYYY') || '-W' || LPAD(TO_CHAR(CURRENT_DATE, 'IW'), 2, '0');
  
  RAISE NOTICE 'Current Month Period: %', current_month_period_id;
  RAISE NOTICE 'Current Week Period: %', current_week_period_id;
  
  -- Delete Google Ads current month cache
  DELETE FROM google_ads_current_month_cache
  WHERE period_id = current_month_period_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % Google Ads current month cache entries', deleted_count;
  
  -- Delete Google Ads current week cache (match exact period or use LIKE for week format)
  DELETE FROM google_ads_current_week_cache
  WHERE period_id = current_week_period_id OR period_id LIKE current_week_period_id || '%';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % Google Ads current week cache entries', deleted_count;
  
  -- Delete Meta current month cache
  DELETE FROM current_month_cache
  WHERE period_id = current_month_period_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % Meta current month cache entries', deleted_count;
  
  -- Delete Meta current week cache (match exact period or use LIKE for week format)
  DELETE FROM current_week_cache
  WHERE period_id = current_week_period_id OR period_id LIKE current_week_period_id || '%';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % Meta current week cache entries', deleted_count;
  
  RAISE NOTICE '✅ All current period caches cleared!';
END $$;

-- Verification: Show what's left
SELECT 
  'VERIFICATION: Remaining Cache Entries' as check_type,
  'google_ads_current_month_cache' as table_name,
  COUNT(*) as remaining_count
FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
UNION ALL
SELECT 
  'VERIFICATION: Remaining Cache Entries' as check_type,
  'google_ads_current_week_cache' as table_name,
  COUNT(*) as remaining_count
FROM google_ads_current_week_cache
WHERE period_id = (TO_CHAR(CURRENT_DATE, 'IYYY') || '-W' || LPAD(TO_CHAR(CURRENT_DATE, 'IW'), 2, '0'))
   OR period_id LIKE (TO_CHAR(CURRENT_DATE, 'IYYY') || '-W' || LPAD(TO_CHAR(CURRENT_DATE, 'IW'), 2, '0') || '%')
UNION ALL
SELECT 
  'VERIFICATION: Remaining Cache Entries' as check_type,
  'current_month_cache' as table_name,
  COUNT(*) as remaining_count
FROM current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
UNION ALL
SELECT 
  'VERIFICATION: Remaining Cache Entries' as check_type,
  'current_week_cache' as table_name,
  COUNT(*) as remaining_count
FROM current_week_cache
WHERE period_id = (TO_CHAR(CURRENT_DATE, 'IYYY') || '-W' || LPAD(TO_CHAR(CURRENT_DATE, 'IW'), 2, '0'))
   OR period_id LIKE (TO_CHAR(CURRENT_DATE, 'IYYY') || '-W' || LPAD(TO_CHAR(CURRENT_DATE, 'IW'), 2, '0') || '%');

