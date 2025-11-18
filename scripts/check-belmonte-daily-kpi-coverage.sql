-- Check if Belmonte has ANY daily_kpi_data
-- This will show us the date coverage

-- 1. Check date range coverage
SELECT 
  'Belmonte daily_kpi_data coverage' as info,
  COUNT(*) as total_records,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(DISTINCT date) as unique_days
FROM daily_kpi_data dkd
JOIN clients c ON c.id = dkd.client_id
WHERE c.name ILIKE '%belmonte%';

-- 2. Check recent weeks coverage
SELECT 
  DATE_TRUNC('week', dkd.date)::date as week_start,
  COUNT(*) as days_with_data,
  SUM(booking_step_1) as booking_step_1_total,
  SUM(booking_step_2) as booking_step_2_total,
  SUM(reservations) as reservations_total
FROM daily_kpi_data dkd
JOIN clients c ON c.id = dkd.client_id
WHERE c.name ILIKE '%belmonte%'
  AND dkd.date >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY DATE_TRUNC('week', dkd.date)
ORDER BY week_start DESC
LIMIT 10;

-- 3. Check November 2025 specifically
SELECT 
  date,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value
FROM daily_kpi_data dkd
JOIN clients c ON c.id = dkd.client_id
WHERE c.name ILIKE '%belmonte%'
  AND date >= '2025-11-01'
  AND date <= '2025-11-30'
ORDER BY date DESC;

