-- ============================================================================
-- DATA CONSISTENCY AUDIT ACROSS MONTHS
-- ============================================================================
-- Check if all months have the same data structure and completeness
-- ============================================================================

-- PART 1: Overview of all months
SELECT 
  'DATA OVERVIEW BY MONTH' as audit_section,
  summary_date,
  platform,
  data_source,
  -- Campaign data
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns_count,
  -- Basic metrics
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  -- Conversion funnel
  click_to_call,
  email_contacts,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  roas,
  -- Meta tables
  CASE 
    WHEN meta_tables IS NULL THEN 'NULL'
    WHEN jsonb_typeof(meta_tables) = 'object' THEN 'Has meta_tables'
    ELSE 'Wrong type'
  END as meta_tables_status,
  -- Timestamps
  last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
ORDER BY summary_date DESC;

-- PART 2: Check campaign data structure consistency
SELECT 
  'CAMPAIGN DATA STRUCTURE' as audit_section,
  summary_date,
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns_count,
  -- Check if first campaign has all fields
  CASE 
    WHEN campaign_data IS NULL THEN 'NULL'
    WHEN jsonb_array_length(campaign_data) = 0 THEN 'EMPTY'
    ELSE jsonb_object_keys(campaign_data->0)::text
  END as sample_campaign_fields
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
ORDER BY summary_date DESC;

-- PART 3: Check meta_tables structure
SELECT 
  'META TABLES STRUCTURE' as audit_section,
  summary_date,
  -- Check what's in meta_tables
  CASE 
    WHEN meta_tables IS NULL THEN 'NULL'
    WHEN meta_tables->>'demographics' IS NOT NULL THEN 
      'demographics: ' || jsonb_array_length((meta_tables->>'demographics')::jsonb) || ' items'
    ELSE 'No demographics'
  END as demographics_status,
  CASE 
    WHEN meta_tables IS NULL THEN 'NULL'
    WHEN meta_tables->>'placements' IS NOT NULL THEN 
      'placements: ' || jsonb_array_length((meta_tables->>'placements')::jsonb) || ' items'
    ELSE 'No placements'
  END as placements_status,
  CASE 
    WHEN meta_tables IS NULL THEN 'NULL'
    WHEN meta_tables->>'ad_relevance' IS NOT NULL THEN 
      'ad_relevance: ' || jsonb_array_length((meta_tables->>'ad_relevance')::jsonb) || ' items'
    ELSE 'No ad_relevance'
  END as ad_relevance_status
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
ORDER BY summary_date DESC;

-- PART 4: Check data completeness score
SELECT 
  'DATA COMPLETENESS SCORE' as audit_section,
  summary_date,
  -- Calculate completeness
  (
    CASE WHEN campaign_data IS NOT NULL AND jsonb_array_length(campaign_data) > 0 THEN 1 ELSE 0 END +
    CASE WHEN total_spend > 0 THEN 1 ELSE 0 END +
    CASE WHEN total_impressions > 0 THEN 1 ELSE 0 END +
    CASE WHEN click_to_call IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN booking_step_1 IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN reservations IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN meta_tables IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN platform IS NOT NULL THEN 1 ELSE 0 END
  ) as completeness_score,
  -- What's missing
  ARRAY[
    CASE WHEN campaign_data IS NULL OR jsonb_array_length(campaign_data) = 0 THEN 'campaigns' END,
    CASE WHEN total_spend = 0 THEN 'spend' END,
    CASE WHEN click_to_call IS NULL THEN 'click_to_call' END,
    CASE WHEN booking_step_1 IS NULL THEN 'booking_step_1' END,
    CASE WHEN reservations IS NULL THEN 'reservations' END,
    CASE WHEN meta_tables IS NULL THEN 'meta_tables' END,
    CASE WHEN platform IS NULL THEN 'platform' END
  ]::text[] as missing_fields
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
ORDER BY summary_date DESC;

-- PART 5: Compare how data was collected
SELECT 
  'DATA COLLECTION METHOD' as audit_section,
  summary_date,
  data_source,
  created_at,
  last_updated,
  AGE(last_updated, created_at) as time_between_create_and_update,
  CASE 
    WHEN DATE(created_at) = DATE(last_updated) THEN 'Created once, never updated'
    WHEN AGE(last_updated, created_at) < INTERVAL '1 day' THEN 'Updated same day'
    ELSE 'Updated later: ' || DATE(last_updated)::text
  END as update_pattern
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
ORDER BY summary_date DESC;

-- PART 6: Check if all clients have same issue
SELECT 
  'ALL CLIENTS COMPARISON' as audit_section,
  c.name as client_name,
  cs.summary_date,
  jsonb_array_length(COALESCE(cs.campaign_data, '[]'::jsonb)) as campaigns,
  cs.total_spend,
  CASE WHEN cs.click_to_call IS NOT NULL THEN 'Yes' ELSE 'No' END as has_conversions,
  CASE WHEN cs.meta_tables IS NOT NULL THEN 'Yes' ELSE 'No' END as has_meta_tables,
  cs.data_source
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
  AND cs.summary_date >= '2025-08-01'
ORDER BY cs.summary_date DESC, c.name
LIMIT 20;









