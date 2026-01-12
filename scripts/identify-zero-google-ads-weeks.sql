-- ============================================================================
-- IDENTIFY GOOGLE ADS WEEKS WITH ZERO DATA
-- ============================================================================
-- This script finds weeks that exist but have 0 spend or missing data
-- ============================================================================

-- PART 1: Weeks with zero spend
SELECT 
  '1️⃣ WEEKS WITH ZERO SPEND' as section,
  c.name as client_name,
  cs.summary_date,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  TO_CHAR(cs.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
  AND cs.total_spend = 0
ORDER BY cs.summary_date DESC, c.name
LIMIT 50;

-- PART 2: Weeks with spend but no booking steps (might be missing conversion data)
SELECT 
  '2️⃣ WEEKS WITH SPEND BUT NO BOOKING STEPS' as section,
  c.name as client_name,
  cs.summary_date,
  cs.total_spend,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  CASE 
    WHEN cs.total_spend > 0 AND cs.booking_step_1 = 0 THEN '⚠️ Has spend but NO steps'
    ELSE '✅ OK'
  END as issue_status
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
  AND cs.total_spend > 0
  AND cs.booking_step_1 = 0
ORDER BY cs.summary_date DESC, cs.total_spend DESC
LIMIT 50;

-- PART 3: Weeks with empty campaign_data
SELECT 
  '3️⃣ WEEKS WITH EMPTY CAMPAIGN DATA' as section,
  c.name as client_name,
  cs.summary_date,
  cs.total_spend,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  CASE 
    WHEN jsonb_array_length(cs.campaign_data) = 0 THEN '❌ Empty campaigns'
    ELSE '✅ Has campaigns'
  END as status
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
  AND (
    cs.campaign_data IS NULL 
    OR jsonb_array_length(cs.campaign_data) = 0
  )
ORDER BY cs.summary_date DESC, c.name
LIMIT 50;

-- PART 4: Summary by client
SELECT 
  '4️⃣ ZERO DATA SUMMARY BY CLIENT' as section,
  c.name as client_name,
  COUNT(*) FILTER (WHERE cs.total_spend = 0) as zero_spend_weeks,
  COUNT(*) FILTER (WHERE cs.total_spend > 0 AND cs.booking_step_1 = 0) as weeks_missing_steps,
  COUNT(*) FILTER (WHERE cs.campaign_data IS NULL OR jsonb_array_length(cs.campaign_data) = 0) as weeks_empty_campaigns,
  COUNT(*) as total_weeks,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cs.total_spend = 0) / COUNT(*), 1) as pct_zero_spend,
  CASE 
    WHEN COUNT(*) FILTER (WHERE cs.total_spend = 0) > COUNT(*) * 0.5 THEN '❌ Mostly zeros'
    WHEN COUNT(*) FILTER (WHERE cs.total_spend = 0) > 0 THEN '🟡 Some zeros'
    ELSE '✅ All have data'
  END as status
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
GROUP BY c.id, c.name
ORDER BY zero_spend_weeks DESC, c.name;

