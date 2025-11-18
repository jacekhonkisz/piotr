-- Verify Week 39 (Sept 22) Belmonte - this week HAS daily_kpi_data
-- This is the REAL test of the unified priority fix

-- Query 1: Check daily_kpi_data for Week 39 (Sept 22-28, 2025)
SELECT 
  '🥇 PRIORITY 1: daily_kpi_data' as source,
  COUNT(*) as record_count,
  SUM(booking_step_1) as booking_step_1_total,
  SUM(booking_step_2) as booking_step_2_total,
  SUM(booking_step_3) as booking_step_3_total,
  SUM(reservations) as reservations_total,
  SUM(reservation_value) as reservation_value_total
FROM daily_kpi_data dkd
JOIN clients c ON c.id = dkd.client_id
WHERE c.name ILIKE '%belmonte%'
  AND dkd.date >= '2025-09-22' 
  AND dkd.date <= '2025-09-28'

UNION ALL

-- Query 2: Check campaign_summaries for Week 39 (what's stored in DB)
SELECT 
  '🥈 STORED: campaign_summaries' as source,
  1 as record_count,
  cs.booking_step_1 as booking_step_1_total,
  cs.booking_step_2 as booking_step_2_total,
  cs.booking_step_3 as booking_step_3_total,
  cs.reservations as reservations_total,
  cs.reservation_value as reservation_value_total
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_date = '2025-09-22'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
ORDER BY source;

-- Query 3: Comparison and expected result
SELECT 
  CASE 
    WHEN (
      SELECT SUM(booking_step_1) 
      FROM daily_kpi_data dkd
      JOIN clients c ON c.id = dkd.client_id
      WHERE c.name ILIKE '%belmonte%'
        AND dkd.date >= '2025-09-22' 
        AND dkd.date <= '2025-09-28'
    ) = (
      SELECT booking_step_1
      FROM campaign_summaries cs
      JOIN clients c ON c.id = cs.client_id
      WHERE c.name ILIKE '%belmonte%'
        AND cs.summary_date = '2025-09-22'
        AND cs.summary_type = 'weekly'
        AND cs.platform = 'meta'
    ) THEN '✅ VALUES MATCH - Fix working!'
    ELSE '⚠️ VALUES DIFFER - This is the test case!'
  END as comparison,
  (
    SELECT SUM(booking_step_1) 
    FROM daily_kpi_data dkd
    JOIN clients c ON c.id = dkd.client_id
    WHERE c.name ILIKE '%belmonte%'
      AND dkd.date >= '2025-09-22' 
      AND dkd.date <= '2025-09-28'
  ) as daily_kpi_value,
  (
    SELECT booking_step_1
    FROM campaign_summaries cs
    JOIN clients c ON c.id = cs.client_id
    WHERE c.name ILIKE '%belmonte%'
      AND cs.summary_date = '2025-09-22'
      AND cs.summary_type = 'weekly'
      AND cs.platform = 'meta'
  ) as stored_value,
  'UI should show daily_kpi_value (4088) not stored_value' as expected_behavior;

