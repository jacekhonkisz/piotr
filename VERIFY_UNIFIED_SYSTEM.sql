-- ============================================================================
-- UNIFIED SYSTEM VERIFICATION SCRIPT
-- ============================================================================
-- Purpose: Verify no duplications, conflicts, or data integrity issues
-- Date: October 2, 2025
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- TEST #1: Check for Duplicate Records
-- ============================================================================
-- Expected: 0 rows (no duplicates allowed)

SELECT 
  '❌ DUPLICATES FOUND' as status,
  client_id,
  summary_type,
  summary_date,
  platform,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as record_ids
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
GROUP BY client_id, summary_type, summary_date, platform
HAVING COUNT(*) > 1;

-- If this returns rows → YOU HAVE DUPLICATES (shouldn't happen!)
-- If this returns nothing → ✅ System is clean

-- ============================================================================
-- TEST #2: Platform Separation Check
-- ============================================================================
-- Shows if Meta and Google data are properly separated

SELECT 
  '✅ PLATFORM SEPARATION' as status,
  summary_date,
  platform,
  COUNT(*) as records,
  SUM(total_spend) as total_spend,
  SUM(jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb))) as total_campaigns
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
GROUP BY summary_date, platform
ORDER BY summary_date DESC, platform;

-- Expected: Separate rows for 'meta' and 'google' if both exist

-- ============================================================================
-- TEST #3: Data Consistency Check
-- ============================================================================
-- Verify campaign_summaries totals match sum of campaigns

SELECT 
  '⚠️ INCONSISTENT DATA' as status,
  summary_date,
  platform,
  total_spend as stored_total,
  (
    SELECT ROUND(SUM((campaign->>'spend')::numeric), 2)
    FROM jsonb_array_elements(campaign_data) as campaign
  ) as calculated_from_campaigns,
  ROUND(
    ABS(
      total_spend - (
        SELECT SUM((campaign->>'spend')::numeric)
        FROM jsonb_array_elements(campaign_data) as campaign
      )
    ), 2
  ) as difference
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
  AND campaign_data IS NOT NULL
  AND jsonb_array_length(campaign_data) > 0
HAVING ABS(
  total_spend - (
    SELECT SUM((campaign->>'spend')::numeric)
    FROM jsonb_array_elements(campaign_data) as campaign
  )
) > 0.50;  -- Allow 0.50 difference for rounding

-- If this returns rows → Totals don't match campaigns
-- If this returns nothing → ✅ Data is consistent

-- ============================================================================
-- TEST #4: Compare campaign_summaries vs daily_kpi_data
-- ============================================================================
-- This shows why the numbers differ!

SELECT 
  source,
  period,
  platform_or_source,
  total_spend,
  total_impressions,
  days_or_campaigns,
  last_updated
FROM (
  -- From campaign_summaries
  SELECT 
    'campaign_summaries' as source,
    summary_date::text as period,
    platform as platform_or_source,
    total_spend,
    total_impressions,
    COALESCE(jsonb_array_length(campaign_data), 0) || ' campaigns' as days_or_campaigns,
    last_updated,
    1 as sort_order
  FROM campaign_summaries
  WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
    AND summary_type = 'monthly'
    AND summary_date >= '2025-07-01'
  
  UNION ALL
  
  -- From daily_kpi_data (aggregated by month)
  SELECT 
    'daily_kpi_data' as source,
    TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM-DD') as period,
    data_source as platform_or_source,
    ROUND(SUM(total_spend), 2) as total_spend,
    SUM(total_impressions) as total_impressions,
    COUNT(DISTINCT date) || ' days' as days_or_campaigns,
    MAX(last_updated) as last_updated,
    2 as sort_order
  FROM daily_kpi_data
  WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
    AND date >= '2025-07-01'
  GROUP BY DATE_TRUNC('month', date), data_source
) combined
ORDER BY period DESC, sort_order, platform_or_source;

-- This shows both sources side-by-side to understand the discrepancy

-- ============================================================================
-- TEST #5: Check September Specifically
-- ============================================================================

SELECT 
  '📊 SEPTEMBER 2025 ANALYSIS' as status,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns_count,
  data_source,
  last_updated,
  AGE(NOW(), last_updated) as data_age
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date = '2025-09-01';

-- This is the specific record that should show 22 campaigns and 12,735 PLN

-- ============================================================================
-- TEST #6: Verify UNIQUE Constraint Exists
-- ============================================================================

SELECT 
  '✅ UNIQUE CONSTRAINT STATUS' as status,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'campaign_summaries'::regclass
  AND contype = 'u';

-- Expected: Shows UNIQUE constraint on (client_id, summary_type, summary_date, platform)

-- ============================================================================
-- TEST #7: Count All Records by Month
-- ============================================================================

SELECT 
  '📈 MONTHLY RECORD COUNT' as status,
  summary_date,
  platform,
  summary_type,
  COUNT(*) as records,
  SUM(total_spend) as total_spend
FROM campaign_summaries
WHERE summary_date >= '2025-07-01'
GROUP BY summary_date, platform, summary_type
ORDER BY summary_date DESC, platform;

-- Shows how many records exist per month/platform

-- ============================================================================
-- SUMMARY OF EXPECTED RESULTS
-- ============================================================================

/*
✅ TEST #1 (Duplicates): Should return 0 rows
✅ TEST #2 (Platform Separation): Should show separate rows for meta/google
✅ TEST #3 (Consistency): Should return 0 rows (or minimal rounding differences)
📊 TEST #4 (Comparison): Shows why campaign_summaries and daily_kpi_data differ
📊 TEST #5 (September): Should show 22 campaigns, 12,735.18 PLN
✅ TEST #6 (Constraint): Should show UNIQUE constraint exists
📈 TEST #7 (Count): Shows overall data volume

IF ALL TESTS PASS:
  ✅ System is unified
  ✅ No duplications
  ✅ No conflicts
  ✅ Data integrity maintained
  
REMAINING ISSUE:
  ⚠️ Understand why campaign_summaries (12,735 PLN) differs from daily_kpi_data (7,118 PLN)
  → This is what TEST #4 will reveal!
*/

