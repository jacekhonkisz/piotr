-- ============================================================================
-- FIX SEPTEMBER 2025 - ADD MISSING CAMPAIGN DATA
-- ============================================================================
-- Purpose: Update campaign_summaries for September 2025 with campaign metrics
--          (spend, impressions, clicks) from daily_kpi_data
-- Safety: Updates existing records, adds missing campaign metrics
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔧 FIXING SEPTEMBER 2025 CAMPAIGN DATA';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- 1. CHECK IF DAILY DATA HAS CAMPAIGN METRICS
-- ============================================================================
DO $$
DECLARE
  daily_has_data BOOLEAN;
  daily_spend DECIMAL;
BEGIN
  SELECT 
    SUM(total_spend) > 0,
    SUM(total_spend)
  INTO daily_has_data, daily_spend
  FROM daily_kpi_data
  WHERE date >= '2025-09-01' AND date <= '2025-09-30';
  
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Daily KPI Data Check:';
  IF daily_has_data THEN
    RAISE NOTICE '   ✅ Daily data has campaign metrics (Spend: % zł)', daily_spend;
    RAISE NOTICE '   → Will update from daily_kpi_data';
  ELSE
    RAISE NOTICE '   ❌ Daily data missing campaign metrics';
    RAISE NOTICE '   → Will need to fetch from Meta Ads API';
  END IF;
END $$;

-- ============================================================================
-- 2. BACKUP CURRENT STATE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📦 Creating backup of current September data...';
END $$;

CREATE TEMP TABLE IF NOT EXISTS september_backup AS
SELECT * FROM campaign_summaries 
WHERE summary_date = '2025-09-01' AND summary_type = 'monthly';

-- ============================================================================
-- 3. UPDATE SEPTEMBER campaign_summaries WITH CAMPAIGN DATA
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Updating September campaign data from daily_kpi_data...';
END $$;

UPDATE campaign_summaries cs
SET 
  total_spend = COALESCE((
    SELECT SUM(total_spend) 
    FROM daily_kpi_data 
    WHERE client_id = cs.client_id 
      AND date >= '2025-09-01' 
      AND date <= '2025-09-30'
      AND platform = cs.platform
  ), 0),
  
  total_impressions = COALESCE((
    SELECT SUM(total_impressions) 
    FROM daily_kpi_data 
    WHERE client_id = cs.client_id 
      AND date >= '2025-09-01' 
      AND date <= '2025-09-30'
      AND platform = cs.platform
  ), 0),
  
  total_clicks = COALESCE((
    SELECT SUM(total_clicks) 
    FROM daily_kpi_data 
    WHERE client_id = cs.client_id 
      AND date >= '2025-09-01' 
      AND date <= '2025-09-30'
      AND platform = cs.platform
  ), 0),
  
  total_conversions = COALESCE((
    SELECT SUM(total_conversions) 
    FROM daily_kpi_data 
    WHERE client_id = cs.client_id 
      AND date >= '2025-09-01' 
      AND date <= '2025-09-30'
      AND platform = cs.platform
  ), 0),
  
  -- Update calculated metrics
  average_ctr = CASE 
    WHEN (SELECT SUM(total_impressions) FROM daily_kpi_data 
          WHERE client_id = cs.client_id AND date >= '2025-09-01' AND date <= '2025-09-30') > 0
    THEN (
      (SELECT SUM(total_clicks) FROM daily_kpi_data 
       WHERE client_id = cs.client_id AND date >= '2025-09-01' AND date <= '2025-09-30')::DECIMAL / 
      (SELECT SUM(total_impressions) FROM daily_kpi_data 
       WHERE client_id = cs.client_id AND date >= '2025-09-01' AND date <= '2025-09-30')
    ) * 100
    ELSE 0
  END,
  
  average_cpc = CASE 
    WHEN (SELECT SUM(total_clicks) FROM daily_kpi_data 
          WHERE client_id = cs.client_id AND date >= '2025-09-01' AND date <= '2025-09-30') > 0
    THEN (
      (SELECT SUM(total_spend) FROM daily_kpi_data 
       WHERE client_id = cs.client_id AND date >= '2025-09-01' AND date <= '2025-09-30') / 
      (SELECT SUM(total_clicks) FROM daily_kpi_data 
       WHERE client_id = cs.client_id AND date >= '2025-09-01' AND date <= '2025-09-30')
    )
    ELSE 0
  END,
  
  average_cpa = CASE 
    WHEN (SELECT SUM(reservations) FROM daily_kpi_data 
          WHERE client_id = cs.client_id AND date >= '2025-09-01' AND date <= '2025-09-30') > 0
    THEN (
      (SELECT SUM(total_spend) FROM daily_kpi_data 
       WHERE client_id = cs.client_id AND date >= '2025-09-01' AND date <= '2025-09-30') / 
      (SELECT SUM(reservations) FROM daily_kpi_data 
       WHERE client_id = cs.client_id AND date >= '2025-09-01' AND date <= '2025-09-30')
    )
    ELSE 0
  END,
  
  last_updated = NOW()

