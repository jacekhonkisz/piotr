-- ============================================================================
-- DATA MISMATCH AUDIT - AUGUST vs SEPTEMBER 2025
-- ============================================================================
-- Purpose: Identify why August has campaign data but no conversions,
--          and September has conversions but no campaign data
-- ============================================================================

-- ============================================================================
-- 1. CHECK AUGUST 2025 DATA SOURCES
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔍 AUGUST 2025 (Sierpień) DATA AUDIT';
  RAISE NOTICE '============================================';
END $$;

-- Check campaign_summaries for August
SELECT 
  '📊 CAMPAIGN_SUMMARIES - AUGUST' as "Source",
  COUNT(*) as "Records",
  SUM(total_spend) as "Total Spend",
  SUM(total_impressions) as "Total Impressions",
  SUM(total_clicks) as "Total Clicks",
  SUM(click_to_call) as "Click to Call",
  SUM(email_contacts) as "Email Contacts",
  SUM(reservations) as "Reservations"
FROM campaign_summaries
WHERE summary_date = '2025-08-01'
  AND summary_type = 'monthly';

-- Check daily_kpi_data for August
SELECT 
  '📈 DAILY_KPI_DATA - AUGUST' as "Source",
  COUNT(DISTINCT date) as "Days with Data",
  COUNT(*) as "Total Records",
  SUM(total_spend) as "Total Spend",
  SUM(total_impressions) as "Total Impressions",
  SUM(total_clicks) as "Total Clicks",
  SUM(click_to_call) as "Click to Call",
  SUM(email_contacts) as "Email Contacts",
  SUM(reservations) as "Reservations"
FROM daily_kpi_data
WHERE date >= '2025-08-01' AND date <= '2025-08-31';

-- Check current_month_cache for August (if still there)
SELECT 
  '💾 CURRENT_MONTH_CACHE - AUGUST' as "Source",
  COUNT(*) as "Records",
  period_id,
  last_refreshed
FROM current_month_cache
WHERE period_id = '2025-08'
GROUP BY period_id, last_refreshed;

-- ============================================================================
-- 2. CHECK SEPTEMBER 2025 DATA SOURCES
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔍 SEPTEMBER 2025 (Wrzesień) DATA AUDIT';
  RAISE NOTICE '============================================';
END $$;

-- Check campaign_summaries for September
SELECT 
  '📊 CAMPAIGN_SUMMARIES - SEPTEMBER' as "Source",
  COUNT(*) as "Records",
  SUM(total_spend) as "Total Spend",
  SUM(total_impressions) as "Total Impressions",
  SUM(total_clicks) as "Total Clicks",
  SUM(click_to_call) as "Click to Call",
  SUM(email_contacts) as "Email Contacts",
  SUM(reservations) as "Reservations"
FROM campaign_summaries
WHERE summary_date = '2025-09-01'
  AND summary_type = 'monthly';

-- Check daily_kpi_data for September
SELECT 
  '📈 DAILY_KPI_DATA - SEPTEMBER' as "Source",
  COUNT(DISTINCT date) as "Days with Data",
  COUNT(*) as "Total Records",
  SUM(total_spend) as "Total Spend",
  SUM(total_impressions) as "Total Impressions",
  SUM(total_clicks) as "Total Clicks",
  SUM(click_to_call) as "Click to Call",
  SUM(email_contacts) as "Email Contacts",
  SUM(reservations) as "Reservations"
FROM daily_kpi_data
WHERE date >= '2025-09-01' AND date <= '2025-09-30';

-- ============================================================================
-- 3. DETAILED PER-CLIENT ANALYSIS FOR AUGUST
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '👥 PER-CLIENT ANALYSIS - AUGUST 2025';
  RAISE NOTICE '============================================';
END $$;

SELECT 
  c.name as "Client Name",
  cs.total_spend as "Campaign Spend",
  cs.total_impressions as "Impressions",
  cs.click_to_call as "CS Click to Call",
  cs.email_contacts as "CS Email Contacts",
  cs.reservations as "CS Reservations",
  (SELECT SUM(click_to_call) FROM daily_kpi_data 
   WHERE client_id = c.id AND date >= '2025-08-01' AND date <= '2025-08-31') as "Daily Click to Call",
  (SELECT SUM(email_contacts) FROM daily_kpi_data 
   WHERE client_id = c.id AND date >= '2025-08-01' AND date <= '2025-08-31') as "Daily Email Contacts",
  (SELECT SUM(reservations) FROM daily_kpi_data 
   WHERE client_id = c.id AND date >= '2025-08-01' AND date <= '2025-08-31') as "Daily Reservations"
