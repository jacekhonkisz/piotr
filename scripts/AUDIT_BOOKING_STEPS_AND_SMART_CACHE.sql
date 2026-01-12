-- ============================================================================
-- COMPREHENSIVE AUDIT: Google Ads Booking Steps + Smart Cache Usage
-- ============================================================================
-- This audit checks:
-- 1. Google Ads booking steps data quality (are they showing random values?)
-- 2. Whether Meta and Google are properly using smart cache for current periods
-- 3. Data source routing issues
-- ============================================================================

-- ============================================================================
-- PART 1: GOOGLE ADS BOOKING STEPS DATA QUALITY AUDIT
-- ============================================================================

-- STEP 1: Check booking steps in current month cache (what users see for current period)
-- ============================================================================
SELECT 
  '1️⃣ CURRENT MONTH CACHE: Booking Steps' as audit_section,
  c.name as client_name,
  g.period_id,
  TO_CHAR(g.last_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_last_updated,
  EXTRACT(EPOCH FROM (NOW() - g.last_updated))/3600 as cache_age_hours,
  (g.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_step1,
  (g.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as cache_step2,
  (g.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as cache_step3,
  (g.cache_data->'conversionMetrics'->>'reservations')::numeric as cache_reservations,
  (g.cache_data->'stats'->>'totalSpend')::numeric as cache_total_spend,
  CASE 
    WHEN (g.cache_data->'conversionMetrics'->>'booking_step_1')::numeric > 0 THEN '✅ Has booking steps'
    WHEN (g.cache_data->'stats'->>'totalSpend')::numeric > 0 THEN '⚠️ Has spend but NO booking steps'
    ELSE '❌ No data'
  END as cache_status
FROM google_ads_current_month_cache g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY (g.cache_data->'stats'->>'totalSpend')::numeric DESC NULLS LAST;

-- STEP 2: Check booking steps in current week cache
-- ============================================================================
SELECT 
  '2️⃣ CURRENT WEEK CACHE: Booking Steps' as audit_section,
  c.name as client_name,
  g.period_id,
  TO_CHAR(g.last_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_last_updated,
  EXTRACT(EPOCH FROM (NOW() - g.last_updated))/3600 as cache_age_hours,
  (g.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_step1,
  (g.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as cache_step2,
  (g.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as cache_step3,
  (g.cache_data->'stats'->>'totalSpend')::numeric as cache_total_spend,
  CASE 
    WHEN (g.cache_data->'conversionMetrics'->>'booking_step_1')::numeric > 0 THEN '✅ Has booking steps'
    WHEN (g.cache_data->'stats'->>'totalSpend')::numeric > 0 THEN '⚠️ Has spend but NO booking steps'
    ELSE '❌ No data'
  END as cache_status
FROM google_ads_current_week_cache g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.period_id >= TO_CHAR(CURRENT_DATE - INTERVAL '7 days', 'YYYY-WW')
ORDER BY g.last_updated DESC;

-- STEP 3: Check for suspicious booking step values (potential random data)
-- ============================================================================
WITH campaign_booking_steps AS (
  SELECT 
    c.name as client_name,
    g.campaign_id,
    g.campaign_name,
    g.booking_step_1,
    g.booking_step_2,
    g.booking_step_3,
    g.spend,
    g.date_range_start,
    -- Check if values look suspicious (exactly equal, or unrealistic ratios)
    CASE 
      WHEN g.booking_step_1 = g.booking_step_2 AND g.booking_step_1 > 0 THEN '⚠️ Step1 = Step2 (suspicious)'
      WHEN g.booking_step_2 = g.booking_step_3 AND g.booking_step_2 > 0 THEN '⚠️ Step2 = Step3 (suspicious)'
      WHEN g.booking_step_1 = g.booking_step_3 AND g.booking_step_1 > 0 THEN '⚠️ Step1 = Step3 (suspicious)'
      WHEN g.booking_step_1 > 0 AND g.booking_step_2 > g.booking_step_1 THEN '⚠️ Step2 > Step1 (impossible)'
      WHEN g.booking_step_2 > 0 AND g.booking_step_3 > g.booking_step_2 THEN '⚠️ Step3 > Step2 (impossible)'
      WHEN g.booking_step_1 > 0 AND g.spend = 0 THEN '⚠️ Has booking steps but no spend'
      ELSE '✅ Looks normal'
    END as data_quality_flag
  FROM google_ads_campaigns g
  INNER JOIN clients c ON c.id = g.client_id
  WHERE g.date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
    AND g.date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
)
SELECT 
  '3️⃣ BOOKING STEPS DATA QUALITY CHECK' as audit_section,
  client_name,
  campaign_name,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  spend,
  data_quality_flag,
  COUNT(*) OVER (PARTITION BY client_name, data_quality_flag) as campaigns_with_this_flag
FROM campaign_booking_steps
WHERE data_quality_flag != '✅ Looks normal'
ORDER BY client_name, data_quality_flag;

-- STEP 4: Compare cache vs database for current month (should match if cache is working)
-- ============================================================================
WITH cache_data AS (
  SELECT 
    g.client_id,
    (g.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_step1,
    (g.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as cache_step2,
    (g.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as cache_step3,
    (g.cache_data->'stats'->>'totalSpend')::numeric as cache_spend
  FROM google_ads_current_month_cache g
  WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
),
db_data AS (
  SELECT 
    cs.client_id,
    cs.booking_step_1 as db_step1,
    cs.booking_step_2 as db_step2,
    cs.booking_step_3 as db_step3,
    cs.total_spend as db_spend
  FROM campaign_summaries cs
  WHERE cs.platform = 'google'
    AND cs.summary_type = 'monthly'
    AND cs.summary_date = DATE_TRUNC('month', CURRENT_DATE)
)
SELECT 
  '4️⃣ CACHE VS DATABASE COMPARISON (Current Month)' as audit_section,
  c.name as client_name,
  cache.cache_step1,
  db.db_step1,
  cache.cache_step2,
  db.db_step2,
  cache.cache_step3,
  db.db_step3,
  cache.cache_spend,
  db.db_spend,
  CASE 
    WHEN cache.cache_step1 IS NULL AND db.db_step1 IS NULL THEN '❌ No data in either'
    WHEN cache.cache_step1 IS NULL THEN '⚠️ Cache missing, DB has data'
    WHEN db.db_step1 IS NULL THEN '⚠️ DB missing, Cache has data'
    WHEN ABS(cache.cache_step1 - COALESCE(db.db_step1, 0)) > 1 THEN '⚠️ MISMATCH: Cache ≠ DB'
    ELSE '✅ Match'
  END as comparison_status
FROM cache_data cache
FULL OUTER JOIN db_data db ON cache.client_id = db.client_id
INNER JOIN clients c ON c.id = COALESCE(cache.client_id, db.client_id)
ORDER BY c.name;

-- ============================================================================
-- PART 2: SMART CACHE USAGE AUDIT (Meta & Google)
-- ============================================================================

-- STEP 5: Check Meta current month cache status
-- ============================================================================
SELECT 
  '5️⃣ META CURRENT MONTH CACHE STATUS' as audit_section,
  c.name as client_name,
  m.period_id,
  TO_CHAR(m.last_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_last_updated,
  EXTRACT(EPOCH FROM (NOW() - m.last_updated))/3600 as cache_age_hours,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - m.last_updated))/3600 < 3 THEN '✅ Fresh (< 3h)'
    WHEN EXTRACT(EPOCH FROM (NOW() - m.last_updated))/3600 < 6 THEN '⚠️ Stale (3-6h)'
    ELSE '❌ Very stale (> 6h)'
  END as cache_freshness,
  (m.cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  jsonb_array_length(m.cache_data->'campaigns') as campaign_count
FROM current_month_cache m
INNER JOIN clients c ON c.id = m.client_id
WHERE m.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY m.last_updated DESC;

-- STEP 6: Check Google Ads current month cache status
-- ============================================================================
SELECT 
  '6️⃣ GOOGLE ADS CURRENT MONTH CACHE STATUS' as audit_section,
  c.name as client_name,
  g.period_id,
  TO_CHAR(g.last_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_last_updated,
  EXTRACT(EPOCH FROM (NOW() - g.last_updated))/3600 as cache_age_hours,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - g.last_updated))/3600 < 3 THEN '✅ Fresh (< 3h)'
    WHEN EXTRACT(EPOCH FROM (NOW() - g.last_updated))/3600 < 6 THEN '⚠️ Stale (3-6h)'
    ELSE '❌ Very stale (> 6h)'
  END as cache_freshness,
  (g.cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  jsonb_array_length(g.cache_data->'campaigns') as campaign_count
FROM google_ads_current_month_cache g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY g.last_updated DESC;

-- STEP 7: Check Meta current week cache status
-- ============================================================================
SELECT 
  '7️⃣ META CURRENT WEEK CACHE STATUS' as audit_section,
  c.name as client_name,
  w.period_id,
  TO_CHAR(w.last_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_last_updated,
  EXTRACT(EPOCH FROM (NOW() - w.last_updated))/3600 as cache_age_hours,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - w.last_updated))/3600 < 3 THEN '✅ Fresh (< 3h)'
    WHEN EXTRACT(EPOCH FROM (NOW() - w.last_updated))/3600 < 6 THEN '⚠️ Stale (3-6h)'
    ELSE '❌ Very stale (> 6h)'
  END as cache_freshness,
  (w.cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  jsonb_array_length(w.cache_data->'campaigns') as campaign_count
FROM current_week_cache w
INNER JOIN clients c ON c.id = w.client_id
WHERE w.period_id >= TO_CHAR(CURRENT_DATE - INTERVAL '7 days', 'YYYY-WW')
ORDER BY w.last_updated DESC;

-- STEP 8: Check Google Ads current week cache status
-- ============================================================================
SELECT 
  '8️⃣ GOOGLE ADS CURRENT WEEK CACHE STATUS' as audit_section,
  c.name as client_name,
  g.period_id,
  TO_CHAR(g.last_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_last_updated,
  EXTRACT(EPOCH FROM (NOW() - g.last_updated))/3600 as cache_age_hours,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - g.last_updated))/3600 < 3 THEN '✅ Fresh (< 3h)'
    WHEN EXTRACT(EPOCH FROM (NOW() - g.last_updated))/3600 < 6 THEN '⚠️ Stale (3-6h)'
    ELSE '❌ Very stale (> 6h)'
  END as cache_freshness,
  (g.cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  jsonb_array_length(g.cache_data->'campaigns') as campaign_count
FROM google_ads_current_week_cache g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.period_id >= TO_CHAR(CURRENT_DATE - INTERVAL '7 days', 'YYYY-WW')
ORDER BY g.last_updated DESC;

-- STEP 9: Check if current period data is being served from cache vs database
-- ============================================================================
WITH current_month_summaries AS (
  SELECT 
    cs.client_id,
    cs.platform,
    cs.data_source,
    cs.summary_date,
    cs.total_spend,
    cs.booking_step_1,
    cs.last_updated
  FROM campaign_summaries cs
  WHERE cs.summary_date = DATE_TRUNC('month', CURRENT_DATE)
    AND cs.summary_type = 'monthly'
)
SELECT 
  '9️⃣ CURRENT MONTH DATA SOURCE AUDIT' as audit_section,
  c.name as client_name,
  cms.platform,
  cms.data_source,
  TO_CHAR(cms.last_updated, 'YYYY-MM-DD HH24:MI:SS') as db_last_updated,
  cms.total_spend,
  cms.booking_step_1,
  CASE 
    WHEN cms.data_source LIKE '%cache%' OR cms.data_source LIKE '%smart%' THEN '✅ Using cache source'
    WHEN cms.data_source LIKE '%database%' OR cms.data_source LIKE '%campaign_summaries%' THEN '⚠️ Using database (should use cache for current month)'
    WHEN cms.data_source LIKE '%api%' OR cms.data_source LIKE '%live%' THEN '⚠️ Using live API (should use cache for current month)'
    ELSE '❓ Unknown source: ' || cms.data_source
  END as source_analysis
FROM current_month_summaries cms
INNER JOIN clients c ON c.id = cms.client_id
ORDER BY c.name, cms.platform;

-- STEP 10: Compare cache data vs what's in campaign_summaries for current month
-- ============================================================================
WITH meta_cache AS (
  SELECT 
    m.client_id,
    'meta' as platform,
    (m.cache_data->'stats'->>'totalSpend')::numeric as cache_spend,
    (m.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_step1,
    m.last_updated as cache_updated
  FROM current_month_cache m
  WHERE m.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
),
google_cache AS (
  SELECT 
    g.client_id,
    'google' as platform,
    (g.cache_data->'stats'->>'totalSpend')::numeric as cache_spend,
    (g.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_step1,
    g.last_updated as cache_updated
  FROM google_ads_current_month_cache g
  WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
),
all_cache AS (
  SELECT * FROM meta_cache
  UNION ALL
  SELECT * FROM google_cache
),
db_summaries AS (
  SELECT 
    cs.client_id,
    cs.platform,
    cs.total_spend as db_spend,
    cs.booking_step_1 as db_step1,
    cs.last_updated as db_updated
  FROM campaign_summaries cs
  WHERE cs.summary_date = DATE_TRUNC('month', CURRENT_DATE)
    AND cs.summary_type = 'monthly'
)
SELECT 
  '🔟 CACHE VS DATABASE: Current Month Comparison' as audit_section,
  c.name as client_name,
  ac.platform,
  ac.cache_spend,
  db.db_spend,
  ac.cache_step1,
  db.db_step1,
  TO_CHAR(ac.cache_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_updated,
  TO_CHAR(db.db_updated, 'YYYY-MM-DD HH24:MI:SS') as db_updated,
  CASE 
    WHEN ac.cache_spend IS NULL AND db.db_spend IS NULL THEN '❌ No data in either'
    WHEN ac.cache_spend IS NULL THEN '⚠️ Cache missing'
    WHEN db.db_spend IS NULL THEN '⚠️ DB missing'
    WHEN ABS(ac.cache_spend - COALESCE(db.db_spend, 0)) > 10 THEN '⚠️ MISMATCH: Spend differs'
    WHEN ABS(ac.cache_step1 - COALESCE(db.db_step1, 0)) > 1 THEN '⚠️ MISMATCH: Booking steps differ'
    ELSE '✅ Match'
  END as comparison_status
FROM all_cache ac
FULL OUTER JOIN db_summaries db ON ac.client_id = db.client_id AND ac.platform = db.platform
INNER JOIN clients c ON c.id = COALESCE(ac.client_id, db.client_id)
ORDER BY c.name, ac.platform;

-- ============================================================================
-- PART 3: BOOKING STEPS ANOMALY DETECTION
-- ============================================================================

-- STEP 11: Find campaigns with identical booking step values (potential data issue)
-- ============================================================================
SELECT 
  '1️⃣1️⃣ IDENTICAL BOOKING STEPS (Potential Issue)' as audit_section,
  c.name as client_name,
  g.campaign_name,
  g.booking_step_1,
  g.booking_step_2,
  g.booking_step_3,
  g.spend,
  g.date_range_start,
  CASE 
    WHEN g.booking_step_1 = g.booking_step_2 AND g.booking_step_1 = g.booking_step_3 AND g.booking_step_1 > 0 
      THEN '🚨 ALL THREE STEPS IDENTICAL (very suspicious)'
    WHEN g.booking_step_1 = g.booking_step_2 AND g.booking_step_1 > 0 
      THEN '⚠️ Step1 = Step2'
    WHEN g.booking_step_2 = g.booking_step_3 AND g.booking_step_2 > 0 
      THEN '⚠️ Step2 = Step3'
    ELSE '❓ Other pattern'
  END as anomaly_type
FROM google_ads_campaigns g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
  AND (
    (g.booking_step_1 = g.booking_step_2 AND g.booking_step_1 > 0) OR
    (g.booking_step_2 = g.booking_step_3 AND g.booking_step_2 > 0) OR
    (g.booking_step_1 = g.booking_step_3 AND g.booking_step_1 > 0)
  )
ORDER BY c.name, g.spend DESC;

-- STEP 12: Check booking steps distribution (are they realistic?)
-- ============================================================================
WITH step_ratios AS (
  SELECT 
    c.name as client_name,
    g.campaign_name,
    g.booking_step_1,
    g.booking_step_2,
    g.booking_step_3,
    CASE 
      WHEN g.booking_step_1 > 0 THEN ROUND((g.booking_step_2::numeric / g.booking_step_1::numeric) * 100, 2)
      ELSE NULL
    END as step2_to_step1_ratio,
    CASE 
      WHEN g.booking_step_2 > 0 THEN ROUND((g.booking_step_3::numeric / g.booking_step_2::numeric) * 100, 2)
      ELSE NULL
    END as step3_to_step2_ratio
  FROM google_ads_campaigns g
  INNER JOIN clients c ON c.id = g.client_id
  WHERE g.date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
    AND g.booking_step_1 > 0
)
SELECT 
  '1️⃣2️⃣ BOOKING STEPS RATIO ANALYSIS' as audit_section,
  client_name,
  campaign_name,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  step2_to_step1_ratio || '%' as step2_to_step1_ratio,
  step3_to_step2_ratio || '%' as step3_to_step2_ratio,
  CASE 
    WHEN step2_to_step1_ratio > 100 THEN '🚨 Step2 > Step1 (impossible)'
    WHEN step3_to_step2_ratio > 100 THEN '🚨 Step3 > Step2 (impossible)'
    WHEN step2_to_step1_ratio > 50 THEN '⚠️ High Step2 ratio (>50%)'
    WHEN step3_to_step2_ratio > 50 THEN '⚠️ High Step3 ratio (>50%)'
    ELSE '✅ Normal ratios'
  END as ratio_analysis
FROM step_ratios
WHERE step2_to_step1_ratio > 100 OR step3_to_step2_ratio > 100 OR step2_to_step1_ratio > 50 OR step3_to_step2_ratio > 50
ORDER BY client_name, booking_step_1 DESC;

-- ============================================================================
-- PART 4: SUMMARY & RECOMMENDATIONS
-- ============================================================================

-- STEP 13: Overall summary
-- ============================================================================
WITH cache_summary AS (
  SELECT 
    'meta' as platform,
    COUNT(*) as clients_with_cache,
    COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 < 3 THEN 1 END) as fresh_cache_count,
    COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 >= 6 THEN 1 END) as stale_cache_count
  FROM current_month_cache
  WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  UNION ALL
  SELECT 
    'google' as platform,
    COUNT(*) as clients_with_cache,
    COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 < 3 THEN 1 END) as fresh_cache_count,
    COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 >= 6 THEN 1 END) as stale_cache_count
  FROM google_ads_current_month_cache
  WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
),
booking_steps_summary AS (
  SELECT 
    COUNT(*) as campaigns_with_steps,
    COUNT(CASE WHEN booking_step_1 = booking_step_2 AND booking_step_1 > 0 THEN 1 END) as suspicious_identical_steps,
    COUNT(CASE WHEN booking_step_1 > 0 AND booking_step_2 > booking_step_1 THEN 1 END) as impossible_ratios
  FROM google_ads_campaigns
  WHERE date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
)
SELECT 
  '1️⃣3️⃣ OVERALL SUMMARY' as audit_section,
  cs.platform,
  cs.clients_with_cache,
  cs.fresh_cache_count,
  cs.stale_cache_count,
  CASE 
    WHEN cs.stale_cache_count > 0 THEN '⚠️ Some caches are stale (>6h)'
    WHEN cs.fresh_cache_count = cs.clients_with_cache THEN '✅ All caches fresh'
    ELSE '⚠️ Mixed cache freshness'
  END as cache_status
FROM cache_summary cs
UNION ALL
SELECT 
  '1️⃣3️⃣ BOOKING STEPS SUMMARY' as audit_section,
  'google' as platform,
  bss.campaigns_with_steps,
  bss.suspicious_identical_steps,
  bss.impossible_ratios,
  CASE 
    WHEN bss.impossible_ratios > 0 THEN '🚨 CRITICAL: Impossible ratios found'
    WHEN bss.suspicious_identical_steps > 0 THEN '⚠️ WARNING: Suspicious identical steps found'
    ELSE '✅ Booking steps look normal'
  END as booking_steps_status
FROM booking_steps_summary bss;

