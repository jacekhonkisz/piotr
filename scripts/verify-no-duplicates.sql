-- ============================================================================
-- VERIFICATION SCRIPT: Check for Duplicate Records
-- ============================================================================
-- Purpose: Verify that UNIQUE constraints are working and no duplicates exist
-- Expected Result: 0 rows (no duplicates)
-- ============================================================================

SELECT 
  'campaign_summaries' as table_name,
  c.name as client_name,
  cs.client_id,
  cs.summary_type,
  cs.summary_date,
  cs.platform,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(cs.id) as duplicate_ids,
  ARRAY_AGG(cs.created_at) as created_dates
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
GROUP BY c.name, cs.client_id, cs.summary_type, cs.summary_date, cs.platform
HAVING COUNT(*) > 1

UNION ALL

SELECT 
  'daily_kpi_data' as table_name,
  c.name as client_name,
  dkd.client_id,
  'daily' as summary_type,
  dkd.date::text as summary_date,
  dkd.platform,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(dkd.id) as duplicate_ids,
  ARRAY_AGG(dkd.created_at) as created_dates
FROM daily_kpi_data dkd
JOIN clients c ON c.id = dkd.client_id
GROUP BY c.name, dkd.client_id, dkd.date, dkd.platform
HAVING COUNT(*) > 1;

-- ============================================================================
-- If duplicates found, show details:
-- ============================================================================

-- Show summary statistics
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NO DUPLICATES FOUND - System is clean!'
    ELSE '❌ DUPLICATES FOUND - Action required'
  END as status,
  COUNT(*) as duplicate_groups_found
FROM (
  SELECT client_id, summary_type, summary_date, platform, COUNT(*) as cnt
  FROM campaign_summaries
  GROUP BY client_id, summary_type, summary_date, platform
  HAVING COUNT(*) > 1
) duplicates;



