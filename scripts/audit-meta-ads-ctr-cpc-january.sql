-- ============================================================================
-- AUDIT: Meta Ads CTR & CPC Fetching for Havet - January 2026
-- ============================================================================
-- This query audits what's being fetched from Meta API vs what's stored
-- and compares with Meta Business Suite expectations
-- ============================================================================

-- ============================================================================
-- 1. CHECK WHAT FIELDS ARE REQUESTED FROM META API
-- ============================================================================
-- Expected fields from meta-api-optimized.ts line 459:
-- fields=campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,
-- ctr,inline_link_click_ctr,cpc,cost_per_inline_link_click,cpm,cpp,reach,
-- frequency,conversions,actions,action_values,cost_per_action_type
-- ============================================================================

-- ============================================================================
-- 2. CHECK CURRENT_MONTH_CACHE - What's stored for Havet January 2026
-- ============================================================================
WITH havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
january_2026_cache AS (
  SELECT 
    'CURRENT_MONTH_CACHE' as source,
    mm.period_id,
    mm.last_updated,
    mm.cache_data,
    -- Extract stats
    COALESCE((mm.cache_data->'stats'->>'totalSpend')::numeric, 0) as total_spend,
    COALESCE((mm.cache_data->'stats'->>'totalImpressions')::numeric, 0) as total_impressions,
    COALESCE((mm.cache_data->'stats'->>'totalClicks')::numeric, 0) as total_clicks,
    COALESCE((mm.cache_data->'stats'->>'averageCtr')::numeric, 0) as stored_average_ctr,
    COALESCE((mm.cache_data->'stats'->>'averageCpc')::numeric, 0) as stored_average_cpc,
    -- Calculate what CTR/CPC SHOULD be
    CASE 
      WHEN COALESCE((mm.cache_data->'stats'->>'totalImpressions')::numeric, 0) > 0 
      THEN (COALESCE((mm.cache_data->'stats'->>'totalClicks')::numeric, 0)::DECIMAL / 
            COALESCE((mm.cache_data->'stats'->>'totalImpressions')::numeric, 0)::DECIMAL) * 100 
      ELSE 0 
    END as calculated_ctr,
    CASE 
      WHEN COALESCE((mm.cache_data->'stats'->>'totalClicks')::numeric, 0) > 0 
      THEN COALESCE((mm.cache_data->'stats'->>'totalSpend')::numeric, 0)::DECIMAL / 
           COALESCE((mm.cache_data->'stats'->>'totalClicks')::numeric, 0)::DECIMAL
      ELSE 0 
    END as calculated_cpc,
    -- Check individual campaigns
    jsonb_array_length(COALESCE(mm.cache_data->'campaigns', '[]'::jsonb)) as campaign_count
  FROM current_month_cache mm
  CROSS JOIN havet_client hc
  WHERE mm.client_id = hc.id
    AND mm.period_id = '2026-01'
)
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as section,
  '' as metric,
  '' as value,
  '' as note
UNION ALL
SELECT 
  '📊 CURRENT_MONTH_CACHE - HAVET JANUARY 2026',
  '',
  '',
  ''
UNION ALL
SELECT 
  '  Period ID',
  jc.period_id::text,
  '',
  ''
FROM january_2026_cache jc
UNION ALL
SELECT 
  '  Last Updated',
  jc.last_updated::text,
  '',
  ''
FROM january_2026_cache jc
UNION ALL
SELECT 
  '  Total Spend',
  jc.total_spend::text,
  'PLN',
  ''
FROM january_2026_cache jc
UNION ALL
SELECT 
  '  Total Impressions',
  jc.total_impressions::text,
  '',
  ''
FROM january_2026_cache jc
UNION ALL
SELECT 
  '  Total Clicks (inline_link_clicks)',
  jc.total_clicks::text,
  '',
  'Should be inline_link_clicks from Meta API'
FROM january_2026_cache jc
UNION ALL
SELECT 
  '  Stored Average CTR',
  ROUND(jc.stored_average_ctr, 2)::text || '%',
  '',
  'From cache_data->stats->averageCtr'
FROM january_2026_cache jc
UNION ALL
SELECT 
  '  Calculated CTR (from totals)',
  ROUND(jc.calculated_ctr, 2)::text || '%',
  '',
  'Formula: (total_clicks / total_impressions) * 100'
