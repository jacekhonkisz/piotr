-- ============================================================================
-- IDENTIFY MISSING GOOGLE ADS WEEKS FOR ALL CLIENTS
-- ============================================================================
-- This script identifies which weeks are missing for each client
-- ============================================================================

-- PART 1: Generate expected weeks (last 53 weeks)
WITH expected_weeks AS (
  SELECT 
    DATE_TRUNC('week', CURRENT_DATE - (n || ' weeks')::INTERVAL)::DATE as week_monday
  FROM generate_series(0, 52) n
),
clients_with_google AS (
  SELECT DISTINCT c.id, c.name
  FROM clients c
  WHERE c.google_ads_customer_id IS NOT NULL
),
expected_weeks_per_client AS (
  SELECT 
    c.id as client_id,
    c.name as client_name,
    ew.week_monday
  FROM clients_with_google c
  CROSS JOIN expected_weeks ew
),
actual_weeks AS (
  SELECT 
    cs.client_id,
    cs.summary_date as week_monday
  FROM campaign_summaries cs
  WHERE cs.platform = 'google'
    AND cs.summary_type = 'weekly'
)
SELECT 
  '1️⃣ MISSING WEEKS BY CLIENT' as section,
  ewc.client_name,
  ewc.week_monday,
  CASE 
    WHEN aw.week_monday IS NULL THEN '❌ MISSING'
    ELSE '✅ EXISTS'
  END as status
FROM expected_weeks_per_client ewc
LEFT JOIN actual_weeks aw ON aw.client_id = ewc.client_id 
  AND aw.week_monday = ewc.week_monday
WHERE aw.week_monday IS NULL
ORDER BY ewc.client_name, ewc.week_monday DESC;

-- PART 2: Summary by client
WITH expected_weeks AS (
  SELECT 
    DATE_TRUNC('week', CURRENT_DATE - (n || ' weeks')::INTERVAL)::DATE as week_monday
  FROM generate_series(0, 52) n
),
clients_with_google AS (
  SELECT DISTINCT c.id, c.name
  FROM clients c
  WHERE c.google_ads_customer_id IS NOT NULL
),
expected_weeks_per_client AS (
  SELECT 
    c.id as client_id,
    c.name as client_name,
    COUNT(*) as expected_weeks
  FROM clients_with_google c
  CROSS JOIN expected_weeks ew
  GROUP BY c.id, c.name
),
actual_weeks AS (
  SELECT 
    cs.client_id,
    COUNT(DISTINCT cs.summary_date) as actual_weeks
  FROM campaign_summaries cs
  WHERE cs.platform = 'google'
    AND cs.summary_type = 'weekly'
  GROUP BY cs.client_id
)
SELECT 
  '2️⃣ SUMMARY BY CLIENT' as section,
  ewc.client_name,
  ewc.expected_weeks,
  COALESCE(aw.actual_weeks, 0) as actual_weeks,
  ewc.expected_weeks - COALESCE(aw.actual_weeks, 0) as missing_weeks,
  ROUND(100.0 * COALESCE(aw.actual_weeks, 0) / ewc.expected_weeks, 1) as completion_pct,
  CASE 
    WHEN COALESCE(aw.actual_weeks, 0) = ewc.expected_weeks THEN '✅ COMPLETE'
    WHEN COALESCE(aw.actual_weeks, 0) >= ewc.expected_weeks * 0.8 THEN '🟡 MOSTLY COMPLETE'
    WHEN COALESCE(aw.actual_weeks, 0) > 0 THEN '🟠 PARTIAL'
    ELSE '❌ NO DATA'
  END as status
FROM expected_weeks_per_client ewc
LEFT JOIN actual_weeks aw ON aw.client_id = ewc.client_id
ORDER BY missing_weeks DESC, ewc.client_name;

