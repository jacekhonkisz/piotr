-- Check if there are MULTIPLE entries for the same week
-- This would explain the over-aggregated totals in Week 2025-11-03

SELECT 
  summary_date,
  summary_type,
  platform,
  COUNT(*) AS entry_count,
  
  -- Show all IDs for this week
  array_agg(id ORDER BY created_at) AS all_ids,
  array_agg(created_at ORDER BY created_at) AS all_created_at,
  
  -- Show totals from each entry
  array_agg(total_spend ORDER BY created_at) AS all_spends,
  array_agg(booking_step_1 ORDER BY created_at) AS all_step1s,
  array_agg(jsonb_array_length(campaign_data) ORDER BY created_at) AS all_campaign_counts,
  
  CASE 
    WHEN COUNT(*) > 1 THEN '🔴 DUPLICATE - DELETE OLD ENTRIES!'
    ELSE '✅ OK'
  END AS status
  
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel' LIMIT 1)
  AND platform = 'meta'
  AND summary_type = 'weekly'
  AND summary_date >= '2025-11-01' 
  AND summary_date < '2025-12-01'
GROUP BY summary_date, summary_type, platform
ORDER BY summary_date;

