-- ============================================================================
-- AUDIT: Why Google Ads campaigns show as "Unknown Campaign"
-- ============================================================================
-- This audit checks the entire data flow from API → Cache → Database → Display

-- ============================================================================
-- STEP 1: Check what's in the cache (google_ads_current_month_cache)
-- ============================================================================
SELECT 
  '1️⃣ CACHE: Campaign Names' as check_type,
  campaign->>'campaignName' as campaign_name_from_cache,
  campaign->>'campaignId' as campaign_id,
  campaign->>'name' as name_field,
  campaign->>'campaign_name' as campaign_name_field,
  ROUND((campaign->>'spend')::numeric, 2) as spend
FROM google_ads_current_month_cache,
  jsonb_array_elements(cache_data->'campaigns') as campaign
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
LIMIT 10;

-- ============================================================================
-- STEP 2: Check what's in google_ads_campaigns table
-- ============================================================================
SELECT 
  '2️⃣ DATABASE: Campaign Names' as check_type,
  campaign_name,
  campaign_id,
  status,
  ROUND(spend::numeric, 2) as spend,
  impressions,
  clicks
FROM google_ads_campaigns
WHERE date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
  AND date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
ORDER BY spend DESC
LIMIT 10;

-- ============================================================================
-- STEP 3: Check campaign_summaries campaign_data JSONB
-- ============================================================================
SELECT 
  '3️⃣ CAMPAIGN_SUMMARIES: Campaign Names' as check_type,
  campaign->>'campaignName' as campaign_name_from_jsonb,
  campaign->>'campaignId' as campaign_id,
  campaign->>'name' as name_field,
  campaign->>'campaign_name' as campaign_name_field,
  ROUND((campaign->>'spend')::numeric, 2) as spend
FROM campaign_summaries,
  jsonb_array_elements(campaign_data) as campaign
WHERE platform = 'google'
  AND summary_type = 'monthly'
  AND summary_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND summary_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
LIMIT 10;

-- ============================================================================
-- STEP 4: Check if campaign names are NULL or empty
-- ============================================================================
WITH expanded_cache_campaigns AS (
  SELECT 
    jsonb_array_elements(cache_data->'campaigns')->>'campaignName' as campaign_name
  FROM google_ads_current_month_cache
  WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
)
SELECT 
  '4️⃣ NULL/EMPTY CHECK: Cache' as check_type,
  COUNT(*) as total_campaigns,
  COUNT(CASE WHEN campaign_name IS NULL THEN 1 END) as null_campaign_name,
  COUNT(CASE WHEN campaign_name = '' THEN 1 END) as empty_campaign_name,
  COUNT(CASE WHEN campaign_name = 'Unknown Campaign' THEN 1 END) as unknown_campaign_name
FROM expanded_cache_campaigns;

SELECT 
  '4️⃣ NULL/EMPTY CHECK: Database' as check_type,
  COUNT(*) as total_campaigns,
  COUNT(CASE WHEN campaign_name IS NULL THEN 1 END) as null_campaign_name,
  COUNT(CASE WHEN campaign_name = '' THEN 1 END) as empty_campaign_name,
  COUNT(CASE WHEN campaign_name = 'Unknown Campaign' THEN 1 END) as unknown_campaign_name
FROM google_ads_campaigns
WHERE date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
  AND date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

-- ============================================================================
-- STEP 5: Sample raw cache data structure
-- ============================================================================
SELECT 
  '5️⃣ RAW CACHE STRUCTURE' as check_type,
  jsonb_pretty(cache_data->'campaigns'->0) as first_campaign_json
FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
LIMIT 1;

