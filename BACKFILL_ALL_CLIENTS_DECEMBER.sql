-- Backfill December 2025 Google Ads data for ALL clients
-- This fixes the issue where zeros were archived instead of real data
-- Works for all clients automatically

-- ============================================================================
-- STEP 1: VERIFY DATA EXISTS FOR ALL CLIENTS
-- ============================================================================
SELECT 
  'STEP 1: VERIFY DATA FOR ALL CLIENTS' as step,
  c.id as client_id,
  c.name as client_name,
  COUNT(DISTINCT gac.campaign_id) as campaign_count,
  SUM(gac.spend)::numeric as total_spend,
  SUM(gac.impressions) as total_impressions,
  SUM(gac.clicks) as total_clicks,
  SUM(COALESCE(gac.booking_step_1, 0)) as booking_step_1,
  SUM(COALESCE(gac.booking_step_2, 0)) as booking_step_2,
  SUM(COALESCE(gac.booking_step_3, 0)) as booking_step_3,
  SUM(COALESCE(gac.reservations, 0)) as reservations,
  SUM(COALESCE(gac.reservation_value, 0))::numeric as reservation_value
FROM clients c
INNER JOIN google_ads_campaigns gac ON gac.client_id = c.id
WHERE gac.date_range_start >= '2025-12-01'
  AND gac.date_range_start <= '2025-12-31'
  AND c.google_ads_customer_id IS NOT NULL
GROUP BY c.id, c.name
ORDER BY total_spend DESC;

-- ============================================================================
-- STEP 2: BACKFILL DECEMBER FOR ALL CLIENTS
-- ============================================================================
WITH december_aggregated AS (
  SELECT 
    gac.client_id,
    '2025-12-01'::date as summary_date,
    'monthly' as summary_type,
    'google' as platform,
    
    -- Core metrics
    SUM(gac.spend)::numeric as total_spend,
    SUM(gac.impressions) as total_impressions,
    SUM(gac.clicks) as total_clicks,
    SUM(COALESCE(gac.form_submissions, 0) + COALESCE(gac.phone_calls, 0)) as total_conversions,
    
    -- Calculated metrics
    CASE 
      WHEN SUM(gac.impressions) > 0 THEN (SUM(gac.clicks)::numeric / SUM(gac.impressions)::numeric) * 100
      ELSE 0
    END as average_ctr,
    CASE 
      WHEN SUM(gac.clicks) > 0 THEN SUM(gac.spend)::numeric / SUM(gac.clicks)::numeric
      ELSE 0
    END as average_cpc,
    
    -- Conversion metrics (check all possible column names)
    SUM(COALESCE(gac.booking_step_1, 0)) as booking_step_1,
    SUM(COALESCE(gac.booking_step_2, 0)) as booking_step_2,
    SUM(COALESCE(gac.booking_step_3, 0)) as booking_step_3,
    SUM(COALESCE(gac.reservations, 0)) as reservations,
    SUM(COALESCE(gac.reservation_value, 0))::numeric as reservation_value,
    
    -- Additional conversion metrics
    SUM(COALESCE(gac.click_to_call, 0)) as click_to_call,
    SUM(COALESCE(gac.email_contacts, 0)) as email_contacts,
    SUM(COALESCE(gac.form_submissions, 0)) as form_submissions,
    SUM(COALESCE(gac.phone_calls, 0)) as phone_calls,
    
    -- Campaign counts
    COUNT(DISTINCT CASE WHEN gac.status = 'ENABLED' THEN gac.campaign_id END) as active_campaigns,
    COUNT(DISTINCT gac.campaign_id) as total_campaigns,
    
    -- Campaign data (aggregate all campaigns as JSONB array)
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'campaignId', gac.campaign_id,
        'campaignName', gac.campaign_name,
        'status', gac.status,
        'spend', gac.spend,
        'impressions', gac.impressions,
        'clicks', gac.clicks,
        'cpc', COALESCE(gac.cpc, 0),
        'ctr', COALESCE(gac.ctr, 0),
        'booking_step_1', COALESCE(gac.booking_step_1, 0),
        'booking_step_2', COALESCE(gac.booking_step_2, 0),
        'booking_step_3', COALESCE(gac.booking_step_3, 0),
        'reservations', COALESCE(gac.reservations, 0),
        'reservation_value', COALESCE(gac.reservation_value, 0),
        'roas', COALESCE(gac.roas, 0)
      )
      ORDER BY gac.spend DESC
    ) FILTER (WHERE gac.campaign_id IS NOT NULL) as campaign_data,
    
    -- Calculate derived metrics
    CASE 
      WHEN SUM(COALESCE(gac.reservations, 0)) > 0 
        THEN SUM(gac.spend)::numeric / SUM(COALESCE(gac.reservations, 0))
      ELSE 0
    END as average_cpa,
    CASE 
      WHEN SUM(gac.spend)::numeric > 0 AND SUM(COALESCE(gac.reservation_value, 0))::numeric > 0
        THEN SUM(COALESCE(gac.reservation_value, 0))::numeric / SUM(gac.spend)::numeric
      ELSE 0
    END as roas
    
  FROM google_ads_campaigns gac
  INNER JOIN clients c ON c.id = gac.client_id
  WHERE gac.date_range_start >= '2025-12-01'
    AND gac.date_range_start <= '2025-12-31'
    AND c.google_ads_customer_id IS NOT NULL
  GROUP BY gac.client_id
)
-- Upsert into campaign_summaries for ALL clients
INSERT INTO campaign_summaries (
  client_id,
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  average_ctr,
  average_cpc,
  average_cpa,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  click_to_call,
  email_contacts,
  roas,
  active_campaigns,
  total_campaigns,
  campaign_data,
  data_source,
  last_updated
)
SELECT 
  client_id,
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  average_ctr,
  average_cpc,
  average_cpa,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  click_to_call,
  email_contacts,
  roas,
  active_campaigns,
  total_campaigns,
  campaign_data,
  'manual_backfill_from_google_ads_campaigns_2026_01_02' as data_source,
  NOW() as last_updated
