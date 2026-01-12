-- ============================================================================
-- CLEAR GOOGLE ADS WEEKLY CACHE
-- ============================================================================
-- This script clears ALL Google Ads weekly cache records
-- Run this to force fresh weekly data collection
-- ============================================================================

-- Clear all weekly cache for all clients
DELETE FROM google_ads_current_week_cache;

-- Show confirmation
SELECT 
  '✅ Google Ads weekly cache cleared' as status,
  'Next weekly request will fetch fresh data from API' as next_step;

-- Show remaining cache (should be 0)
SELECT 
  COUNT(*) as remaining_weekly_cache_records
FROM google_ads_current_week_cache;