FROM january_2026_cache jc
UNION ALL
SELECT 
  '  CTR Match',
  CASE 
    WHEN ABS(jc.stored_average_ctr - jc.calculated_ctr) < 0.01 THEN '✅ MATCH'
    ELSE '❌ MISMATCH: ' || ROUND(ABS(jc.stored_average_ctr - jc.calculated_ctr), 2)::text || '% difference'
  END,
  '',
  ''
FROM january_2026_cache jc
UNION ALL
SELECT 
  '  Stored Average CPC',
  ROUND(jc.stored_average_cpc, 2)::text || ' zł',
  '',
  'From cache_data->stats->averageCpc'
FROM january_2026_cache jc
UNION ALL
SELECT 
  '  Calculated CPC (from totals)',
  ROUND(jc.calculated_cpc, 2)::text || ' zł',
  '',
  'Formula: total_spend / total_clicks'
FROM january_2026_cache jc
UNION ALL
SELECT 
  '  CPC Match',
  CASE 
    WHEN ABS(jc.stored_average_cpc - jc.calculated_cpc) < 0.01 THEN '✅ MATCH'
    ELSE '❌ MISMATCH: ' || ROUND(ABS(jc.stored_average_cpc - jc.calculated_cpc), 2)::text || ' zł difference'
  END,
  '',
  ''
FROM january_2026_cache jc
UNION ALL
SELECT 
  '  Campaign Count',
  jc.campaign_count::text,
  '',
  ''
FROM january_2026_cache jc;

-- ============================================================================
-- 3. CHECK INDIVIDUAL CAMPAIGNS IN CACHE - What CTR/CPC values are stored
-- ============================================================================
WITH havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
campaign_data AS (
  SELECT 
    c->>'campaign_id' as campaign_id,
    c->>'campaign_name' as campaign_name,
    (c->>'spend')::numeric as spend,
    (c->>'impressions')::numeric as impressions,
    (c->>'clicks')::numeric as clicks,
    (c->>'ctr')::numeric as stored_ctr,
    (c->>'cpc')::numeric as stored_cpc,
    -- Calculate what CTR/CPC SHOULD be for this campaign
    CASE 
      WHEN (c->>'impressions')::numeric > 0 
      THEN ((c->>'clicks')::numeric::DECIMAL / (c->>'impressions')::numeric::DECIMAL) * 100 
      ELSE 0 
    END as calculated_ctr,
    CASE 
      WHEN (c->>'clicks')::numeric > 0 
      THEN (c->>'spend')::numeric::DECIMAL / (c->>'clicks')::numeric::DECIMAL
      ELSE 0 
    END as calculated_cpc
  FROM current_month_cache mm
  CROSS JOIN havet_client hc,
  LATERAL jsonb_array_elements(mm.cache_data->'campaigns') as c
  WHERE mm.client_id = hc.id
    AND mm.period_id = '2026-01'
  ORDER BY (c->>'spend')::numeric DESC
  LIMIT 10
)
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as section,
  '' as metric,
  '' as value,
  '' as note
UNION ALL
SELECT 
  '📋 TOP 10 CAMPAIGNS - CTR/CPC VALUES',
  '',
  '',
  ''
UNION ALL
SELECT 
  '  Campaign',
  cd.campaign_name,
  '',
  ''
FROM campaign_data cd
UNION ALL
SELECT 
  '    Spend',
  ROUND(cd.spend, 2)::text || ' zł',
  '',
  ''
FROM campaign_data cd
UNION ALL
SELECT 
  '    Impressions',
  cd.impressions::text,
  '',
  ''
FROM campaign_data cd
UNION ALL
SELECT 
  '    Clicks (inline_link_clicks)',
  cd.clicks::text,
  '',
  'Should be inline_link_clicks from Meta API'
FROM campaign_data cd
UNION ALL
SELECT 
  '    Stored CTR',
  ROUND(cd.stored_ctr, 2)::text || '%',
  '',
  'From cache_data->campaigns[].ctr (should be inline_link_click_ctr from API)'
FROM campaign_data cd
UNION ALL
SELECT 
  '    Calculated CTR',
  ROUND(cd.calculated_ctr, 2)::text || '%',
  '',
  'Formula: (clicks / impressions) * 100'
