-- ============================================================================
-- AUDIT: Google Ads Weekly Booking Steps Issues
-- ============================================================================
-- This script audits why some clients have spend but no booking steps
-- ============================================================================

-- PART 1: Find clients with spend but no booking steps
SELECT 
  '1️⃣ CLIENTS WITH SPEND BUT NO BOOKING STEPS' as section,
  c.name as client_name,
  cs.summary_date,
  cs.total_spend,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  TO_CHAR(cs.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
  CASE 
    WHEN cs.total_spend > 0 AND cs.booking_step_1 = 0 THEN '⚠️ ISSUE: Has spend but NO booking steps'
    ELSE '✅ OK'
  END as issue_status
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
  AND cs.total_spend > 0
  AND cs.booking_step_1 = 0
ORDER BY cs.summary_date DESC, cs.total_spend DESC;

-- PART 2: Check campaign_data JSONB for booking steps
SELECT 
  '2️⃣ CAMPAIGN DATA INSPECTION' as section,
  c.name as client_name,
  cs.summary_date,
  cs.total_spend,
  cs.booking_step_1 as summary_step1,
  cs.booking_step_2 as summary_step2,
  cs.booking_step_3 as summary_step3,
  -- Check if campaigns in JSONB have booking steps
  (
    SELECT SUM((campaign->>'booking_step_1')::numeric)
    FROM jsonb_array_elements(cs.campaign_data) as campaign
  ) as campaigns_step1_total,
  (
    SELECT SUM((campaign->>'booking_step_2')::numeric)
    FROM jsonb_array_elements(cs.campaign_data) as campaign
  ) as campaigns_step2_total,
  (
    SELECT SUM((campaign->>'booking_step_3')::numeric)
    FROM jsonb_array_elements(cs.campaign_data) as campaign
  ) as campaigns_step3_total,
  -- Sample campaign data
  cs.campaign_data->0->>'campaignName' as sample_campaign_name,
  (cs.campaign_data->0->>'booking_step_1')::numeric as sample_campaign_step1,
  (cs.campaign_data->0->>'spend')::numeric as sample_campaign_spend
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
  AND cs.total_spend > 0
  AND cs.booking_step_1 = 0
ORDER BY cs.summary_date DESC
LIMIT 10;

-- PART 3: Compare with recent weeks that DO have booking steps
SELECT 
  '3️⃣ COMPARISON: Weeks WITH booking steps' as section,
  c.name as client_name,
  cs.summary_date,
  cs.total_spend,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  TO_CHAR(cs.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
  AND cs.total_spend > 0
  AND cs.booking_step_1 > 0
ORDER BY cs.summary_date DESC
LIMIT 10;

-- PART 4: Check data_source field
SELECT 
  '4️⃣ DATA SOURCE VERIFICATION' as section,
  cs.data_source,
  COUNT(*) as record_count,
  SUM(CASE WHEN cs.booking_step_1 > 0 THEN 1 ELSE 0 END) as with_steps,
  SUM(CASE WHEN cs.total_spend > 0 AND cs.booking_step_1 = 0 THEN 1 ELSE 0 END) as missing_steps,
  ROUND(100.0 * SUM(CASE WHEN cs.booking_step_1 > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) as pct_with_steps
FROM campaign_summaries cs
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
GROUP BY cs.data_source;

