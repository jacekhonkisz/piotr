# 🔍 Audit: Google Ads Fetch System Comparison

## Overview

This audit compares the **Smart Cache fetch system** (for current periods) vs **Live API fetch system** (for historical or when cache is bypassed) to identify where booking steps data might be getting lost.

---

## Data Flow Comparison

### Smart Cache Flow (Current Period)

```
User Views Current Month
    ↓
fetchFreshGoogleAdsCurrentMonthData()
    ↓
googleAdsService.getCampaignData(startDate, endDate)
    ↓
1. Query campaigns (WITHOUT conversion data)
2. googleAdsService.getConversionBreakdown(startDate, endDate)
    ↓
   - Query conversion actions
   - Query conversions by campaign + action + date
   - Aggregate by campaign + action
   - parseGoogleAdsConversions() for each campaign
    ↓
3. Merge conversion data into campaigns
    ↓
4. Aggregate totals from campaigns
    ↓
5. Store in google_ads_current_month_cache
    ↓
6. Also save to google_ads_campaigns table
```

**Key Files:**
- `src/lib/google-ads-smart-cache-helper.ts` (lines 49-282)
- `src/lib/google-ads-api.ts` (lines 480-681, 686-905)

### Live API Flow (Historical or Cache Bypass)

```
User Views Historical Period OR Force Refresh
    ↓
fetch-google-ads-live-data/route.ts
    ↓
1. Check if historical → loadFromDatabase()
2. Check if current period → getGoogleAdsSmartCacheData()
3. If cache miss or force refresh → Live API
    ↓
googleAdsService.getCampaignData(startDate, endDate)
    ↓
(Same flow as Smart Cache)
    ↓
Return data directly (no cache storage)
```

**Key Files:**
- `src/app/api/fetch-google-ads-live-data/route.ts` (lines 385-1271)
- `src/lib/google-ads-api.ts` (same as above)

---

## Critical Code Paths

### 1. Conversion Breakdown Query

**Location:** `src/lib/google-ads-api.ts:745-757`

```typescript
const query = `
  SELECT
    campaign.id,
    campaign.name,
    segments.conversion_action_name,
    segments.date,
    metrics.all_conversions,
    metrics.all_conversions_value
  FROM campaign
  WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
    AND metrics.all_conversions > 0
  ORDER BY campaign.id, segments.conversion_action_name
`;
```

**Key Points:**
- ✅ Uses `all_conversions` (matches Google Ads Console "Wszystkie konwersje")
- ✅ Filters by date range
- ✅ Only includes campaigns with conversions > 0
- ⚠️ **Potential Issue**: If a campaign has conversions but `all_conversions` is 0 for the date range, it won't be included

### 2. Conversion Parsing

**Location:** `src/lib/google-ads-actions-parser.ts:90-115`

```typescript
// ✅ BOOKING STEP 1
if (conversionName.includes('step 1') || 
    conversionName.includes('step1') ||
    conversionName.includes('krok 1') ||
    conversionName.includes('booking_step_1')) {
  metrics.booking_step_1 += conversions;
}
```

**Key Points:**
- ✅ Should match "PBM - Booking Engine - krok 1" via `includes('krok 1')`
- ✅ Case-insensitive matching
- ⚠️ **Potential Issue**: If conversion action name doesn't match any pattern, it's ignored

### 3. Data Aggregation

**Location:** `src/lib/google-ads-smart-cache-helper.ts:122-149`

```typescript
const realConversionMetrics = campaignData.reduce((acc, campaign: any) => {
  acc.booking_step_1 += campaign.booking_step_1 || 0;
  acc.booking_step_2 += campaign.booking_step_2 || 0;
  acc.booking_step_3 += campaign.booking_step_3 || 0;
  // ...
}, { /* initial values */ });
```

**Key Points:**
- ✅ Sums booking steps from all campaigns
- ✅ Uses `|| 0` to handle undefined/null
- ⚠️ **Potential Issue**: If campaigns don't have booking_step_1/2/3 properties, they're treated as 0

---

## Potential Issues

### Issue 1: Date Range Mismatch ⚠️ MOST LIKELY

**Problem:**
- Google Ads Console might show a different date range than what's being fetched
- Reports page might be using a subset of dates

**How to Check:**
```sql
-- Check what date range is in cache
SELECT 
  period_id,
  (cache_data->'stats'->>'totalSpend')::numeric as spend
FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- Check what date range is in campaigns table
SELECT 
  MIN(date_range_start) as earliest,
  MAX(date_range_end) as latest
FROM google_ads_campaigns
WHERE date_range_start >= DATE_TRUNC('month', CURRENT_DATE);
```

**Fix:**
- Verify date range in browser console logs
- Compare with Google Ads Console date range
- Ensure cache uses same date range as console

### Issue 2: Conversion Query Filtering ⚠️ LIKELY

**Problem:**
- Query filters: `WHERE metrics.all_conversions > 0`
- If a campaign has conversions but `all_conversions` is 0 for the date range, it's excluded

