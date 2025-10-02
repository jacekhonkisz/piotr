-- ============================================================================
-- INVESTIGATE: Why September Shows Zeros in Some Places
-- ============================================================================
-- Purpose: Find which specific metrics are showing zeros and why
-- Date: October 2, 2025
-- ============================================================================

-- ============================================================================
-- PART 1: Check September Data - What exactly is zero?
-- ============================================================================

SELECT 
  'SEPTEMBER OVERVIEW' as analysis,
  summary_date,
  -- Main metrics
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  average_ctr,
  average_cpc,
  -- Conversion metrics - THESE might be zero!
  click_to_call,
  email_contacts,
  booking_step_1,
  booking_step_2,
  reservations,
  reservation_value,
  roas,
  -- Campaign info
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns_count,
  -- Meta tables
  CASE 
    WHEN meta_tables IS NULL THEN 'NULL'
    WHEN meta_tables->>'demographics' IS NOT NULL THEN 'Has demographics'
    ELSE 'Missing demographics'
  END as demographics_status,
  CASE 
    WHEN meta_tables IS NULL THEN 'NULL'
    WHEN meta_tables->>'placements' IS NOT NULL THEN 'Has placements'
    ELSE 'Missing placements'
  END as placements_status
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date = '2025-09-01';

-- ============================================================================
-- PART 2: Check Campaign-Level Data - Are campaigns showing zeros?
-- ============================================================================

SELECT 
  'CAMPAIGN LEVEL ANALYSIS' as analysis,
  summary_date,
  campaign->>'campaign_name' as campaign_name,
  (campaign->>'spend')::numeric as campaign_spend,
  (campaign->>'impressions')::bigint as campaign_impressions,
  (campaign->>'clicks')::bigint as campaign_clicks,
  (campaign->>'conversions')::bigint as campaign_conversions,
  -- Check if conversion actions exist
  CASE 
    WHEN campaign->'conversion_actions' IS NULL THEN '❌ NULL'
    WHEN jsonb_array_length(campaign->'conversion_actions') = 0 THEN '❌ Empty array'
    ELSE '✅ Has ' || jsonb_array_length(campaign->'conversion_actions') || ' actions'
  END as conversion_actions_status
FROM campaign_summaries,
  jsonb_array_elements(campaign_data) as campaign
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date = '2025-09-01'
ORDER BY (campaign->>'spend')::numeric DESC
LIMIT 10;

-- ============================================================================
-- PART 3: Check Meta Tables - Demographics specifically
-- ============================================================================

SELECT 
  'DEMOGRAPHICS DATA CHECK' as analysis,
  summary_date,
  -- Check if meta_tables exists
  CASE 
    WHEN meta_tables IS NULL THEN '❌ meta_tables is NULL'
    WHEN meta_tables->>'demographics' IS NULL THEN '❌ demographics is NULL'
    ELSE '✅ demographics exists'
  END as demographics_status,
  -- If exists, how many?
  CASE 
    WHEN meta_tables->>'demographics' IS NOT NULL 
    THEN jsonb_array_length((meta_tables->>'demographics')::jsonb) || ' demographic segments'
    ELSE 'N/A'
  END as demographics_count,
  -- Check individual demographic
  CASE 
    WHEN meta_tables->>'demographics' IS NOT NULL THEN
      (meta_tables->'demographics'->0)::text
    ELSE 'No demographics'
  END as first_demographic_sample
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date = '2025-09-01';

-- ============================================================================
-- PART 4: Check if Conversion Metrics Are in Campaigns
-- ============================================================================

SELECT 
  'CONVERSION METRICS IN CAMPAIGNS' as analysis,
  campaign->>'campaign_name' as campaign_name,
  (campaign->>'spend')::numeric as spend,
  -- Standard conversions
  (campaign->>'conversions')::bigint as conversions,
  -- Custom conversion actions (if they exist)
  campaign->'conversion_actions' as conversion_actions_raw,
  -- Try to extract specific conversions
  (
    SELECT SUM((action->>'value')::numeric)
    FROM jsonb_array_elements(COALESCE(campaign->'conversion_actions', '[]'::jsonb)) as action
    WHERE action->>'action_type' = 'offsite_conversion.fb_pixel_custom'
  ) as custom_conversions
FROM campaign_summaries,
  jsonb_array_elements(campaign_data) as campaign
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date = '2025-09-01'
ORDER BY (campaign->>'spend')::numeric DESC
LIMIT 5;

-- ============================================================================
-- PART 5: Check if Meta Tables Have Actual Data or Just Structure
-- ============================================================================

