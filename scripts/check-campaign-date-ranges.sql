-- Check if campaigns have 7-day ranges (weekly) or 30-day ranges (monthly)

SELECT 
  cs.summary_date as week_start,
  cs.summary_type,
  cs.total_spend,
  cs.reservations,
  -- Extract first campaign's date range
  (cs.campaign_data::jsonb->0->>'date_start') as first_campaign_start,
  (cs.campaign_data::jsonb->0->>'date_stop') as first_campaign_stop,
  -- Calculate days between dates
  (DATE (cs.campaign_data::jsonb->0->>'date_stop') - 
   DATE (cs.campaign_data::jsonb->0->>'date_start'))::integer as days_in_range,
  jsonb_array_length(cs.campaign_data::jsonb) as campaign_count
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-11-01'
ORDER BY cs.summary_date DESC;

-- Expected: days_in_range should be 6 (Monday to Sunday = 7 days, 0-indexed = 6)
-- If it's 30 or close to month length, then it's monthly data



