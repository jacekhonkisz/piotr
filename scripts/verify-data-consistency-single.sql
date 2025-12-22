-- ============================================================================
-- VERIFICATION SCRIPT: Data Consistency Check (SINGLE QUERY VERSION)
-- ============================================================================
-- Purpose: All checks combined into one result set for API/tool compatibility
-- ============================================================================

WITH 
-- Check 1: October 2025 Comparison
october_comparison AS (
  SELECT 
    '1. October 2025 - Belmonte' as check_name,
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
  
  SELECT 
    '1. October 2025 - Belmonte' as check_name,
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
  
  SELECT 
    '1. October 2025 - Belmonte' as check_name,
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
),

-- Check 2: Missing Days Count
missing_days_count AS (
  SELECT 
    '2. Missing Days Check' as check_name,
    COUNT(*) FILTER (WHERE dkd.date IS NULL) as missing_days,
    COUNT(*) FILTER (WHERE dkd.date IS NOT NULL) as present_days,
    31 as expected_days,
    CASE 
      WHEN COUNT(*) FILTER (WHERE dkd.date IS NULL) = 0 THEN '✅ Complete'
      ELSE '❌ Missing ' || COUNT(*) FILTER (WHERE dkd.date IS NULL) || ' days'
    END as status
  FROM generate_series(0, 30) AS day_offset
  LEFT JOIN daily_kpi_data dkd 
    ON dkd.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND dkd.platform = 'meta'
    AND dkd.date = ('2025-10-01'::date + day_offset)
),

-- Check 3: Monthly Consistency Summary
monthly_consistency AS (
  SELECT 
    '3. Data Completeness by Month' as check_name,
    COUNT(*) as total_months_checked,
    COUNT(*) FILTER (WHERE consistency = 'match') as matching_months,
    COUNT(*) FILTER (WHERE consistency = 'mismatch') as mismatched_months,
    COUNT(*) FILTER (WHERE consistency = 'no_data') as months_with_no_data,
    CASE 
      WHEN COUNT(*) FILTER (WHERE consistency = 'mismatch') = 0 THEN '✅ All Match'
      ELSE '⚠️ ' || COUNT(*) FILTER (WHERE consistency = 'mismatch') || ' mismatches'
    END as status
  FROM (
    SELECT 
      cs.client_id,
      cs.summary_date,
      CASE 
        WHEN cs.total_spend = 0 AND (
          SELECT SUM(total_spend)
          FROM daily_kpi_data
          WHERE client_id = cs.client_id
            AND platform = cs.platform
            AND date >= cs.summary_date
            AND date < (cs.summary_date + INTERVAL '1 month')::date
        ) IS NULL THEN 'no_data'
        WHEN ABS(cs.total_spend - COALESCE((
          SELECT SUM(total_spend)
          FROM daily_kpi_data
          WHERE client_id = cs.client_id
            AND platform = cs.platform
            AND date >= cs.summary_date
            AND date < (cs.summary_date + INTERVAL '1 month')::date
        ), 0)) < 0.01 THEN 'match'
        ELSE 'mismatch'
      END as consistency
    FROM campaign_summaries cs
    WHERE cs.summary_type = 'monthly'
      AND cs.summary_date >= '2025-09-01'
  ) consistency_check
),