FROM clients c
LEFT JOIN campaign_summaries cs ON cs.client_id = c.id 
  AND cs.summary_date = '2025-08-01' 
  AND cs.summary_type = 'monthly'
WHERE c.id IN (
  SELECT DISTINCT client_id FROM campaign_summaries 
  WHERE summary_date = '2025-08-01'
)
ORDER BY c.name;

-- ============================================================================
-- 4. DETAILED PER-CLIENT ANALYSIS FOR SEPTEMBER
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '👥 PER-CLIENT ANALYSIS - SEPTEMBER 2025';
  RAISE NOTICE '============================================';
END $$;

SELECT 
  c.name as "Client Name",
  cs.total_spend as "Campaign Spend",
  cs.total_impressions as "Impressions",
  cs.click_to_call as "CS Click to Call",
  cs.email_contacts as "CS Email Contacts",
  cs.reservations as "CS Reservations",
  (SELECT SUM(click_to_call) FROM daily_kpi_data 
   WHERE client_id = c.id AND date >= '2025-09-01' AND date <= '2025-09-30') as "Daily Click to Call",
  (SELECT SUM(email_contacts) FROM daily_kpi_data 
   WHERE client_id = c.id AND date >= '2025-09-01' AND date <= '2025-09-30') as "Daily Email Contacts",
  (SELECT SUM(reservations) FROM daily_kpi_data 
   WHERE client_id = c.id AND date >= '2025-09-01' AND date <= '2025-09-30') as "Daily Reservations"
FROM clients c
LEFT JOIN campaign_summaries cs ON cs.client_id = c.id 
  AND cs.summary_date = '2025-09-01' 
  AND cs.summary_type = 'monthly'
WHERE c.id IN (
  SELECT DISTINCT client_id FROM campaign_summaries 
  WHERE summary_date = '2025-09-01'
)
ORDER BY c.name;

-- ============================================================================
-- 5. CHECK FOR DATA INCONSISTENCIES
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '⚠️  DATA INCONSISTENCY CHECK';
  RAISE NOTICE '============================================';
END $$;

-- Check for campaign_summaries with spend but no conversions (AUGUST issue)
SELECT 
  'August: Campaign data without conversions' as "Issue Type",
  COUNT(*) as "Affected Records",
  SUM(total_spend) as "Total Spend",
  SUM(click_to_call + email_contacts + reservations) as "Total Conversions"
FROM campaign_summaries
WHERE summary_date = '2025-08-01'
  AND summary_type = 'monthly'
  AND total_spend > 0
  AND (click_to_call = 0 AND email_contacts = 0 AND reservations = 0);

-- Check for campaign_summaries with conversions but no spend (SEPTEMBER issue)
SELECT 
  'September: Conversions without campaign data' as "Issue Type",
  COUNT(*) as "Affected Records",
  SUM(total_spend) as "Total Spend",
  SUM(click_to_call + email_contacts + reservations) as "Total Conversions"
FROM campaign_summaries
WHERE summary_date = '2025-09-01'
  AND summary_type = 'monthly'
  AND total_spend = 0
  AND (click_to_call > 0 OR email_contacts > 0 OR reservations > 0);

-- ============================================================================
-- 6. CHECK CAMPAIGN_DATA JSONB FIELD
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📦 CAMPAIGN_DATA JSONB ANALYSIS';
  RAISE NOTICE '============================================';
END $$;

-- Check if campaign_data JSONB has conversion metrics embedded
SELECT 
  summary_date as "Month",
  COUNT(*) as "Records",
  COUNT(CASE WHEN campaign_data IS NOT NULL THEN 1 END) as "Has Campaign Data",
  COUNT(CASE WHEN campaign_data IS NULL THEN 1 END) as "Missing Campaign Data"
FROM campaign_summaries
WHERE summary_date IN ('2025-08-01', '2025-09-01')
  AND summary_type = 'monthly'
GROUP BY summary_date
ORDER BY summary_date DESC;

