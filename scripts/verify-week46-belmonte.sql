-- Verify Week 46 Belmonte data matches across all sources
-- This tests if the unified priority logic is working

-- Query 1: Check daily_kpi_data for Week 46 (Nov 10-16, 2025)
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
  AND dkd.date >= '2025-11-10' 
  AND dkd.date <= '2025-11-16'

UNION ALL

-- Query 2: Check campaign_summaries for Week 46 (what's stored in DB)
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
  AND cs.summary_date = '2025-11-10'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
ORDER BY source;

