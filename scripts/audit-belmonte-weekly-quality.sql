-- Comprehensive audit of Belmonte weekly data quality
-- Check for duplicates, missing metrics, and smart caching issues

-- 1. Check for DUPLICATE weeks
SELECT 
  cs.summary_date,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(cs.id) as summary_ids,
  ARRAY_AGG(cs.created_at ORDER BY cs.created_at) as creation_times
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
GROUP BY cs.summary_date
HAVING COUNT(*) > 1
ORDER BY cs.summary_date DESC
LIMIT 20;

-- 2. Check recent weeks - are ALL conversion metrics populated?
SELECT 
  cs.summary_date,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.click_to_call,
  cs.email_contacts,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  cs.reservation_value,
  cs.roas,
  cs.cost_per_reservation,
  CASE 
    WHEN cs.booking_step_1 = 0 AND cs.booking_step_2 = 0 AND cs.booking_step_3 = 0 
    THEN '❌ Missing booking steps'
    ELSE '✅ Has booking steps'
  END as booking_steps_status,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
ORDER BY cs.summary_date DESC
LIMIT 10;

-- 3. Check if campaign_data (JSON) is populated
SELECT 
  cs.summary_date,
  cs.campaign_data IS NOT NULL as has_campaign_data,
  CASE 
    WHEN cs.campaign_data IS NOT NULL 
    THEN jsonb_array_length(cs.campaign_data::jsonb)
    ELSE 0
  END as campaign_count,
  cs.total_spend,
  cs.reservations,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
ORDER BY cs.summary_date DESC
LIMIT 10;

-- 4. Count weeks by month to see distribution
SELECT 
  DATE_TRUNC('month', cs.summary_date) as month,
  COUNT(*) as weeks_in_month
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
GROUP BY DATE_TRUNC('month', cs.summary_date)
ORDER BY month DESC;

-- 5. Check current week specifically (should be from smart cache)
SELECT 
  cs.summary_date,
  cs.total_spend,
  cs.reservations,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.created_at,
  cs.id,
  CASE 
    WHEN cs.summary_date >= DATE_TRUNC('week', CURRENT_DATE) 
    THEN '🟢 CURRENT WEEK (should use smart cache)'
    ELSE '⚪ HISTORICAL WEEK (should use database)'
  END as week_type
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= CURRENT_DATE - INTERVAL '2 weeks'
ORDER BY cs.summary_date DESC;

