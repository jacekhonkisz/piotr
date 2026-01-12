-- ============================================================================
-- AGGREGATE BELMONTE FUNNEL DATA FROM google_ads_campaigns TO campaign_summaries
-- ============================================================================
-- Purpose: Fix missing funnel data in campaign_summaries for Belmonte Hotel
-- Client ID: ab0b4c7e-2bf0-46bc-b455-b18ef6942baa
-- Periods: December 2025 and January 2026
-- ============================================================================

-- ============================================================================
-- STEP 1: VERIFY DATA EXISTS IN google_ads_campaigns
-- ============================================================================
SELECT 
  'STEP 1: VERIFY DATA' as step,
  DATE_TRUNC('month', date_range_start)::date as month,
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
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND date_range_start >= '2025-12-01'
  AND date_range_start <= '2026-01-31'
GROUP BY DATE_TRUNC('month', date_range_start)
ORDER BY month DESC;

-- ============================================================================
-- STEP 2: AGGREGATE DECEMBER 2025 DATA
-- ============================================================================
WITH december_aggregated AS (
  SELECT 
    'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'::uuid as client_id,
    '2025-12-01'::date as summary_date,
    'monthly' as summary_type,
    'google' as platform,
    
    -- Core metrics
    SUM(spend)::numeric as total_spend,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(COALESCE(form_submissions, 0) + COALESCE(phone_calls, 0) + COALESCE(reservations, 0)) as total_conversions,
    
    -- Calculated metrics
    CASE 
      WHEN SUM(impressions) > 0 THEN (SUM(clicks)::numeric / SUM(impressions)::numeric) * 100
      ELSE 0
    END as average_ctr,
    CASE 
      WHEN SUM(clicks) > 0 THEN SUM(spend)::numeric / SUM(clicks)::numeric
      ELSE 0
    END as average_cpc,
    
    -- Conversion metrics (THE CRITICAL ONES!)
    SUM(COALESCE(booking_step_1, 0)) as booking_step_1,
    SUM(COALESCE(booking_step_2, 0)) as booking_step_2,
    SUM(COALESCE(booking_step_3, 0)) as booking_step_3,
    SUM(COALESCE(reservations, 0)) as reservations,
    SUM(COALESCE(reservation_value, 0))::numeric as reservation_value,
    
    -- Additional conversion metrics
    SUM(COALESCE(phone_calls, 0)) as click_to_call,
    SUM(COALESCE(email_clicks, 0)) as email_contacts,
    
    -- Campaign counts
    COUNT(DISTINCT CASE WHEN status = 'ENABLED' OR status = 'PAUSED' THEN campaign_id END) as active_campaigns,
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
    END as cost_per_reservation,
    CASE 
      WHEN SUM(spend)::numeric > 0 AND SUM(COALESCE(reservation_value, 0))::numeric > 0
        THEN SUM(COALESCE(reservation_value, 0))::numeric / SUM(spend)::numeric
      ELSE 0
    END as roas,
    
    -- Data source
    'google_ads_api' as data_source
    
  FROM google_ads_campaigns
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND date_range_start >= '2025-12-01'
    AND date_range_start <= '2025-12-31'
  GROUP BY client_id
)
-- Insert/Update December 2025 monthly summary
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
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  click_to_call,
  email_contacts,
  roas,
  cost_per_reservation,
  active_campaigns,
  total_campaigns,
  campaign_data,
  data_source,
  last_updated,
  created_at,
  updated_at
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
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  click_to_call,
  email_contacts,
  roas,
  cost_per_reservation,
  active_campaigns,
  total_campaigns,
  campaign_data,
  data_source,
  NOW() as last_updated,
  NOW() as created_at,
  NOW() as updated_at
FROM december_aggregated
ON CONFLICT (client_id, summary_type, summary_date, platform)
DO UPDATE SET
  total_spend = EXCLUDED.total_spend,
  total_impressions = EXCLUDED.total_impressions,
  total_clicks = EXCLUDED.total_clicks,
  total_conversions = EXCLUDED.total_conversions,
  average_ctr = EXCLUDED.average_ctr,
  average_cpc = EXCLUDED.average_cpc,
  booking_step_1 = EXCLUDED.booking_step_1,
  booking_step_2 = EXCLUDED.booking_step_2,
  booking_step_3 = EXCLUDED.booking_step_3,
  reservations = EXCLUDED.reservations,
  reservation_value = EXCLUDED.reservation_value,
  click_to_call = EXCLUDED.click_to_call,
  email_contacts = EXCLUDED.email_contacts,
  roas = EXCLUDED.roas,
  cost_per_reservation = EXCLUDED.cost_per_reservation,
  active_campaigns = EXCLUDED.active_campaigns,
  total_campaigns = EXCLUDED.total_campaigns,
  campaign_data = EXCLUDED.campaign_data,
  data_source = EXCLUDED.data_source,
  last_updated = EXCLUDED.last_updated,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- STEP 3: AGGREGATE JANUARY 2026 DATA