WHERE cs.summary_date = '2025-09-01' 
  AND cs.summary_type = 'monthly';

-- ============================================================================
-- 4. VERIFY THE FIX
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Verification:';
END $$;

SELECT 
  '📊 SEPTEMBER AFTER FIX' as "Status",
  COUNT(*) as "Total Records",
  SUM(total_spend) as "Total Spend",
  SUM(total_impressions) as "Total Impressions",
  SUM(total_clicks) as "Total Clicks",
  SUM(click_to_call) as "Click to Call",
  SUM(email_contacts) as "Email Contacts",
  SUM(reservations) as "Reservations"
FROM campaign_summaries
WHERE summary_date = '2025-09-01'
  AND summary_type = 'monthly';

-- Show per-client update results
SELECT 
  c.name as "Client",
  cs.total_spend as "Spend",
  cs.total_impressions as "Impressions",
  cs.total_clicks as "Clicks",
  cs.click_to_call as "Click to Call",
  cs.email_contacts as "Emails",
  cs.reservations as "Reservations",
  CASE 
    WHEN cs.total_spend > 0 THEN 'Has Data'
    ELSE 'Missing Data'
  END as "Status"
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2025-09-01'
  AND cs.summary_type = 'monthly'
ORDER BY cs.total_spend DESC;

-- ============================================================================
-- 5. CHECK FOR CLIENTS STILL MISSING DATA
-- ============================================================================
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM campaign_summaries
  WHERE summary_date = '2025-09-01'
    AND summary_type = 'monthly'
    AND total_spend = 0;
  
  IF missing_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  WARNING: % clients still have zero spend', missing_count;
    RAISE NOTICE '   → This means daily_kpi_data is also missing campaign metrics';
    RAISE NOTICE '   → Need to fetch from Meta Ads API';
  END IF;
END $$;

-- List clients that still need data
SELECT 
  c.name as "Client Missing Data",
  cs.click_to_call as "Has Conversions?",
  'Needs Meta Ads Fetch' as "Action Required"
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2025-09-01'
  AND cs.summary_type = 'monthly'
  AND cs.total_spend = 0
  AND (cs.click_to_call > 0 OR cs.email_contacts > 0);

-- ============================================================================
-- 6. FINAL SUMMARY
-- ============================================================================
DO $$
DECLARE
  records_updated INTEGER;
  records_with_data INTEGER;
  records_still_missing INTEGER;
BEGIN
  SELECT COUNT(*) INTO records_updated
  FROM campaign_summaries
  WHERE summary_date = '2025-09-01' 
    AND summary_type = 'monthly'
    AND last_updated >= NOW() - INTERVAL '1 minute';
  
  SELECT COUNT(*) INTO records_with_data
  FROM campaign_summaries
  WHERE summary_date = '2025-09-01' 
    AND summary_type = 'monthly'
    AND total_spend > 0;
  
  SELECT COUNT(*) INTO records_still_missing
  FROM campaign_summaries
  WHERE summary_date = '2025-09-01' 
    AND summary_type = 'monthly'
    AND total_spend = 0;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ SEPTEMBER FIX COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Records updated: %', records_updated;
  RAISE NOTICE 'Records with data: %', records_with_data;
  RAISE NOTICE 'Records still missing: %', records_still_missing;
  
  IF records_still_missing > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ADDITIONAL ACTION NEEDED:';
    RAISE NOTICE '   % clients need data from Meta Ads API', records_still_missing;
    RAISE NOTICE '   → Run: curl POST /api/automated/monthly-aggregation';
    RAISE NOTICE '   → Or: Manually trigger Meta Ads fetch for September';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Test September report in UI';
  RAISE NOTICE 'Next: Verify both August and September are complete';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- 7. IF STILL MISSING DATA - API FETCH COMMAND
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📞 If data still missing, run this API call:';
  RAISE NOTICE '';
  RAISE NOTICE 'curl -X POST https://your-domain.com/api/automated/monthly-aggregation \';
  RAISE NOTICE '  -H "Content-Type: application/json" \';
  RAISE NOTICE '  -d ''{"year": 2025, "month": 9}''';
  RAISE NOTICE '';
  RAISE NOTICE 'Or use admin UI: /admin/data-lifecycle';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
-- If you need to rollback, run:
/*
UPDATE campaign_summaries cs
SET 
  total_spend = sb.total_spend,
  total_impressions = sb.total_impressions,
  total_clicks = sb.total_clicks,
  total_conversions = sb.total_conversions,
  average_ctr = sb.average_ctr,
  average_cpc = sb.average_cpc,
  average_cpa = sb.average_cpa,
  last_updated = sb.last_updated
FROM september_backup sb
WHERE cs.client_id = sb.client_id
  AND cs.summary_date = sb.summary_date
  AND cs.summary_type = sb.summary_type;
*/
-- ============================================================================









