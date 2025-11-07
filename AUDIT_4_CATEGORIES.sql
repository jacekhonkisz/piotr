-- ========================================
-- AUDIT: 4 CATEGORIES PER CLIENT
-- Meta Weekly | Meta Monthly | Google Weekly | Google Monthly
-- ========================================

-- 1️⃣ ALL CLIENTS - 4 CATEGORIES BREAKDOWN
SELECT 
  '1️⃣ CLIENT DATA BY 4 CATEGORIES' as check,
  c.name as client_name,
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'weekly' THEN cs.id END) as meta_weekly,
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'monthly' THEN cs.id END) as meta_monthly,
  COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'weekly' THEN cs.id END) as google_weekly,
  COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'monthly' THEN cs.id END) as google_monthly,
  COUNT(cs.id) as total_records,
  CASE 
    WHEN c.google_ads_customer_id IS NOT NULL THEN '✅ Has Google'
    ELSE '❌ No Google'
  END as google_status
FROM clients c
LEFT JOIN campaign_summaries cs ON c.id = cs.client_id
GROUP BY c.name, c.google_ads_customer_id
ORDER BY total_records DESC;

-- 2️⃣ TARGET vs ACTUAL COVERAGE
SELECT 
  '2️⃣ COVERAGE vs TARGET' as check,
  c.name as client_name,
  -- Meta Weekly
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'weekly' THEN cs.id END) as meta_weekly,
  CASE WHEN COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'weekly' THEN cs.id END) >= 53 THEN '✅' ELSE '⚠️' END as meta_w_status,
  -- Meta Monthly
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'monthly' THEN cs.id END) as meta_monthly,
  CASE WHEN COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'monthly' THEN cs.id END) >= 12 THEN '✅' ELSE '⚠️' END as meta_m_status,
  -- Google Weekly
  COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'weekly' THEN cs.id END) as google_weekly,
  CASE 
    WHEN c.google_ads_customer_id IS NULL THEN '➖'
    WHEN COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'weekly' THEN cs.id END) >= 53 THEN '✅'
    ELSE '⚠️'
  END as google_w_status,
  -- Google Monthly
  COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'monthly' THEN cs.id END) as google_monthly,
  CASE 
    WHEN c.google_ads_customer_id IS NULL THEN '➖'
    WHEN COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'monthly' THEN cs.id END) >= 12 THEN '✅'
    ELSE '⚠️'
  END as google_m_status
FROM clients c
LEFT JOIN campaign_summaries cs ON c.id = cs.client_id
GROUP BY c.name, c.google_ads_customer_id
ORDER BY c.name;

-- 3️⃣ DATABASE SUMMARY BY 4 CATEGORIES
SELECT 
  '3️⃣ TOTAL RECORDS BY CATEGORY' as check,
  COUNT(CASE WHEN platform = 'meta' AND summary_type = 'weekly' THEN 1 END) as meta_weekly,
  COUNT(CASE WHEN platform = 'meta' AND summary_type = 'monthly' THEN 1 END) as meta_monthly,
  COUNT(CASE WHEN platform = 'google' AND summary_type = 'weekly' THEN 1 END) as google_weekly,
  COUNT(CASE WHEN platform = 'google' AND summary_type = 'monthly' THEN 1 END) as google_monthly,
  COUNT(*) as total_records
FROM campaign_summaries;

-- 4️⃣ CLIENTS WITH INCOMPLETE COVERAGE
SELECT 
  '4️⃣ CLIENTS NEEDING MORE DATA' as check,
  c.name as client_name,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'weekly' THEN cs.id END) < 53 
    THEN CONCAT('Meta Weekly: ', COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'weekly' THEN cs.id END), '/53')
    ELSE 'Meta Weekly: ✅'
  END as meta_weekly_status,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'monthly' THEN cs.id END) < 12 
    THEN CONCAT('Meta Monthly: ', COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'monthly' THEN cs.id END), '/12')
    ELSE 'Meta Monthly: ✅'
  END as meta_monthly_status,
  CASE 
    WHEN c.google_ads_customer_id IS NULL THEN 'Google Weekly: N/A'
    WHEN COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'weekly' THEN cs.id END) < 53 
    THEN CONCAT('Google Weekly: ', COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'weekly' THEN cs.id END), '/53')
    ELSE 'Google Weekly: ✅'
  END as google_weekly_status,
  CASE 
    WHEN c.google_ads_customer_id IS NULL THEN 'Google Monthly: N/A'
    WHEN COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'monthly' THEN cs.id END) < 12 
    THEN CONCAT('Google Monthly: ', COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'monthly' THEN cs.id END), '/12')
    ELSE 'Google Monthly: ✅'
  END as google_monthly_status
FROM clients c
LEFT JOIN campaign_summaries cs ON c.id = cs.client_id
GROUP BY c.name, c.google_ads_customer_id
HAVING 
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'weekly' THEN cs.id END) < 53 OR
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'monthly' THEN cs.id END) < 12 OR
  (c.google_ads_customer_id IS NOT NULL AND COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'weekly' THEN cs.id END) < 53) OR
  (c.google_ads_customer_id IS NOT NULL AND COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'monthly' THEN cs.id END) < 12)
ORDER BY c.name;

-- 5️⃣ PERFECT CLIENTS (Full Coverage)
SELECT 
  '5️⃣ CLIENTS WITH PERFECT COVERAGE' as check,
  c.name as client_name,
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'weekly' THEN cs.id END) as meta_weekly,
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'monthly' THEN cs.id END) as meta_monthly,
  COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'weekly' THEN cs.id END) as google_weekly,
  COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'monthly' THEN cs.id END) as google_monthly,
  COUNT(cs.id) as total_records
FROM clients c
LEFT JOIN campaign_summaries cs ON c.id = cs.client_id
GROUP BY c.name, c.google_ads_customer_id
HAVING 
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'weekly' THEN cs.id END) >= 53 AND
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' AND cs.summary_type = 'monthly' THEN cs.id END) >= 12 AND
  (c.google_ads_customer_id IS NULL OR 
    (COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'weekly' THEN cs.id END) >= 53 AND
     COUNT(DISTINCT CASE WHEN cs.platform = 'google' AND cs.summary_type = 'monthly' THEN cs.id END) >= 12))
ORDER BY total_records DESC;