-- Sample campaign_data structure for one client (August)
SELECT 
  c.name as "Client",
  cs.total_spend,
  cs.click_to_call,
  cs.email_contacts,
  jsonb_pretty(cs.campaign_data) as "Campaign Data Sample"
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2025-08-01'
  AND cs.summary_type = 'monthly'
  AND cs.total_spend > 0
LIMIT 1;

-- ============================================================================
-- 7. CHECK DATA SOURCE FIELD
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔍 DATA SOURCE ANALYSIS';
  RAISE NOTICE '============================================';
END $$;

SELECT 
  summary_date as "Month",
  data_source as "Data Source",
  COUNT(*) as "Records",
  SUM(total_spend) as "Total Spend",
  SUM(click_to_call) as "Click to Call",
  SUM(email_contacts) as "Email Contacts"
FROM campaign_summaries
WHERE summary_date IN ('2025-08-01', '2025-09-01')
  AND summary_type = 'monthly'
GROUP BY summary_date, data_source
ORDER BY summary_date DESC, data_source;

-- ============================================================================
-- 8. RECOMMENDATIONS
-- ============================================================================
DO $$
DECLARE
  august_has_spend BOOLEAN;
  august_has_conversions BOOLEAN;
  september_has_spend BOOLEAN;
  september_has_conversions BOOLEAN;
  august_daily_conversions INTEGER;
  september_daily_conversions INTEGER;
BEGIN
  -- Check August
  SELECT 
    SUM(total_spend) > 0,
    SUM(click_to_call + email_contacts + reservations) > 0
  INTO august_has_spend, august_has_conversions
  FROM campaign_summaries
  WHERE summary_date = '2025-08-01' AND summary_type = 'monthly';
  
  -- Check September
  SELECT 
    SUM(total_spend) > 0,
    SUM(click_to_call + email_contacts + reservations) > 0
  INTO september_has_spend, september_has_conversions
  FROM campaign_summaries
  WHERE summary_date = '2025-09-01' AND summary_type = 'monthly';
  
  -- Check daily data
  SELECT 
    SUM(click_to_call + email_contacts + reservations)
  INTO august_daily_conversions
  FROM daily_kpi_data
  WHERE date >= '2025-08-01' AND date <= '2025-08-31';
  
  SELECT 
    SUM(click_to_call + email_contacts + reservations)
  INTO september_daily_conversions
  FROM daily_kpi_data
  WHERE date >= '2025-09-01' AND date <= '2025-09-30';
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 RECOMMENDATIONS:';
  RAISE NOTICE '============================================';
  
  -- August analysis
  IF august_has_spend AND NOT august_has_conversions THEN
    IF august_daily_conversions > 0 THEN
      RAISE NOTICE '🔴 AUGUST ISSUE: campaign_summaries missing conversion data';
      RAISE NOTICE '   → Conversion data exists in daily_kpi_data (% conversions)', august_daily_conversions;
      RAISE NOTICE '   → ACTION: Re-aggregate August from daily_kpi_data';
      RAISE NOTICE '   → RUN: UPDATE campaign_summaries SET conversions from daily data';
    ELSE
      RAISE NOTICE '🟡 AUGUST: No conversion data in any source';
      RAISE NOTICE '   → May indicate conversion tracking was not active in August';
    END IF;
  END IF;
  
  -- September analysis
  IF NOT september_has_spend AND september_has_conversions THEN
    RAISE NOTICE '🔴 SEPTEMBER ISSUE: campaign_summaries missing spend/impression data';
    RAISE NOTICE '   → Conversion data exists but campaign data missing';
    RAISE NOTICE '   → ACTION: Check if Meta Ads data was fetched for September';
    RAISE NOTICE '   → RUN: Fetch and update September campaign data';
  END IF;
  
  IF september_daily_conversions > 0 AND NOT september_has_conversions THEN
    RAISE NOTICE '🔴 SEPTEMBER: Daily data has conversions but monthly summary missing';
    RAISE NOTICE '   → ACTION: Re-aggregate September from daily_kpi_data';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🔧 FIX SCRIPTS NEEDED:';
  RAISE NOTICE '   1. FIX_AUGUST_CONVERSIONS.sql - Update August with conversion data';
  RAISE NOTICE '   2. FIX_SEPTEMBER_CAMPAIGNS.sql - Update September with campaign data';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- AUDIT COMPLETE
-- ============================================================================





