-- Verify that all data is being collected and stored for Belmonte weekly data

-- 1. Check if campaigns are stored
SELECT 
  '📊 CAMPAIGNS DATA' as check_type,
  COUNT(*) as total_weekly_records,
  COUNT(CASE WHEN campaigns IS NOT NULL AND jsonb_array_length(campaigns) > 0 THEN 1 END) as records_with_campaigns,
  AVG(jsonb_array_length(campaigns)) as avg_campaigns_per_week
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.created_at >= CURRENT_DATE;

-- 2. Check if meta_tables (demographics, placement, ad relevance) are stored
SELECT 
  '📊 META TABLES DATA' as check_type,
  COUNT(*) as total_records,
  COUNT(CASE WHEN meta_tables IS NOT NULL THEN 1 END) as records_with_meta_tables,
  COUNT(CASE WHEN meta_tables->'placementPerformance' IS NOT NULL THEN 1 END) as records_with_placement,
  COUNT(CASE WHEN meta_tables->'demographicPerformance' IS NOT NULL THEN 1 END) as records_with_demographics,
  COUNT(CASE WHEN meta_tables->'adRelevanceResults' IS NOT NULL THEN 1 END) as records_with_ad_relevance
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.created_at >= CURRENT_DATE;

-- 3. Check sample demographic data structure
SELECT 
  '👥 SAMPLE DEMOGRAPHIC DATA' as check_type,
  summary_date,
  jsonb_array_length(meta_tables->'demographicPerformance') as demographic_records_count,
  meta_tables->'demographicPerformance'->0 as sample_demographic_record
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.created_at >= CURRENT_DATE
  AND meta_tables->'demographicPerformance' IS NOT NULL
ORDER BY summary_date DESC
LIMIT 1;

-- 4. Check sample placement data structure
SELECT 
  '📍 SAMPLE PLACEMENT DATA' as check_type,
  summary_date,
  jsonb_array_length(meta_tables->'placementPerformance') as placement_records_count,
  meta_tables->'placementPerformance'->0 as sample_placement_record
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.created_at >= CURRENT_DATE
  AND meta_tables->'placementPerformance' IS NOT NULL
ORDER BY summary_date DESC
LIMIT 1;

-- 5. Check all conversion metrics
SELECT 
  '📈 CONVERSION METRICS' as check_type,
  summary_date,
  click_to_call,
  email_contacts,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.created_at >= CURRENT_DATE
ORDER BY summary_date DESC
LIMIT 5;



