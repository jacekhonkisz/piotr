-- Verify October 2025 monthly data is properly stored for Belmonte
-- Run this in Supabase SQL Editor

-- 1. Check the NEW monthly record we just created
SELECT 
  '✅ NEW MONTHLY RECORD' as check_type,
  summary_type,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  total_campaigns,
  last_updated
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE email = 'belmonte@hotel.com')
  AND summary_type = 'monthly'
  AND summary_date = '2025-10-01'
  AND platform = 'google';

-- Expected result: 4,530.78 PLN, 1477 impressions, 144 clicks, 92 conversions

-- 2. Check weekly records (should still exist, separate system)
SELECT 
  '📅 WEEKLY RECORDS (Separate)' as check_type,
  summary_date,
  total_spend,
  total_impressions,
  total_clicks
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE email = 'belmonte@hotel.com')
  AND summary_type = 'weekly'
  AND summary_date >= '2025-10-01'
  AND summary_date < '2025-11-01'
  AND platform = 'google'
ORDER BY summary_date;

-- Expected: 2 weekly records (1014.16 and 572.25 PLN)

-- 3. Comparison: Before vs After
SELECT 
  '📊 BEFORE vs AFTER' as comparison,
  'Before (1 week shown)' as status,
  572.25 as spend_pln,
  'Dashboard was showing only 1 weekly record' as note
UNION ALL
SELECT 
  '📊 BEFORE vs AFTER',
  'Before (2 weeks in DB)',
  1586.40,
  'Database had 2 weekly records'
UNION ALL
SELECT 
  '📊 BEFORE vs AFTER',
  'After (Monthly proper)',
  total_spend,
  'NOW: Proper monthly record collected'
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE email = 'belmonte@hotel.com')
  AND summary_type = 'monthly'
  AND summary_date = '2025-10-01'
  AND platform = 'google';

-- 4. Verify the fix: Monthly and Weekly are separate
SELECT 
  '🔍 SYSTEM SEPARATION CHECK' as check_type,
  summary_type,
  COUNT(*) as record_count,
  SUM(total_spend) as total_spend,
  STRING_AGG(summary_date::text, ', ' ORDER BY summary_date) as dates
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE email = 'belmonte@hotel.com')
  AND platform = 'google'
  AND summary_date >= '2025-10-01'
  AND summary_date < '2025-11-01'
GROUP BY summary_type
ORDER BY summary_type;

-- Expected:
-- monthly: 1 record, 4530.78 PLN, date: 2025-10-01
-- weekly: 2 records, 1586.40 PLN, dates: 2025-10-13, 2025-10-27

-- 5. Final Status
SELECT 
  '🎉 FIX STATUS' as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries 
      WHERE client_id = (SELECT id FROM clients WHERE email = 'belmonte@hotel.com')
        AND summary_type = 'monthly'
        AND summary_date = '2025-10-01'
        AND platform = 'google'
        AND total_spend > 4000
    ) THEN '✅ FIXED - Monthly record exists with correct data'
    ELSE '❌ ISSUE - Monthly record missing or incorrect'
  END as result;
