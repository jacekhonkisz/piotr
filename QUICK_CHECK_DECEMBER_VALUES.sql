-- Quick Check: What values are actually stored for December?
-- Run this to see if December has zeros or real data

-- ============================================================================
-- GOOGLE ADS DECEMBER - What was archived?
-- ============================================================================
SELECT 
  '🔍 GOOGLE ADS DECEMBER' as check_type,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  cs.data_source,
  TO_CHAR(cs.last_updated, 'YYYY-MM-DD HH24:MI:SS') as archived_at
FROM campaign_summaries cs
WHERE cs.client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND cs.summary_date >= '2025-12-01' 
  AND cs.summary_date <= '2025-12-31'
  AND cs.platform = 'google'
  AND cs.summary_type = 'monthly';

-- ============================================================================
-- META ADS DECEMBER - For comparison (should have real data)
-- ============================================================================
SELECT 
  '✅ META ADS DECEMBER (COMPARISON)' as check_type,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  cs.data_source,
  TO_CHAR(cs.last_updated, 'YYYY-MM-DD HH24:MI:SS') as archived_at
FROM campaign_summaries cs
WHERE cs.client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND cs.summary_date >= '2025-12-01' 
  AND cs.summary_date <= '2025-12-31'
  AND cs.platform = 'meta'
  AND cs.summary_type = 'monthly';

-- ============================================================================
-- DIAGNOSIS: Are the values zeros?
-- ============================================================================
SELECT 
  '📊 DIAGNOSIS' as check_type,
  CASE 
    WHEN cs.total_spend = 0 AND cs.total_impressions = 0 THEN '❌ ALL ZEROS - Bad data was archived'
    WHEN cs.total_spend > 0 THEN '✅ HAS DATA - Real values archived'
    ELSE '⚠️ PARTIAL DATA - Some zeros'
  END as diagnosis,
  cs.total_spend,
  cs.total_impressions,
  cs.reservations
FROM campaign_summaries cs
WHERE cs.client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND cs.summary_date >= '2025-12-01' 
  AND cs.summary_date <= '2025-12-31'
  AND cs.platform = 'google'
  AND cs.summary_type = 'monthly';

