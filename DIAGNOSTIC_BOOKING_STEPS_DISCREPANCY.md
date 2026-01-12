# 🔍 Diagnostic: Google Ads Booking Steps Discrepancy

## Problem

**Google Ads Console Shows:**
- Step 1: 456.01
- Step 2: 57.04
- Step 3: 11.00

**Reports Page Shows:**
- Step 1: 48
- Step 2: 4
- Step 3: 0

**Discrepancy:** ~10x difference for Step 1, ~14x for Step 2, Step 3 completely missing

---

## Root Cause Analysis

### Possible Causes

1. **Date Range Mismatch** ⚠️ MOST LIKELY
   - Google Ads console might show a different date range than what's being fetched
   - Reports page might be using a subset of dates
   - Check: What date range is the reports page using vs Google Ads console?

2. **Campaign Filtering** ⚠️ LIKELY
   - Only some campaigns might be included in the fetch
   - Some campaigns might be filtered out
   - Check: How many campaigns are in cache vs Google Ads console?

3. **Conversion Data Not Fetched** ⚠️ POSSIBLE
   - Conversion breakdown might not be fetched for all campaigns
   - Some campaigns might not have conversion data attached
   - Check: Are all campaigns getting conversion data from `getConversionBreakdown()`?

4. **Parser Not Matching** ❌ UNLIKELY
   - Parser uses `includes('krok 1')` which should match "PBM - Booking Engine - krok 1"
   - But worth verifying the actual conversion action names being received

5. **Data Aggregation Issue** ⚠️ POSSIBLE
   - Data might be getting lost during aggregation
   - Rounding might be causing issues
   - Check: Are individual campaign values correct before aggregation?

---

## Diagnostic Steps

### Step 1: Check Date Range

**In Google Ads Console:**
- Note the exact date range shown (e.g., "Jan 1-9, 2026")

**In Reports Page:**
- Check what date range is being requested
- Look at browser console logs for date range
- Check cache period_id vs actual date range

**SQL Check:**
```sql
-- Check what date range is in cache
SELECT 
  period_id,
  (cache_data->'stats'->>'totalSpend')::numeric as spend,
  jsonb_array_length(cache_data->'campaigns') as campaign_count
FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
```

### Step 2: Check Campaign Count

**Compare:**
- Number of campaigns in Google Ads console
- Number of campaigns in cache
- Number of campaigns in `google_ads_campaigns` table

**SQL Check:**
```sql
-- Count campaigns in cache vs database
SELECT 
  'cache' as source,
  jsonb_array_length(cache_data->'campaigns') as campaign_count
FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
UNION ALL
SELECT 
  'database' as source,
  COUNT(*) as campaign_count
FROM google_ads_campaigns
WHERE date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
  AND date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
```

### Step 3: Check Individual Campaign Values

**Check if individual campaigns have booking steps:**
```sql
-- Check individual campaigns in cache
SELECT 
  campaign->>'campaignName' as campaign_name,
  (campaign->>'spend')::numeric as spend,
  (campaign->>'booking_step_1')::numeric as step1,
  (campaign->>'booking_step_2')::numeric as step2,
  (campaign->>'booking_step_3')::numeric as step3
FROM google_ads_current_month_cache,
  jsonb_array_elements(cache_data->'campaigns') as campaign
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  AND (campaign->>'booking_step_1')::numeric > 0
ORDER BY (campaign->>'spend')::numeric DESC;
```

### Step 4: Check Conversion Action Names

**Verify parser is receiving correct conversion action names:**
- Check server logs for conversion action names
- Look for: `🔍 Campaign ... - Action: "PBM - Booking Engine - krok 1"`
- Verify the parser is matching these names

**Expected Log Pattern:**
```
🔍 Campaign [Name] (ID) - Action: "PBM - Booking Engine - krok 1" (456.01 conversions, 0.00 value)
✅ Parsed conversions for campaign [Name]: { booking_step_1: 456, ... }
```

### Step 5: Check Aggregation

**Verify totals match sum of individual campaigns:**
```sql
-- Sum individual campaigns vs cache totals
WITH campaign_totals AS (
  SELECT 
    SUM((campaign->>'booking_step_1')::numeric) as sum_step1,
    SUM((campaign->>'booking_step_2')::numeric) as sum_step2,
    SUM((campaign->>'booking_step_3')::numeric) as sum_step3
  FROM google_ads_current_month_cache,
    jsonb_array_elements(cache_data->'campaigns') as campaign
  WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
),
cache_totals AS (
  SELECT 
    (cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_step1,
    (cache_data->'conversionMetrics'->>'booking_step_2')::numeric as cache_step2,
    (cache_data->'conversionMetrics'->>'booking_step_3')::numeric as cache_step3
  FROM google_ads_current_month_cache
  WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
)
SELECT 
  ct.sum_step1 as campaign_sum_step1,
  cache.cache_step1 as cache_total_step1,
  ct.sum_step2 as campaign_sum_step2,
  cache.cache_step2 as cache_total_step2,
  ct.sum_step3 as campaign_sum_step3,
  cache.cache_step3 as cache_total_step3,
  CASE 
    WHEN ABS(ct.sum_step1 - cache.cache_step1) > 1 THEN '⚠️ MISMATCH'
    ELSE '✅ Match'
  END as comparison
FROM campaign_totals ct, cache_totals cache;
```

---

## Quick Fixes to Try

### Fix 1: Force Cache Refresh

If cache has stale data:
```sql
-- Delete current month cache to force refresh
DELETE FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
```

Then reload the reports page - it will fetch fresh data from API.

### Fix 2: Check Date Range in Reports Page

Verify the reports page is requesting the correct date range:
- Check browser console for date range logs
- Verify it matches Google Ads console date range
- If different, fix the date range selection

### Fix 3: Verify Conversion Breakdown Query

Check if `getConversionBreakdown()` is returning all conversion data:
- Look for server logs showing conversion action names
- Verify all campaigns have conversion data
- Check if query is filtering out some campaigns

---

## Expected Behavior

**When Working Correctly:**
1. Google Ads API fetches all campaigns for date range
2. `getConversionBreakdown()` fetches conversion data for all campaigns
3. Parser matches "PBM - Booking Engine - krok 1/2/3" conversion actions
4. Individual campaign values are summed correctly
5. Cache stores aggregated totals
6. Reports page displays cache totals

**Current Issue:**
- Step 3: Reports page shows 0, but Google Ads console shows 11.00
- This suggests Step 3 conversion data is not being fetched or parsed

---

## Next Steps

1. **Run Diagnostic SQL** (`DEBUG_GOOGLE_ADS_BOOKING_STEPS_DISCREPANCY.sql`)
2. **Check Server Logs** for conversion action names
3. **Compare Date Ranges** between Google Ads console and reports page
4. **Verify Campaign Count** matches between sources
5. **Check Individual Campaign Values** to see if data is there but not aggregated

---

## Files to Check

1. **Parser**: `src/lib/google-ads-actions-parser.ts` (lines 90-115)
2. **API Integration**: `src/lib/google-ads-api.ts` (lines 686-900)
3. **Cache Helper**: `src/lib/google-ads-smart-cache-helper.ts` (lines 116-159)
4. **Data Fetcher**: `src/lib/google-ads-standardized-data-fetcher.ts`

