-- ============================================================================
-- Clear Current Month Cache for January 2026
-- ============================================================================
-- This clears the cache for all clients for January 2026
-- so the system will fetch fresh data with API values
-- ============================================================================

-- Clear current_month_cache for January 2026
DELETE FROM current_month_cache
WHERE period_id LIKE '2026-01%'
   OR (period_start >= '2026-01-01' AND period_start < '2026-02-01');

-- Also clear current_week_cache for weeks in January 2026
DELETE FROM current_week_cache
WHERE period_id LIKE '2026-01%'
   OR (period_start >= '2026-01-01' AND period_start < '2026-02-01');

-- Show what was deleted
SELECT 
  'current_month_cache' as table_name,
  COUNT(*) as deleted_count
FROM current_month_cache
WHERE period_id LIKE '2026-01%'
   OR (period_start >= '2026-01-01' AND period_start < '2026-02-01')
UNION ALL
SELECT 
  'current_week_cache' as table_name,
  COUNT(*) as deleted_count
FROM current_week_cache
WHERE period_id LIKE '2026-01%'
   OR (period_start >= '2026-01-01' AND period_start < '2026-02-01');