FROM campaign_data cd
UNION ALL
SELECT 
  '    CTR Source',
  CASE 
    WHEN ABS(cd.stored_ctr - cd.calculated_ctr) < 0.01 THEN '✅ Using API value (matches calculation)'
    ELSE '⚠️ API value differs from calculation: ' || ROUND(ABS(cd.stored_ctr - cd.calculated_ctr), 2)::text || '%'
  END,
  '',
  ''
FROM campaign_data cd
UNION ALL
SELECT 
  '    Stored CPC',
  ROUND(cd.stored_cpc, 2)::text || ' zł',
  '',
  'From cache_data->campaigns[].cpc (should be cost_per_inline_link_click from API)'
FROM campaign_data cd
UNION ALL
SELECT 
  '    Calculated CPC',
  ROUND(cd.calculated_cpc, 2)::text || ' zł',
  '',
  'Formula: spend / clicks'
FROM campaign_data cd
UNION ALL
SELECT 
  '    CPC Source',
  CASE 
    WHEN ABS(cd.stored_cpc - cd.calculated_cpc) < 0.01 THEN '✅ Using API value (matches calculation)'
    ELSE '⚠️ API value differs from calculation: ' || ROUND(ABS(cd.stored_cpc - cd.calculated_cpc), 2)::text || ' zł'
  END,
  '',
  ''
FROM campaign_data cd;

-- ============================================================================
-- 4. CHECK CAMPAIGN_SUMMARIES - Historical data for January 2026
-- ============================================================================
WITH havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
january_summaries AS (
  SELECT 
    'CAMPAIGN_SUMMARIES' as source,
    cs.summary_date,
    cs.total_spend,
    cs.total_impressions,
    cs.total_clicks,
    cs.average_ctr,
    cs.average_cpc,
    cs.last_updated,
    -- Calculate what CTR/CPC SHOULD be
    CASE 
      WHEN cs.total_impressions > 0 
      THEN (cs.total_clicks::DECIMAL / cs.total_impressions::DECIMAL) * 100 
      ELSE 0 
    END as calculated_ctr,
    CASE 
      WHEN cs.total_clicks > 0 
      THEN cs.total_spend / cs.total_clicks::DECIMAL
      ELSE 0 
    END as calculated_cpc,
    COUNT(*) OVER() as campaign_count
  FROM campaign_summaries cs
  CROSS JOIN havet_client hc,
  LATERAL jsonb_array_elements(cs.campaign_data) as c
  WHERE cs.client_id = hc.id
    AND cs.platform = 'meta'
    AND cs.summary_date >= '2026-01-01'
    AND cs.summary_date < '2026-02-01'
  GROUP BY cs.summary_date, cs.total_spend, cs.total_impressions, cs.total_clicks, 
           cs.average_ctr, cs.average_cpc, cs.last_updated
  ORDER BY cs.summary_date DESC
  LIMIT 1
)
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as section,
  '' as metric,
  '' as value,
  '' as note
UNION ALL
SELECT 
  '📚 CAMPAIGN_SUMMARIES - HAVET JANUARY 2026',
  '',
  '',
  ''
UNION ALL
SELECT 
  '  Summary Date',
  js.summary_date::text,
  '',
  ''
FROM january_summaries js
UNION ALL
SELECT 
  '  Total Spend',
  js.total_spend::text,
  'PLN',
  ''
FROM january_summaries js
UNION ALL
SELECT 
  '  Total Impressions',
  js.total_impressions::text,
  '',
  ''
FROM january_summaries js
UNION ALL
SELECT 
  '  Total Clicks',
  js.total_clicks::text,
  '',
  'Should be inline_link_clicks'
FROM january_summaries js
UNION ALL
SELECT 
  '  Stored Average CTR',
  ROUND(js.average_ctr, 2)::text || '%',
  '',
  'From average_ctr column'
FROM january_summaries js
UNION ALL
SELECT 
  '  Calculated CTR',
  ROUND(js.calculated_ctr, 2)::text || '%',
  '',
  'Formula: (total_clicks / total_impressions) * 100'