-- Check 4: Weekly Consistency Summary
weekly_consistency AS (
  SELECT 
    '4. Weekly vs Daily Consistency' as check_name,
    COUNT(*) as total_weeks_checked,
    COUNT(*) FILTER (WHERE consistency = 'match') as matching_weeks,
    COUNT(*) FILTER (WHERE consistency = 'mismatch') as mismatched_weeks,
    CASE 
      WHEN COUNT(*) FILTER (WHERE consistency = 'mismatch') = 0 THEN '✅ All Match'
      WHEN COUNT(*) FILTER (WHERE consistency = 'mismatch') <= COUNT(*) * 0.2 THEN '⚠️ ' || COUNT(*) FILTER (WHERE consistency = 'mismatch') || ' mismatches (Normal)'
      ELSE '❌ ' || COUNT(*) FILTER (WHERE consistency = 'mismatch') || ' mismatches'
    END as status
  FROM (
    SELECT 
      cs.client_id,
      cs.summary_date,
      CASE 
        WHEN ABS(cs.total_spend - COALESCE((
          SELECT SUM(total_spend)
          FROM daily_kpi_data
          WHERE client_id = cs.client_id
            AND platform = cs.platform
            AND date >= cs.summary_date
            AND date < (cs.summary_date + INTERVAL '7 days')::date
        ), 0)) < 0.01 THEN 'match'
        ELSE 'mismatch'
      END as consistency
    FROM campaign_summaries cs
    WHERE cs.summary_type = 'weekly'
      AND cs.summary_date >= '2025-10-01'
      AND cs.summary_date < '2025-11-01'
  ) weekly_check
),

-- Check 5: Non-Monday Weeks
non_monday_weeks AS (
  SELECT 
    '5. Non-Monday Weekly Dates' as check_name,
    COUNT(*) as non_monday_count,
    CASE 
      WHEN COUNT(*) = 0 THEN '✅ All Mondays'
      ELSE '❌ ' || COUNT(*) || ' non-Monday weeks found'
    END as status
  FROM campaign_summaries
  WHERE summary_type = 'weekly'
    AND EXTRACT(DOW FROM summary_date) != 1
),

-- Check 6: Overall Health (you already have this!)
overall_health AS (
  SELECT 
    '6. Overall System Health' as check_name,
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
     AND EXTRACT(DOW FROM summary_date) != 1) as non_monday_weeks
)

-- Combine all checks into single result
SELECT 
  check_name,
  status,
  json_build_object(
    'details', CASE check_name
      WHEN '1. October 2025 - Belmonte' THEN (
        SELECT json_agg(json_build_object(
          'source', source,
          'total_spend', total_spend,
          'reservations', reservations,
          'record_count', record_count
        ))
        FROM october_comparison
      )
      WHEN '2. Missing Days Check' THEN (
        SELECT json_build_object(
          'missing_days', missing_days,
          'present_days', present_days,
          'expected_days', expected_days
        )
        FROM missing_days_count
      )
      WHEN '3. Data Completeness by Month' THEN (
        SELECT json_build_object(
          'total_months', total_months_checked,
          'matching', matching_months,
          'mismatched', mismatched_months,
          'no_data', months_with_no_data
        )
        FROM monthly_consistency
      )
      WHEN '4. Weekly vs Daily Consistency' THEN (
        SELECT json_build_object(
          'total_weeks', total_weeks_checked,
          'matching', matching_weeks,
          'mismatched', mismatched_weeks
        )
        FROM weekly_consistency
      )
      WHEN '5. Non-Monday Weekly Dates' THEN (
        SELECT json_build_object(
          'non_monday_count', non_monday_count
        )
        FROM non_monday_weeks
      )
      WHEN '6. Overall System Health' THEN (
        SELECT json_build_object(
          'null_platforms', null_platforms,
          'duplicates_found', duplicates_found,
          'non_monday_weeks', non_monday_weeks
        )
        FROM overall_health
      )
    END
  ) as details
FROM (
  SELECT check_name, status FROM (VALUES 
    ('1. October 2025 - Belmonte', NULL),
    ('2. Missing Days Check', NULL),
    ('3. Data Completeness by Month', NULL),
    ('4. Weekly vs Daily Consistency', NULL),
    ('5. Non-Monday Weekly Dates', NULL),
    ('6. Overall System Health', NULL)
  ) AS checks(check_name, status)
) all_checks
LEFT JOIN (
  SELECT check_name, status FROM october_comparison LIMIT 1
  UNION ALL SELECT * FROM missing_days_count
  UNION ALL SELECT * FROM monthly_consistency
  UNION ALL SELECT * FROM weekly_consistency  
  UNION ALL SELECT * FROM non_monday_weeks
  UNION ALL SELECT * FROM overall_health
) check_results USING (check_name)
ORDER BY check_name;