SELECT 
  'META TABLES CONTENT CHECK' as analysis,
  -- Demographics
  CASE 
    WHEN meta_tables->'demographics' IS NOT NULL THEN
      jsonb_pretty(meta_tables->'demographics'->0)
    ELSE 'No demographics'
  END as first_demographic,
  -- Placements
  CASE 
    WHEN meta_tables->'placements' IS NOT NULL THEN
      jsonb_pretty(meta_tables->'placements'->0)
    ELSE 'No placements'
  END as first_placement,
  -- Ad Relevance
  CASE 
    WHEN meta_tables->'ad_relevance' IS NOT NULL THEN
      jsonb_array_length(meta_tables->'ad_relevance') || ' ads'
    ELSE 'No ad relevance data'
  END as ad_relevance_count
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date = '2025-09-01';

-- ============================================================================
-- PART 6: Compare Summary Totals vs Campaign Sum
-- ============================================================================

SELECT 
  'TOTALS VALIDATION' as analysis,
  -- From summary record
  cs.total_spend as summary_total_spend,
  cs.total_impressions as summary_total_impressions,
  cs.total_clicks as summary_total_clicks,
  cs.total_conversions as summary_total_conversions,
  -- Calculated from campaigns
  (
    SELECT SUM((campaign->>'spend')::numeric)
    FROM jsonb_array_elements(cs.campaign_data) as campaign
  ) as calculated_spend,
  (
    SELECT SUM((campaign->>'impressions')::bigint)
    FROM jsonb_array_elements(cs.campaign_data) as campaign
  ) as calculated_impressions,
  (
    SELECT SUM((campaign->>'clicks')::bigint)
    FROM jsonb_array_elements(cs.campaign_data) as campaign
  ) as calculated_clicks,
  -- Difference check
  cs.total_spend - (
    SELECT SUM((campaign->>'spend')::numeric)
    FROM jsonb_array_elements(cs.campaign_data) as campaign
  ) as spend_difference
FROM campaign_summaries cs
WHERE cs.client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date = '2025-09-01';

-- ============================================================================
-- PART 7: Check Specific Conversion Fields
-- ============================================================================

SELECT 
  'CONVERSION FIELDS DETAILED' as analysis,
  summary_date,
  -- These are the fields that might show as zeros in UI
  click_to_call as click_to_call_value,
  CASE WHEN click_to_call = 0 THEN '❌ Zero' ELSE '✅ Has value' END as click_to_call_status,
  
  email_contacts as email_contacts_value,
  CASE WHEN email_contacts = 0 THEN '❌ Zero' ELSE '✅ Has value' END as email_contacts_status,
  
  booking_step_1 as booking_step_1_value,
  CASE WHEN booking_step_1 = 0 THEN '❌ Zero' ELSE '✅ Has value' END as booking_step_1_status,
  
  booking_step_2 as booking_step_2_value,
  CASE WHEN booking_step_2 = 0 THEN '❌ Zero' ELSE '✅ Has value' END as booking_step_2_status,
  
  reservations as reservations_value,
  CASE WHEN reservations = 0 THEN '❌ Zero' ELSE '✅ Has value' END as reservations_status,
  
  reservation_value as reservation_value_amount,
  CASE WHEN reservation_value = 0 THEN '❌ Zero' ELSE '✅ Has value' END as reservation_value_status,
  
  roas as roas_value,
  CASE WHEN roas = 0 OR roas IS NULL THEN '❌ Zero/NULL' ELSE '✅ Has value' END as roas_status
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date = '2025-09-01';

-- ============================================================================
-- EXPECTED FINDINGS
-- ============================================================================

/*
SCENARIO 1: Conversion metrics are legitimately zero
  - Meta shows spend, clicks, impressions
  - But no conversions happened (reservations = 0)
  - This is NORMAL if client had no bookings in September

SCENARIO 2: Conversion tracking not set up
  - Meta pixel not installed or not firing
  - Custom conversion events not configured
  - This is a META ADS setup issue, not a code issue

SCENARIO 3: Meta tables are NULL or empty
  - meta_tables field exists but is NULL
  - OR has structure but no actual data
  - Need to check if Meta API returned this data

SCENARIO 4: Campaign conversion_actions are missing
  - Campaigns have spend/clicks/impressions
  - But conversion_actions array is empty
  - Meta API might not return conversion breakdowns for old months

SCENARIO 5: UI display issue
  - Data exists in database
  - But frontend isn't displaying it correctly
  - Need to check frontend code

SCENARIO 6: Some campaigns have data, others don't
  - Campaign A: Has conversions
  - Campaign B: Zero conversions (paused mid-month?)
  - Aggregated totals might look wrong
*/