FROM january_summaries js
UNION ALL
SELECT 
  '  CTR Match',
  CASE 
    WHEN ABS(js.average_ctr - js.calculated_ctr) < 0.01 THEN '✅ MATCH'
    ELSE '❌ MISMATCH: ' || ROUND(ABS(js.average_ctr - js.calculated_ctr), 2)::text || '% difference'
  END,
  '',
  ''
FROM january_summaries js
UNION ALL
SELECT 
  '  Stored Average CPC',
  ROUND(js.average_cpc, 2)::text || ' zł',
  '',
  'From average_cpc column'
FROM january_summaries js
UNION ALL
SELECT 
  '  Calculated CPC',
  ROUND(js.calculated_cpc, 2)::text || ' zł',
  '',
  'Formula: total_spend / total_clicks'
FROM january_summaries js
UNION ALL
SELECT 
  '  CPC Match',
  CASE 
    WHEN ABS(js.average_cpc - js.calculated_cpc) < 0.01 THEN '✅ MATCH'
    ELSE '❌ MISMATCH: ' || ROUND(ABS(js.average_cpc - js.calculated_cpc), 2)::text || ' zł difference'
  END,
  '',
  ''
FROM january_summaries js
UNION ALL
SELECT 
  '  Last Updated',
  js.last_updated::text,
  '',
  ''
FROM january_summaries js;

-- ============================================================================
-- 5. META BUSINESS SUITE EXPECTATIONS
-- ============================================================================
-- According to Meta Business Suite:
-- - CTR (współczynnik kliknięć z linku) = (inline_link_clicks / impressions) × 100
-- - CPC (koszt kliknięcia linku) = spend / inline_link_clicks
-- 
-- For individual campaigns: Use inline_link_click_ctr and cost_per_inline_link_click directly
-- For overall summary: Recalculate from total inline_link_clicks, impressions, and spend
-- ============================================================================
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as section,
  '' as metric,
  '' as value,
  '' as note
UNION ALL
SELECT 
  '📖 META BUSINESS SUITE STANDARD',
  '',
  '',
  ''
UNION ALL
SELECT 
  '  Individual Campaign CTR',
  'inline_link_click_ctr',
  'From Meta API',
  'Should match Meta Business Suite campaign table'
UNION ALL
SELECT 
  '  Individual Campaign CPC',
  'cost_per_inline_link_click',
  'From Meta API',
  'Should match Meta Business Suite campaign table'
UNION ALL
SELECT 
  '  Overall Summary CTR',
  '(total_inline_link_clicks / total_impressions) × 100',
  'Recalculated',
  'Should match Meta Business Suite summary cards'
UNION ALL
SELECT 
  '  Overall Summary CPC',
  'total_spend / total_inline_link_clicks',
  'Recalculated',
  'Should match Meta Business Suite summary cards'
UNION ALL
SELECT 
  '',
  '',
  '',
  ''
UNION ALL
SELECT 
  '🔍 API FIELDS REQUESTED',
  '',
  '',
  ''
UNION ALL
SELECT 
  '  Fields from meta-api-optimized.ts:459',
  'inline_link_clicks, inline_link_click_ctr, cost_per_inline_link_click',
  '',
  'These are the correct fields for Meta Business Suite matching'
UNION ALL
SELECT 
  '',
  '',
  '',
  ''
UNION ALL
SELECT 
  '⚠️ POTENTIAL ISSUES TO CHECK',
  '',
  '',
  ''
UNION ALL
SELECT 
  '  1. Are clicks stored as inline_link_clicks?',
  'Check if clicks field = inline_link_clicks from API',
  '',
  'Should be YES'
UNION ALL
SELECT 
  '  2. Are individual campaign CTRs from inline_link_click_ctr?',
  'Check if campaign.ctr = inline_link_click_ctr from API',
  '',
  'Should be YES'
UNION ALL
SELECT 
  '  3. Are individual campaign CPCs from cost_per_inline_link_click?',
  'Check if campaign.cpc = cost_per_inline_link_click from API',
  '',
  'Should be YES'
UNION ALL
SELECT 
  '  4. Is overall CTR recalculated from totals?',
  'Check if stats.averageCtr = (totalClicks / totalImpressions) * 100',
  '',
  'Should be YES'
UNION ALL
SELECT 
  '  5. Is overall CPC recalculated from totals?',
  'Check if stats.averageCpc = totalSpend / totalClicks',
  '',
  'Should be YES';

