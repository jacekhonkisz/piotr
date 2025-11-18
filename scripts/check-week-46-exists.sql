-- Check what data exists for Week 46 (2025-11-10 to 2025-11-16)
SELECT 
  'campaign_summaries' as table_name,
  period_id,
  period_type,
  summary_type,
  summary_date,
  platform,
  COUNT(*) as record_count,
  SUM(total_spend) as total_spend
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND (
    period_id = '2025-W46'
    OR summary_date BETWEEN '2025-11-10' AND '2025-11-16'
    OR (summary_type = 'weekly' AND summary_date >= '2025-11-10' AND summary_date <= '2025-11-16')
  )
GROUP BY period_id, period_type, summary_type, summary_date, platform
ORDER BY summary_date DESC;

-- Also check the structure of the table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'campaign_summaries'
ORDER BY ordinal_position;
