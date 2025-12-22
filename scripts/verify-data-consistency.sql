-- ============================================================================
-- VERIFICATION SCRIPT: Data Consistency Check
-- ============================================================================
-- Purpose: Compare campaign_summaries with daily_kpi_data for consistency
-- ============================================================================

-- 1️⃣ October 2025 Comparison (Belmonte example)
SELECT 
  '1. October 2025 - Belmonte' as check_name,
  source,
  total_spend,
  reservations,
  total_impressions,
  total_clicks,
  record_count
FROM (
  -- Campaign Summaries (Weekly Aggregated)
  SELECT 
    'campaign_summaries (weekly agg)' as source,
    SUM(total_spend)::numeric(12,2) as total_spend,
    SUM(reservations) as reservations,
    SUM(total_impressions) as total_impressions,
    SUM(total_clicks) as total_clicks,
    COUNT(*) as record_count
  FROM campaign_summaries
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND summary_type = 'weekly'
    AND platform = 'meta'
    AND summary_date >= '2025-10-01'
    AND summary_date < '2025-11-01'
  
  UNION ALL
  
  -- Campaign Summaries (Monthly)
  SELECT 
    'campaign_summaries (monthly)' as source,
    total_spend::numeric(12,2),
    reservations,
    total_impressions,
    total_clicks,
    1 as record_count
  FROM campaign_summaries
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND summary_type = 'monthly'
    AND platform = 'meta'
    AND summary_date = '2025-10-01'
  
  UNION ALL
  
  -- Daily KPI Data (Aggregated)
  SELECT 
    'daily_kpi_data (aggregated)' as source,
    SUM(total_spend)::numeric(12,2),
    SUM(reservations) as reservations,
    SUM(total_impressions),
    SUM(total_clicks),
    COUNT(*) as record_count
  FROM daily_kpi_data
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND platform = 'meta'
    AND date >= '2025-10-01'
    AND date < '2025-11-01'
) comparison
ORDER BY source;

-- 2️⃣ Check for Missing Days in Daily KPI Data
SELECT 
  '2. Missing Days Check' as check_name,
  c.name as client_name,
  '2025-10-01'::date + generate_series(0, 30) as expected_date,
  CASE 
    WHEN dkd.date IS NULL THEN '❌ MISSING'
    ELSE '✅ Present'
  END as status,
  dkd.total_spend,
  dkd.reservations
FROM clients c
CROSS JOIN generate_series(0, 30) 
LEFT JOIN daily_kpi_data dkd 
  ON dkd.client_id = c.id 
  AND dkd.platform = 'meta'
  AND dkd.date = ('2025-10-01'::date + generate_series)
WHERE c.id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
ORDER BY expected_date;

-- 3️⃣ Data Completeness by Month (All Clients)
SELECT 
  '3. Data Completeness by Month' as check_name,
  c.name as client_name,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  cs.platform,
  -- Campaign Summary
  cs.total_spend as summary_spend,
  cs.reservations as summary_conversions,
  -- Daily KPI Aggregation
  (
    SELECT SUM(total_spend)::numeric(12,2)
    FROM daily_kpi_data
    WHERE client_id = c.id
      AND platform = cs.platform
      AND date >= cs.summary_date
      AND date < (cs.summary_date + INTERVAL '1 month')::date
  ) as daily_aggregated_spend,
  -- Difference
  CASE 
    WHEN cs.total_spend = 0 AND (
      SELECT SUM(total_spend)
      FROM daily_kpi_data
      WHERE client_id = c.id
        AND platform = cs.platform
        AND date >= cs.summary_date
        AND date < (cs.summary_date + INTERVAL '1 month')::date
    ) IS NULL THEN '⚠️ No Data'
    WHEN ABS(cs.total_spend - COALESCE((
      SELECT SUM(total_spend)
      FROM daily_kpi_data
      WHERE client_id = c.id
        AND platform = cs.platform
        AND date >= cs.summary_date
        AND date < (cs.summary_date + INTERVAL '1 month')::date
    ), 0)) < 0.01 THEN '✅ Match'
    ELSE '❌ Mismatch'
  END as consistency_status
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
  AND cs.summary_date >= '2025-09-01'
ORDER BY c.name, month DESC;

-- 4️⃣ Weekly vs Daily Consistency
SELECT 
  '4. Weekly vs Daily Consistency' as check_name,
  c.name as client_name,
  cs.summary_date as week_start,
  cs.platform,
  cs.total_spend as weekly_summary_spend,
  (
    SELECT SUM(total_spend)::numeric(12,2)
    FROM daily_kpi_data
    WHERE client_id = c.id
      AND platform = cs.platform
      AND date >= cs.summary_date
      AND date < (cs.summary_date + INTERVAL '7 days')::date
  ) as daily_aggregated_spend,
  CASE 
    WHEN ABS(cs.total_spend - COALESCE((
      SELECT SUM(total_spend)
      FROM daily_kpi_data
      WHERE client_id = c.id
        AND platform = cs.platform
        AND date >= cs.summary_date
        AND date < (cs.summary_date + INTERVAL '7 days')::date
    ), 0)) < 0.01 THEN '✅ Match'
    ELSE '⚠️ Mismatch'
  END as consistency_status
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-10-01'
  AND cs.summary_date < '2025-11-01'
ORDER BY c.name, week_start;

-- 5️⃣ Check for Non-Monday Weekly Dates
SELECT 
  '5. Non-Monday Weekly Dates' as check_name,
  c.name as client_name,
  cs.summary_date,
  TO_CHAR(cs.summary_date, 'Day') as day_of_week,
  EXTRACT(DOW FROM cs.summary_date) as day_number,
  CASE 
    WHEN EXTRACT(DOW FROM cs.summary_date) = 1 THEN '✅ Monday'
    ELSE '❌ NOT Monday!'
  END as validation_status,
  cs.total_spend,
  cs.reservations
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND EXTRACT(DOW FROM cs.summary_date) != 1 -- Not Monday
ORDER BY cs.summary_date DESC;

-- 6️⃣ Overall System Health Summary
SELECT 
  '6. Overall System Health' as summary,
  CASE 
    WHEN 
      (SELECT COUNT(*) FROM campaign_summaries WHERE platform IS NULL) = 0
      AND (SELECT COUNT(*) FROM daily_kpi_data WHERE platform IS NULL) = 0
      AND (SELECT COUNT(*) FROM campaign_summaries cs1 
           WHERE EXISTS (
             SELECT 1 FROM campaign_summaries cs2 
             WHERE cs2.client_id = cs1.client_id 
               AND cs2.summary_type = cs1.summary_type
               AND cs2.summary_date = cs1.summary_date 
               AND cs2.platform = cs1.platform 
               AND cs2.id != cs1.id
           )) = 0
    THEN '✅ HEALTHY'
    ELSE '⚠️ ISSUES FOUND'
  END as status,
  (SELECT COUNT(*) FROM campaign_summaries WHERE platform IS NULL) as null_platforms,
  (SELECT COUNT(*) FROM campaign_summaries cs1 
   WHERE EXISTS (
     SELECT 1 FROM campaign_summaries cs2 
     WHERE cs2.client_id = cs1.client_id 
       AND cs2.summary_type = cs1.summary_type
       AND cs2.summary_date = cs1.summary_date 
       AND cs2.platform = cs1.platform 
       AND cs2.id != cs1.id
   )) as duplicates_found,
  (SELECT COUNT(*) FROM campaign_summaries 
   WHERE summary_type = 'weekly' 
   AND EXTRACT(DOW FROM summary_date) != 1) as non_monday_weeks;

