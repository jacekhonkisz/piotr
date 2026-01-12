-- Backfill December 2025 Google Ads data from google_ads_campaigns to campaign_summaries
-- This fixes the issue where zeros were archived instead of real data

-- ============================================================================
-- STEP 1: VERIFY DATA EXISTS
-- ============================================================================
SELECT 
  'STEP 1: VERIFY DATA' as step,
  COUNT(DISTINCT campaign_id) as campaign_count,
  SUM(spend)::numeric as total_spend,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(booking_step_1) as booking_step_1,
  SUM(booking_step_2) as booking_step_2,
  SUM(booking_step_3) as booking_step_3,
  SUM(reservations) as reservations,
  SUM(reservation_value)::numeric as reservation_value
FROM google_ads_campaigns
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND date_range_start >= '2025-12-01'
  AND date_range_start <= '2025-12-31';

-- ============================================================================
-- STEP 2: AGGREGATE DECEMBER DATA
-- ============================================================================
WITH december_aggregated AS (
  SELECT 
    '93d46876-addc-4b99-b1e1-437428dd54f1'::uuid as client_id,
    '2025-12-01'::date as summary_date,
    'monthly' as summary_type,
    'google' as platform,
    
    -- Core metrics
    SUM(spend)::numeric as total_spend,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(COALESCE(form_submissions, 0) + COALESCE(phone_calls, 0)) as total_conversions,
    
    -- Calculated metrics
    CASE 
      WHEN SUM(impressions) > 0 THEN (SUM(clicks)::numeric / SUM(impressions)::numeric) * 100
      ELSE 0
    END as average_ctr,
    CASE 
      WHEN SUM(clicks) > 0 THEN SUM(spend)::numeric / SUM(clicks)::numeric
      ELSE 0
    END as average_cpc,
    
    -- Conversion metrics
    SUM(COALESCE(booking_step_1, 0)) as booking_step_1,
    SUM(COALESCE(booking_step_2, 0)) as booking_step_2,
    SUM(COALESCE(booking_step_3, 0)) as booking_step_3,
    SUM(COALESCE(reservations, 0)) as reservations,
    SUM(COALESCE(reservation_value, 0))::numeric as reservation_value,
    
    -- Campaign counts
    COUNT(DISTINCT CASE WHEN status = 'ENABLED' THEN campaign_id END) as active_campaigns,
    COUNT(DISTINCT campaign_id) as total_campaigns,
    
    -- Campaign data (aggregate all campaigns as JSONB array)
    jsonb_agg(
      jsonb_build_object(
        'campaignId', campaign_id,
        'campaignName', campaign_name,
        'status', status,
        'spend', spend,
        'impressions', impressions,
        'clicks', clicks,
        'cpc', cpc,
        'ctr', ctr,
        'booking_step_1', booking_step_1,
        'booking_step_2', booking_step_2,
        'booking_step_3', booking_step_3,
        'reservations', reservations,
        'reservation_value', reservation_value,
        'roas', roas
      ) ORDER BY spend DESC
    ) as campaign_data,
    
    -- Calculate derived metrics
    CASE 
      WHEN SUM(COALESCE(reservations, 0)) > 0 
        THEN SUM(spend)::numeric / SUM(COALESCE(reservations, 0))
      ELSE 0
    END as average_cpa,
    CASE 
      WHEN SUM(spend)::numeric > 0 AND SUM(COALESCE(reservation_value, 0))::numeric > 0
        THEN SUM(COALESCE(reservation_value, 0))::numeric / SUM(spend)::numeric
      ELSE 0
    END as roas
    
  FROM google_ads_campaigns
  WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
    AND date_range_start >= '2025-12-01'
    AND date_range_start <= '2025-12-31'
  GROUP BY client_id
)
-- Preview what will be inserted/updated
SELECT 
  'STEP 2: PREVIEW DATA' as step,
  client_id,
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  roas,
  average_cpa,
  active_campaigns,
  total_campaigns,
  jsonb_array_length(campaign_data) as campaign_data_count
FROM december_aggregated;

-- ============================================================================
-- STEP 3: UPDATE CAMPAIGN_SUMMARIES WITH REAL DATA
-- ============================================================================
WITH december_aggregated AS (
  SELECT 
    '93d46876-addc-4b99-b1e1-437428dd54f1'::uuid as client_id,
    '2025-12-01'::date as summary_date,
    'monthly' as summary_type,
    'google' as platform,
    
    -- Core metrics
    SUM(spend)::numeric as total_spend,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(COALESCE(form_submissions, 0) + COALESCE(phone_calls, 0)) as total_conversions,
    
    -- Calculated metrics
    CASE 
      WHEN SUM(impressions) > 0 THEN (SUM(clicks)::numeric / SUM(impressions)::numeric) * 100
      ELSE 0
    END as average_ctr,
    CASE 
      WHEN SUM(clicks) > 0 THEN SUM(spend)::numeric / SUM(clicks)::numeric
      ELSE 0
    END as average_cpc,
    
    -- Conversion metrics
    SUM(COALESCE(booking_step_1, 0)) as booking_step_1,
    SUM(COALESCE(booking_step_2, 0)) as booking_step_2,
    SUM(COALESCE(booking_step_3, 0)) as booking_step_3,
    SUM(COALESCE(reservations, 0)) as reservations,
    SUM(COALESCE(reservation_value, 0))::numeric as reservation_value,
    
    -- Campaign counts
    COUNT(DISTINCT CASE WHEN status = 'ENABLED' THEN campaign_id END) as active_campaigns,
    COUNT(DISTINCT campaign_id) as total_campaigns,
    
    -- Campaign data
    jsonb_agg(
      jsonb_build_object(
        'campaignId', campaign_id,
        'campaignName', campaign_name,
        'status', status,
        'spend', spend,
        'impressions', impressions,
        'clicks', clicks,
        'cpc', cpc,
        'ctr', ctr,
        'booking_step_1', booking_step_1,
        'booking_step_2', booking_step_2,
        'booking_step_3', booking_step_3,
        'reservations', reservations,
        'reservation_value', reservation_value,
        'roas', roas
      ) ORDER BY spend DESC
    ) as campaign_data,
    
    -- Derived metrics
    CASE 
      WHEN SUM(COALESCE(reservations, 0)) > 0 
        THEN SUM(spend)::numeric / SUM(COALESCE(reservations, 0))
      ELSE 0
    END as average_cpa,
    CASE 
      WHEN SUM(spend)::numeric > 0 AND SUM(COALESCE(reservation_value, 0))::numeric > 0
        THEN SUM(COALESCE(reservation_value, 0))::numeric / SUM(spend)::numeric
      ELSE 0
    END as roas
    
  FROM google_ads_campaigns
  WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
    AND date_range_start >= '2025-12-01'
    AND date_range_start <= '2025-12-31'
  GROUP BY client_id
)
-- Upsert into campaign_summaries
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
  roas = EXCLUDED.roas,
  active_campaigns = EXCLUDED.active_campaigns,
  total_campaigns = EXCLUDED.total_campaigns,
  campaign_data = EXCLUDED.campaign_data,
  data_source = EXCLUDED.data_source,
  last_updated = EXCLUDED.last_updated;

-- ============================================================================
-- STEP 4: VERIFY THE UPDATE
-- ============================================================================
SELECT 
  'STEP 4: VERIFY UPDATE' as step,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  roas,
  data_source,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM campaign_summaries
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND summary_date = '2025-12-01'
  AND platform = 'google'
  AND summary_type = 'monthly';

