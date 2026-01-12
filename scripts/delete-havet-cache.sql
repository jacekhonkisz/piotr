i need-- ============================================================================
-- FIX: Delete Havet Cache to Force Refresh with Correct Booking Steps
-- ============================================================================
-- This will force the system to fetch fresh data from Google Ads API
-- with the fixed conversion breakdown merge logic
-- ============================================================================

-- Delete current month cache for Havet
DELETE FROM google_ads_current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- Verify deletion
SELECT 
  'Cache deleted for Havet' as status,
  COUNT(*) as remaining_cache_entries
FROM google_ads_current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

