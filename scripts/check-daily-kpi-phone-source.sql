-- Check daily_kpi_data for Havet January 2026
-- This is the source that might be causing the 12 phones issue

SELECT 
  'DAILY_KPI_DATA CHECK' as check_name,
  date,
  click_to_call,
  email_contacts,
  data_source,
  platform,
  created_at
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND date >= '2026-01-01'
  AND date <= '2026-01-31'
  AND platform = 'meta'
ORDER BY date DESC;

-- Sum total
SELECT 
  'TOTAL FROM DAILY_KPI_DATA' as check_name,
  SUM(click_to_call) as total_click_to_call,
  COUNT(*) as record_count,
  STRING_AGG(DISTINCT data_source, ', ') as data_sources
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND date >= '2026-01-01'
  AND date <= '2026-01-31'
  AND platform = 'meta';

