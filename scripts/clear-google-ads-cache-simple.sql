-- ============================================================================
-- CLEAR GOOGLE ADS CACHE - SIMPLE VERSION
-- ============================================================================
-- This script clears ALL Google Ads cache records for the current month
-- Run this, then refresh your dashboard to trigger fresh data collection
-- ============================================================================

-- Clear current month cache for all clients
DELETE FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- Show confirmation
SELECT 
  '✅ Google Ads cache cleared for: ' || TO_CHAR(CURRENT_DATE, 'YYYY-MM') as status,
  'Next dashboard refresh will fetch fresh data from API' as next_step;

