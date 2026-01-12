-- ============================================================================
-- CLEAR GOOGLE ADS CURRENT MONTH CACHE
-- ============================================================================
-- This script clears the Google Ads smart cache for the current month
-- This forces the system to fetch fresh data from Google Ads API
-- with the fixed booking steps logic (API-only, no daily_kpi_data)
-- ============================================================================

-- Clear current month cache for all clients
DELETE FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- Show what was deleted
SELECT 
  '✅ Cleared Google Ads cache for period: ' || TO_CHAR(CURRENT_DATE, 'YYYY-MM') as result,
  COUNT(*) as deleted_records
FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- Verify cache is cleared
SELECT 
  '🔍 Verification: Remaining cache records for current month' as check_type,
  COUNT(*) as remaining_records
FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- ============================================================================
-- NOTES:
-- ============================================================================
-- After running this script:
-- 1. The next API call will fetch fresh data from Google Ads API
-- 2. Booking steps will come ONLY from API (no daily_kpi_data)
-- 3. The cache will be automatically refreshed with correct data
-- 4. Cache refresh happens automatically when cache is > 3 hours old
-- ============================================================================

