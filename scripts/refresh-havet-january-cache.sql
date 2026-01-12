-- ============================================================================
-- REFRESH: Delete Havet January 2026 Cache to Force API Refresh
-- ============================================================================
-- This will force the system to fetch fresh data from Meta API
-- with account-level insights (CTR/CPC from API)
-- ============================================================================

-- Delete current month cache for Havet (January 2026)
DELETE FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND period_id = '2026-01';

-- Verify deletion
SELECT 
  'Cache deleted for Havet January 2026' as status,
  COUNT(*) as remaining_cache_entries
FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND period_id = '2026-01';