-- ============================================================================
WITH january_aggregated AS (
  SELECT 
    'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'::uuid as client_id,
    '2026-01-01'::date as summary_date,
    'monthly' as summary_type,
    'google' as platform,
    
    -- Core metrics
    SUM(spend)::numeric as total_spend,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(COALESCE(form_submissions, 0) + COALESCE(phone_calls, 0) + COALESCE(reservations, 0)) as total_conversions,
    
    -- Calculated metrics
    CASE 
      WHEN SUM(impressions) > 0 THEN (SUM(clicks)::numeric / SUM(impressions)::numeric) * 100
      ELSE 0
    END as average_ctr,
    CASE 
      WHEN SUM(clicks) > 0 THEN SUM(spend)::numeric / SUM(clicks)::numeric
      ELSE 0
    END as average_cpc,
    
    -- Conversion metrics (THE CRITICAL ONES!)
    SUM(COALESCE(booking_step_1, 0)) as booking_step_1,
    SUM(COALESCE(booking_step_2, 0)) as booking_step_2,
    SUM(COALESCE(booking_step_3, 0)) as booking_step_3,
    SUM(COALESCE(reservations, 0)) as reservations,
    SUM(COALESCE(reservation_value, 0))::numeric as reservation_value,
    
    -- Additional conversion metrics
    SUM(COALESCE(phone_calls, 0)) as click_to_call,
    SUM(COALESCE(email_clicks, 0)) as email_contacts,
    
    -- Campaign counts
    COUNT(DISTINCT CASE WHEN status = 'ENABLED' OR status = 'PAUSED' THEN campaign_id END) as active_campaigns,
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
    END as cost_per_reservation,
    CASE 
      WHEN SUM(spend)::numeric > 0 AND SUM(COALESCE(reservation_value, 0))::numeric > 0
        THEN SUM(COALESCE(reservation_value, 0))::numeric / SUM(spend)::numeric
      ELSE 0
    END as roas,
    
    -- Data source
    'google_ads_api' as data_source
    
  FROM google_ads_campaigns
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND date_range_start >= '2026-01-01'
    AND date_range_start <= '2026-01-31'
  GROUP BY client_id
)
-- Insert/Update January 2026 monthly summary
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
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  click_to_call,
  email_contacts,
  roas,
  cost_per_reservation,
  active_campaigns,
  total_campaigns,
  campaign_data,
  data_source,
  last_updated,
  created_at,
  updated_at
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
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  click_to_call,
  email_contacts,
  roas,
  cost_per_reservation,
  active_campaigns,
  total_campaigns,
  campaign_data,
  data_source,
  NOW() as last_updated,
  NOW() as created_at,
  NOW() as updated_at
FROM january_aggregated
ON CONFLICT (client_id, summary_type, summary_date, platform)
DO UPDATE SET
  total_spend = EXCLUDED.total_spend,
  total_impressions = EXCLUDED.total_impressions,
  total_clicks = EXCLUDED.total_clicks,
  total_conversions = EXCLUDED.total_conversions,
  average_ctr = EXCLUDED.average_ctr,
  average_cpc = EXCLUDED.average_cpc,
  booking_step_1 = EXCLUDED.booking_step_1,
  booking_step_2 = EXCLUDED.booking_step_2,
  booking_step_3 = EXCLUDED.booking_step_3,
  reservations = EXCLUDED.reservations,
  reservation_value = EXCLUDED.reservation_value,
  click_to_call = EXCLUDED.click_to_call,
  email_contacts = EXCLUDED.email_contacts,
  roas = EXCLUDED.roas,
  cost_per_reservation = EXCLUDED.cost_per_reservation,
  active_campaigns = EXCLUDED.active_campaigns,
  total_campaigns = EXCLUDED.total_campaigns,
  campaign_data = EXCLUDED.campaign_data,
  data_source = EXCLUDED.data_source,
  last_updated = EXCLUDED.last_updated,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- STEP 4: VERIFY THE FIX
-- ============================================================================
SELECT 
  'STEP 4: VERIFY FIX' as step,
  summary_date,
  summary_type,
  platform,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
  AND summary_date IN ('2025-12-01', '2026-01-01')
  AND summary_type = 'monthly'
ORDER BY summary_date DESC;

