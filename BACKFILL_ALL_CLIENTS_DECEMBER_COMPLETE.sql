-- Complete backfill for December 2025 - ALL CLIENTS
-- PRIORITIZES google_ads_campaigns for booking_step_1, booking_step_2, booking_step_3 (where they're stored)
-- Uses daily_kpi_data as fallback for click_to_call and email_contacts
-- This matches the live fetch behavior and ensures booking steps are properly populated

-- ============================================================================
-- STEP 1: AGGREGATE DATA FROM BOTH SOURCES
-- ============================================================================
WITH campaign_metrics AS (
  -- Get spend, impressions, clicks from google_ads_campaigns
  SELECT 
    client_id,
    SUM(spend)::numeric as total_spend,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(COALESCE(form_submissions, 0) + COALESCE(phone_calls, 0)) as total_conversions,
    COUNT(DISTINCT CASE WHEN status = 'ENABLED' THEN campaign_id END) as active_campaigns,
    COUNT(DISTINCT campaign_id) as total_campaigns,
    -- Campaign data (aggregate unique campaigns)
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'campaignId', campaign_id,
          'campaignName', campaign_name,
          'status', status,
          'spend', spend,
          'impressions', impressions,
          'clicks', clicks,
          'cpc', COALESCE(cpc, 0),
          'ctr', COALESCE(ctr, 0),
          'booking_step_1', COALESCE(booking_step_1, 0),
          'booking_step_2', COALESCE(booking_step_2, 0),
          'booking_step_3', COALESCE(booking_step_3, 0),
          'reservations', COALESCE(reservations, 0),
          'reservation_value', COALESCE(reservation_value, 0),
          'roas', COALESCE(roas, 0)
        ) ORDER BY spend DESC
      ) FILTER (WHERE campaign_id IS NOT NULL),
      '[]'::jsonb
    ) as campaign_data
  FROM google_ads_campaigns
  WHERE date_range_start >= '2025-12-01'
    AND date_range_start <= '2025-12-31'
  GROUP BY client_id
),
conversion_metrics AS (
  -- Get conversion metrics from daily_kpi_data (more reliable for conversions)
  SELECT 
    client_id,
    SUM(COALESCE(booking_step_1, 0)) as booking_step_1,
    SUM(COALESCE(booking_step_2, 0)) as booking_step_2,
    SUM(COALESCE(booking_step_3, 0)) as booking_step_3,
    SUM(COALESCE(reservations, 0)) as reservations,
    SUM(COALESCE(reservation_value, 0))::numeric as reservation_value,
    SUM(COALESCE(click_to_call, 0)) as click_to_call,
    SUM(COALESCE(email_contacts, 0)) as email_contacts
  FROM daily_kpi_data
  WHERE date >= '2025-12-01'
    AND date <= '2025-12-31'
    AND platform = 'google'
  GROUP BY client_id
),
campaign_conversions AS (
  -- Also get conversions from google_ads_campaigns as fallback
  SELECT 
    client_id,
    SUM(COALESCE(booking_step_1, 0)) as booking_step_1_campaigns,
    SUM(COALESCE(booking_step_2, 0)) as booking_step_2_campaigns,
    SUM(COALESCE(booking_step_3, 0)) as booking_step_3_campaigns,
    SUM(COALESCE(reservations, 0)) as reservations_campaigns,
    SUM(COALESCE(reservation_value, 0))::numeric as reservation_value_campaigns
  FROM google_ads_campaigns
  WHERE date_range_start >= '2025-12-01'
    AND date_range_start <= '2025-12-31'
  GROUP BY client_id
),
combined_data AS (
  SELECT 
    cm.client_id,  -- Only use clients that have campaign data
    '2025-12-01'::date as summary_date,
    'monthly' as summary_type,
    'google' as platform,
    
    -- Core metrics from campaigns (these exist)
    cm.total_spend,
    cm.total_impressions,
    cm.total_clicks,
    cm.total_conversions,
    
    -- Calculated metrics
    CASE 
      WHEN cm.total_impressions > 0 
        THEN (cm.total_clicks::numeric / cm.total_impressions::numeric) * 100
      ELSE 0
    END as average_ctr,
    CASE 
      WHEN cm.total_clicks > 0 
        THEN cm.total_spend / cm.total_clicks::numeric
      ELSE 0
    END as average_cpc,
    
    -- Conversion metrics: PRIORITIZE google_ads_campaigns for booking steps (where they're stored)
    -- Use daily_kpi_data only as fallback for click_to_call and email_contacts
    -- Booking steps come from google_ads_campaigns table (matches live fetch behavior)
    COALESCE(cc.booking_step_1_campaigns, conv.booking_step_1, 0) as booking_step_1,
    COALESCE(cc.booking_step_2_campaigns, conv.booking_step_2, 0) as booking_step_2,
    COALESCE(cc.booking_step_3_campaigns, conv.booking_step_3, 0) as booking_step_3,
    COALESCE(cc.reservations_campaigns, conv.reservations, 0) as reservations,
    COALESCE(cc.reservation_value_campaigns, conv.reservation_value, 0)::numeric as reservation_value,
    COALESCE(conv.click_to_call, 0) as click_to_call,
    COALESCE(conv.email_contacts, 0) as email_contacts,
    
    -- Campaign counts
    cm.active_campaigns,
    cm.total_campaigns,
    cm.campaign_data,
    
    -- Derived metrics (will be 0 if no reservations, which is correct)
    CASE 
      WHEN COALESCE(cc.reservations_campaigns, conv.reservations, 0) > 0 
        THEN cm.total_spend / COALESCE(cc.reservations_campaigns, conv.reservations, 0)::numeric
      ELSE 0
    END as average_cpa,
    CASE 
      WHEN cm.total_spend > 0 
        AND COALESCE(cc.reservation_value_campaigns, conv.reservation_value, 0) > 0
        THEN COALESCE(cc.reservation_value_campaigns, conv.reservation_value, 0) / cm.total_spend
      ELSE 0
    END as roas
    
  FROM campaign_metrics cm
  LEFT JOIN conversion_metrics conv ON conv.client_id = cm.client_id
  LEFT JOIN campaign_conversions cc ON cc.client_id = cm.client_id
  WHERE cm.total_spend > 0  -- Only clients with spend
)
-- Preview data before update
SELECT 
  'PREVIEW: DATA TO BE INSERTED' as step,
  cd.client_id,
  c.name as client_name,
  cd.total_spend,
  cd.total_impressions,
  cd.total_clicks,
  cd.booking_step_1,
  cd.booking_step_2,
  cd.booking_step_3,
  cd.reservations,
  cd.reservation_value,
  cd.roas,
  cd.active_campaigns,
  cd.total_campaigns
FROM combined_data cd
LEFT JOIN clients c ON c.id = cd.client_id
ORDER BY cd.total_spend DESC;

-- ============================================================================
-- STEP 2: UPDATE CAMPAIGN_SUMMARIES FOR ALL CLIENTS
-- ============================================================================
WITH campaign_metrics AS (
  SELECT 
    client_id,
    SUM(spend)::numeric as total_spend,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(COALESCE(form_submissions, 0) + COALESCE(phone_calls, 0)) as total_conversions,
    COUNT(DISTINCT CASE WHEN status = 'ENABLED' THEN campaign_id END) as active_campaigns,
    COUNT(DISTINCT campaign_id) as total_campaigns,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'campaignId', campaign_id,
          'campaignName', campaign_name,
          'status', status,
          'spend', spend,
          'impressions', impressions,
          'clicks', clicks,
          'cpc', COALESCE(cpc, 0),
          'ctr', COALESCE(ctr, 0),
          'booking_step_1', COALESCE(booking_step_1, 0),
          'booking_step_2', COALESCE(booking_step_2, 0),
          'booking_step_3', COALESCE(booking_step_3, 0),
          'reservations', COALESCE(reservations, 0),
          'reservation_value', COALESCE(reservation_value, 0),
          'roas', COALESCE(roas, 0)
        ) ORDER BY spend DESC
      ) FILTER (WHERE campaign_id IS NOT NULL),
      '[]'::jsonb
    ) as campaign_data
  FROM google_ads_campaigns
  WHERE date_range_start >= '2025-12-01'
    AND date_range_start <= '2025-12-31'
  GROUP BY client_id
),
conversion_metrics AS (
  SELECT 
    client_id,
    SUM(COALESCE(booking_step_1, 0)) as booking_step_1,
    SUM(COALESCE(booking_step_2, 0)) as booking_step_2,
    SUM(COALESCE(booking_step_3, 0)) as booking_step_3,
    SUM(COALESCE(reservations, 0)) as reservations,
    SUM(COALESCE(reservation_value, 0))::numeric as reservation_value,
    SUM(COALESCE(click_to_call, 0)) as click_to_call,
    SUM(COALESCE(email_contacts, 0)) as email_contacts
  FROM daily_kpi_data
  WHERE date >= '2025-12-01'
    AND date <= '2025-12-31'
    AND platform = 'google'
  GROUP BY client_id
),
campaign_conversions AS (
  SELECT 
    client_id,
    SUM(COALESCE(booking_step_1, 0)) as booking_step_1_campaigns,
    SUM(COALESCE(booking_step_2, 0)) as booking_step_2_campaigns,
    SUM(COALESCE(booking_step_3, 0)) as booking_step_3_campaigns,
    SUM(COALESCE(reservations, 0)) as reservations_campaigns,
    SUM(COALESCE(reservation_value, 0))::numeric as reservation_value_campaigns
  FROM google_ads_campaigns
  WHERE date_range_start >= '2025-12-01'
    AND date_range_start <= '2025-12-31'
  GROUP BY client_id
),
combined_data AS (
  SELECT 
    COALESCE(cm.client_id, conv.client_id, cc.client_id) as client_id,
    '2025-12-01'::date as summary_date,
    'monthly' as summary_type,
    'google' as platform,
    COALESCE(cm.total_spend, 0) as total_spend,
    COALESCE(cm.total_impressions, 0) as total_impressions,
    COALESCE(cm.total_clicks, 0) as total_clicks,
    COALESCE(cm.total_conversions, 0) as total_conversions,
    CASE 
      WHEN COALESCE(cm.total_impressions, 0) > 0 
        THEN (COALESCE(cm.total_clicks, 0)::numeric / COALESCE(cm.total_impressions, 0)::numeric) * 100
      ELSE 0
    END as average_ctr,
    CASE 
      WHEN COALESCE(cm.total_clicks, 0) > 0 
        THEN COALESCE(cm.total_spend, 0) / COALESCE(cm.total_clicks, 0)::numeric
      ELSE 0
    END as average_cpc,
    -- Conversion metrics: PRIORITIZE google_ads_campaigns for booking steps (where they're stored)
    -- Use daily_kpi_data only as fallback for click_to_call and email_contacts
    -- Booking steps come from google_ads_campaigns table (matches live fetch behavior)
    COALESCE(cc.booking_step_1_campaigns, conv.booking_step_1, 0) as booking_step_1,
    COALESCE(cc.booking_step_2_campaigns, conv.booking_step_2, 0) as booking_step_2,
    COALESCE(cc.booking_step_3_campaigns, conv.booking_step_3, 0) as booking_step_3,
    COALESCE(cc.reservations_campaigns, conv.reservations, 0) as reservations,
    COALESCE(cc.reservation_value_campaigns, conv.reservation_value, 0)::numeric as reservation_value,
    COALESCE(conv.click_to_call, 0) as click_to_call,
    COALESCE(conv.email_contacts, 0) as email_contacts,
    COALESCE(cm.active_campaigns, 0) as active_campaigns,
    COALESCE(cm.total_campaigns, 0) as total_campaigns,
    COALESCE(cm.campaign_data, '[]'::jsonb) as campaign_data,
    CASE 
      WHEN COALESCE(cc.reservations_campaigns, conv.reservations, 0) > 0 
        THEN COALESCE(cm.total_spend, 0) / COALESCE(cc.reservations_campaigns, conv.reservations, 0)::numeric
      ELSE 0
    END as average_cpa,
    CASE 
      WHEN COALESCE(cm.total_spend, 0) > 0 
        AND COALESCE(cc.reservation_value_campaigns, conv.reservation_value, 0) > 0
        THEN COALESCE(cc.reservation_value_campaigns, conv.reservation_value, 0) / COALESCE(cm.total_spend, 0)
      ELSE 0
    END as roas
  FROM campaign_metrics cm
  LEFT JOIN conversion_metrics conv ON conv.client_id = cm.client_id
  LEFT JOIN campaign_conversions cc ON cc.client_id = cm.client_id
  WHERE cm.total_spend > 0
)
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
  'manual_backfill_from_multiple_sources_2026_01_02' as data_source,
  NOW() as last_updated
FROM combined_data
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
-- STEP 3: VERIFY UPDATE FOR ALL CLIENTS
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

