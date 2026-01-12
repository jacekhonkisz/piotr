-- ============================================================================
-- CHECK HAVET WEEKLY GOOGLE ADS DATA
-- ============================================================================
-- This script checks if Havet has weekly Google Ads data in the database
-- ============================================================================

-- PART 1: Check if Havet has any weekly Google Ads data
SELECT 
  '1️⃣ HAVET WEEKLY GOOGLE ADS DATA' as section,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  TO_CHAR(cs.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
  TO_CHAR(cs.last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%havet%'
  AND cs.platform = 'google'
  AND cs.summary_type = 'weekly'
ORDER BY cs.summary_date DESC
LIMIT 20;

-- PART 2: Check specific week 2025-W01 (Dec 30, 2024 - Jan 5, 2025)
-- Week 2025-W01 starts on Monday Dec 30, 2024
SELECT 
  '2️⃣ WEEK 2025-W01 CHECK' as section,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  CASE 
    WHEN cs.summary_date = '2024-12-30' THEN '✅ Found week 2025-W01'
    ELSE '⚠️ Different date'
  END as week_status
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%havet%'
  AND cs.platform = 'google'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= '2024-12-30'
  AND cs.summary_date <= '2025-01-05'
ORDER BY cs.summary_date;

-- PART 3: Check weekly cache for Havet
SELECT 
  '3️⃣ HAVET WEEKLY CACHE' as section,
  gw.period_id,
  TO_CHAR(gw.last_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_last_updated,
  EXTRACT(EPOCH FROM (NOW() - gw.last_updated))/3600 as cache_age_hours,
  (gw.cache_data->'stats'->>'totalSpend')::numeric as cache_spend,
  (gw.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_step1,
  jsonb_array_length(gw.cache_data->'campaigns') as campaign_count
FROM google_ads_current_week_cache gw
INNER JOIN clients c ON c.id = gw.client_id
WHERE c.name ILIKE '%havet%'
ORDER BY gw.last_updated DESC;

-- PART 4: Check Havet client configuration
SELECT 
  '4️⃣ HAVET CLIENT CONFIG' as section,
  c.name,
  c.google_ads_enabled,
  c.google_ads_customer_id,
  c.google_ads_refresh_token IS NOT NULL as has_refresh_token,
  c.api_status
FROM clients c
WHERE c.name ILIKE '%havet%';

