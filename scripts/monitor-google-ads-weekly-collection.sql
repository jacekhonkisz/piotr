-- ============================================================================
-- MONITOR GOOGLE ADS WEEKLY DATA COLLECTION
-- ============================================================================
-- This script monitors the progress of Google Ads weekly data collection
-- Run this periodically to check collection status
-- ============================================================================

-- ============================================================================
-- PART 1: WEEKLY CACHE STATUS (Current Week)
-- ============================================================================
SELECT 
  '1️⃣ WEEKLY CACHE STATUS' as section,
  c.name as client_name,
  gw.period_id,
  TO_CHAR(gw.last_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_last_updated,
  EXTRACT(EPOCH FROM (NOW() - gw.last_updated))/3600 as cache_age_hours,
  (gw.cache_data->'stats'->>'totalSpend')::numeric as cache_spend,
  (gw.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_step1,
  (gw.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as cache_step2,
  (gw.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as cache_step3,
  (gw.cache_data->'campaigns')::jsonb->'length' as campaign_count,
  CASE 
    WHEN (gw.cache_data->'stats'->>'totalSpend')::numeric > 0 THEN '✅ Has data'
    ELSE '⚠️ No data'
  END as cache_status
FROM google_ads_current_week_cache gw
INNER JOIN clients c ON c.id = gw.client_id
ORDER BY gw.last_updated DESC;

-- ============================================================================
-- PART 2: WEEKLY SUMMARIES IN DATABASE (Historical Weeks)
-- ============================================================================
SELECT 
  '2️⃣ WEEKLY SUMMARIES IN DATABASE' as section,
  c.name as client_name,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  TO_CHAR(cs.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
  CASE 
    WHEN cs.booking_step_1 > 0 THEN '✅ Has booking steps'
    WHEN cs.total_spend > 0 THEN '⚠️ Has spend but NO booking steps'
    ELSE '❌ No data'
  END as data_status
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
ORDER BY cs.summary_date DESC, c.name
LIMIT 50;

-- ============================================================================
-- PART 3: COLLECTION PROGRESS BY CLIENT
-- ============================================================================
SELECT 
  '3️⃣ COLLECTION PROGRESS BY CLIENT' as section,
  c.name as client_name,
  COUNT(DISTINCT cs.summary_date) as weeks_collected,
  MIN(cs.summary_date) as oldest_week,
  MAX(cs.summary_date) as newest_week,
  SUM(cs.total_spend) as total_spend_all_weeks,
  SUM(cs.booking_step_1) as total_step1,
  SUM(cs.booking_step_2) as total_step2,
  SUM(cs.booking_step_3) as total_step3,
  CASE 
    WHEN COUNT(DISTINCT cs.summary_date) >= 50 THEN '✅ Complete (50+ weeks)'
    WHEN COUNT(DISTINCT cs.summary_date) >= 20 THEN '🟡 Partial (20-49 weeks)'
    WHEN COUNT(DISTINCT cs.summary_date) > 0 THEN '🟠 Limited (1-19 weeks)'
    ELSE '❌ No weekly data'
  END as collection_status
FROM clients c
LEFT JOIN campaign_summaries cs ON cs.client_id = c.id 
  AND cs.platform = 'google' 
  AND cs.summary_type = 'weekly'
WHERE c.google_ads_customer_id IS NOT NULL
GROUP BY c.id, c.name
ORDER BY weeks_collected DESC, c.name;

-- ============================================================================
-- PART 4: RECENT WEEKS DATA QUALITY CHECK
-- ============================================================================
SELECT 
  '4️⃣ RECENT WEEKS DATA QUALITY' as section,
  cs.summary_date,
  COUNT(DISTINCT cs.client_id) as clients_with_data,
  SUM(cs.total_spend) as total_spend,
  SUM(cs.booking_step_1) as total_step1,
  SUM(cs.booking_step_2) as total_step2,
  SUM(cs.booking_step_3) as total_step3,
  AVG(cs.booking_step_1) as avg_step1,
  COUNT(CASE WHEN cs.booking_step_1 > 0 THEN 1 END) as clients_with_step1,
  COUNT(CASE WHEN cs.total_spend > 0 AND cs.booking_step_1 = 0 THEN 1 END) as clients_missing_steps,
  CASE 
    WHEN COUNT(CASE WHEN cs.total_spend > 0 AND cs.booking_step_1 = 0 THEN 1 END) > 0 
    THEN '⚠️ Some clients missing booking steps'
    ELSE '✅ All clients have booking steps'
  END as quality_status
FROM campaign_summaries cs
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= CURRENT_DATE - INTERVAL '8 weeks'
GROUP BY cs.summary_date
ORDER BY cs.summary_date DESC;

-- ============================================================================
-- PART 5: COMPARISON: CACHE vs DATABASE (Current Week)
-- ============================================================================
WITH current_week_cache AS (
  SELECT 
    gw.client_id,
    (gw.cache_data->'stats'->>'totalSpend')::numeric as cache_spend,
    (gw.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_step1,
    (gw.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as cache_step2,
    (gw.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as cache_step3
  FROM google_ads_current_week_cache gw
),
current_week_db AS (
  SELECT 
    cs.client_id,
    cs.total_spend as db_spend,
    cs.booking_step_1 as db_step1,
    cs.booking_step_2 as db_step2,
    cs.booking_step_3 as db_step3
  FROM campaign_summaries cs
  WHERE cs.platform = 'google'
    AND cs.summary_type = 'weekly'
    AND cs.summary_date >= DATE_TRUNC('week', CURRENT_DATE)
    AND cs.summary_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
)
SELECT 
  '5️⃣ CACHE vs DATABASE COMPARISON' as section,
  c.name as client_name,
  COALESCE(cwc.cache_spend, 0) as cache_spend,
  COALESCE(cwd.db_spend, 0) as db_spend,
  COALESCE(cwc.cache_step1, 0) as cache_step1,
  COALESCE(cwd.db_step1, 0) as db_step1,
  CASE 
    WHEN cwc.cache_spend IS NULL AND cwd.db_spend IS NULL THEN '❌ No data in either'
    WHEN cwc.cache_spend IS NULL THEN '⚠️ Only in database'
    WHEN cwd.db_spend IS NULL THEN '⚠️ Only in cache'
    WHEN ABS(COALESCE(cwc.cache_spend, 0) - COALESCE(cwd.db_spend, 0)) < 0.01 THEN '✅ Match'
    ELSE '⚠️ Mismatch'
  END as comparison_status
FROM clients c
LEFT JOIN current_week_cache cwc ON cwc.client_id = c.id
LEFT JOIN current_week_db cwd ON cwd.client_id = c.id
WHERE c.google_ads_customer_id IS NOT NULL
  AND (cwc.cache_spend IS NOT NULL OR cwd.db_spend IS NOT NULL)
ORDER BY c.name;

-- ============================================================================
-- PART 6: BOOKING STEPS DATA SOURCE VERIFICATION
-- ============================================================================
SELECT 
  '6️⃣ BOOKING STEPS SOURCE VERIFICATION' as section,
  cs.summary_date,
  c.name as client_name,
  cs.total_spend,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  CASE 
    WHEN cs.booking_step_1 > 0 AND cs.booking_step_2 > 0 AND cs.booking_step_3 > 0 THEN '✅ All steps present'
    WHEN cs.booking_step_1 > 0 THEN '🟡 Only step 1'
    WHEN cs.total_spend > 0 AND cs.booking_step_1 = 0 THEN '⚠️ Has spend but NO steps'
    ELSE '❌ No data'
  END as steps_status,
  CASE 
    WHEN cs.booking_step_2 > cs.booking_step_1 THEN '🚨 Step2 > Step1 (INVALID)'
    WHEN cs.booking_step_3 > cs.booking_step_2 THEN '🚨 Step3 > Step2 (INVALID)'
    WHEN cs.booking_step_1 = cs.booking_step_2 AND cs.booking_step_2 = cs.booking_step_3 AND cs.booking_step_1 > 0 THEN '⚠️ All steps identical (suspicious)'
    ELSE '✅ Valid funnel'
  END as funnel_validation
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= CURRENT_DATE - INTERVAL '4 weeks'
ORDER BY cs.summary_date DESC, c.name;