FROM december_aggregated
ON CONFLICT (client_id, summary_type, summary_date, platform)
DO UPDATE SET
  total_spend = EXCLUDED.total_spend,
  total_impressions = EXCLUDED.total_impressions,
  total_clicks = EXCLUDED.total_clicks,
  total_conversions = EXCLUDED.total_conversions,
  average_ctr = EXCLUDED.average_ctr,
  average_cpc = EXCLUDED.average_cpc,
  average_cpa = EXCLUDED.average_cpa,
  booking_step_1 = EXCLUDED.booking_step_1,
  booking_step_2 = EXCLUDED.booking_step_2,
  booking_step_3 = EXCLUDED.booking_step_3,
  reservations = EXCLUDED.reservations,
  reservation_value = EXCLUDED.reservation_value,
  click_to_call = EXCLUDED.click_to_call,
  email_contacts = EXCLUDED.email_contacts,
  roas = EXCLUDED.roas,
  active_campaigns = EXCLUDED.active_campaigns,
  total_campaigns = EXCLUDED.total_campaigns,
  campaign_data = EXCLUDED.campaign_data,
  data_source = EXCLUDED.data_source,
  last_updated = EXCLUDED.last_updated;

-- ============================================================================
-- STEP 3: VERIFY THE UPDATE FOR ALL CLIENTS
-- ============================================================================
SELECT 
  'STEP 3: VERIFY UPDATE' as step,
  c.name as client_name,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  cs.reservation_value,
  cs.roas,
  cs.data_source,
  TO_CHAR(cs.last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2025-12-01'
  AND cs.platform = 'google'
  AND cs.summary_type = 'monthly'
ORDER BY cs.total_spend DESC;