**How to Check:**
```sql
-- Check if campaigns are missing conversion data
SELECT 
  campaign_id,
  campaign_name,
  spend,
  booking_step_1,
  booking_step_2,
  booking_step_3
FROM google_ads_campaigns
WHERE date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
  AND spend > 0
  AND booking_step_1 = 0
  AND booking_step_2 = 0
  AND booking_step_3 = 0;
```

**Fix:**
- Check if conversion query is returning all campaigns
- Verify `all_conversions` metric is correct
- Consider removing the `metrics.all_conversions > 0` filter

### Issue 3: Parser Not Matching ⚠️ POSSIBLE

**Problem:**
- Conversion action name might not match parser patterns
- Parser uses `includes()` which should work, but worth verifying

**How to Check:**
- Check server logs for: `🔍 Campaign ... - Action: "PBM - Booking Engine - krok 1"`
- Verify conversion action names are being received
- Check if parser is matching them correctly

**Fix:**
- Add more logging to see actual conversion action names
- Verify parser patterns match actual names
- Add fallback patterns if needed

### Issue 4: Campaign Filtering ⚠️ POSSIBLE

**Problem:**
- Only some campaigns might be included in the fetch
- Some campaigns might be filtered out by status or other criteria

**How to Check:**
```sql
-- Compare campaign counts
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
WHERE date_range_start >= DATE_TRUNC('month', CURRENT_DATE);
```

**Fix:**
- Verify campaign query includes all active campaigns
- Check if status filtering is too restrictive
- Ensure all campaigns with spend are included

---

## Diagnostic Steps

### Step 1: Run the Audit SQL

```bash
psql -d your_database -f scripts/AUDIT_FETCH_SYSTEM_COMPARISON.sql
```

### Step 2: Check Server Logs

Look for these log patterns:
- `🔍 Campaign ... - Action: "PBM - Booking Engine - krok 1"`
- `✅ Parsed conversions for campaign ...: { booking_step_1: ... }`
- `📊 Aggregated conversion metrics from Google Ads API:`

### Step 3: Compare Date Ranges

1. Check Google Ads Console date range
2. Check browser console for requested date range
3. Check cache period_id vs actual date range
4. Verify they match

### Step 4: Verify Campaign Count

1. Count campaigns in Google Ads Console
2. Count campaigns in cache
3. Count campaigns in database
4. Compare and identify missing campaigns

### Step 5: Check Individual Campaign Values

1. Pick a campaign with booking steps in Google Ads Console
2. Check if it exists in cache
3. Check if booking steps match
4. If missing or different, investigate why

---

## Expected Results

### ✅ Healthy System

**Smart Cache:**
- ✅ All campaigns with spend are included
- ✅ Conversion breakdown returns all conversion actions
- ✅ Parser matches "PBM - Booking Engine - krok 1/2/3"
- ✅ Aggregated totals match sum of individual campaigns
- ✅ Cache totals match database totals

**Live API:**
- ✅ Same data as smart cache (when using same date range)
- ✅ Returns all campaigns
- ✅ Booking steps match Google Ads Console

### ⚠️ Issues Found

**Common Issues:**
- ⚠️ Date range mismatch → Fix date range selection
- ⚠️ Missing campaigns → Check campaign query filters
- ⚠️ Conversion query not returning data → Check `all_conversions` metric
- ⚠️ Parser not matching → Verify conversion action names
- ⚠️ Aggregation mismatch → Check aggregation logic

---

## Quick Fixes

### Fix 1: Force Cache Refresh

If cache has stale data:
```sql
DELETE FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
```

### Fix 2: Check Conversion Query

Verify `getConversionBreakdown()` is returning all conversion data:
- Check server logs for conversion action names
- Verify all campaigns have conversion data
- Check if query is filtering out some campaigns

### Fix 3: Verify Date Range

Ensure date range matches Google Ads Console:
- Check browser console for date range logs
- Compare with Google Ads Console date range
- Fix date range selection if different

---

## Files to Check

1. **Smart Cache Helper**: `src/lib/google-ads-smart-cache-helper.ts`
   - Lines 49-282: `fetchFreshGoogleAdsCurrentMonthData()`
   - Lines 116-159: Conversion metrics aggregation

2. **Google Ads API**: `src/lib/google-ads-api.ts`
   - Lines 480-681: `getCampaignData()`
   - Lines 686-905: `getConversionBreakdown()`

3. **Parser**: `src/lib/google-ads-actions-parser.ts`
   - Lines 90-115: Booking steps parsing

4. **Live API Route**: `src/app/api/fetch-google-ads-live-data/route.ts`
   - Lines 600-710: Smart cache check
   - Lines 800-1000: Live API fetch

---

## Next Steps

1. **Run Audit SQL** to compare cache vs database vs campaigns table
2. **Check Server Logs** for conversion action names and parsing results
3. **Compare Date Ranges** between Google Ads Console and reports page
4. **Verify Campaign Count** matches between sources
5. **Check Individual Campaign Values** to see if data is there but not aggregated

