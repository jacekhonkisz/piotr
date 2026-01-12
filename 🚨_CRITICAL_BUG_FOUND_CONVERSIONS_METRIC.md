# 🔍 CRITICAL ISSUE FOUND: API Fetching Wrong Conversion Metric

## The Problem

**Google Ads API Query (Line 807-819):**
```sql
SELECT
  campaign.id,
  campaign.name,
  segments.conversion_action_name,
  segments.date,
  metrics.conversions,          ❌ WRONG METRIC
  metrics.conversions_value
FROM campaign
WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
  AND metrics.conversions > 0   ❌ WRONG FILTER
```

## What's Wrong

### 1. Using `metrics.conversions` instead of `metrics.all_conversions`

**Google Ads has TWO conversion metrics:**

- **`metrics.conversions`** (cross-device attributed conversions only)
  - Strict attribution model
  - Often shows lower numbers
  - **Your API returns: 1,523**

- **`metrics.all_conversions`** (includes view-through, cross-device, all attribution)
  - Includes ALL conversion types
  - Matches what you see in Google Ads console
  - **Google Console shows: 9,864**

### 2. The filter `metrics.conversions > 0` excludes rows

If a campaign/action has `metrics.conversions = 0` but `metrics.all_conversions > 0`, those rows are **excluded** from the query.

## The Fix

Change the query to use `all_conversions`:

```sql
SELECT
  campaign.id,
  campaign.name,
  segments.conversion_action_name,
  segments.date,
  metrics.all_conversions,           ✅ USE THIS
  metrics.all_conversions_value
FROM campaign
WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
  AND metrics.all_conversions > 0    ✅ USE THIS
```

## Why This Matters

The Google Ads console by default shows **"Wszystkie konwersje" (All conversions)**, which corresponds to `metrics.all_conversions`.

Your current API query only gets `metrics.conversions` (cross-device attributed), which is a much smaller subset.

## Comparison

| Metric | API (conversions) | Console (all_conversions) | Difference |
|--------|-------------------|---------------------------|------------|
| Step 1 | 1,523 | 9,864 | **-84%** ❌ |
| Step 2 | 179 | 991 | **-82%** ❌ |
| Step 3 | 65 | 311 | **-79%** ❌ |

The API is only capturing **~15-20%** of actual conversions!

## Files to Update

1. **`src/lib/google-ads-api.ts` Line 807-819** - Update conversion breakdown query
2. **Check if there are other places** using `metrics.conversions` that should use `metrics.all_conversions`

## Expected Impact

After fix:
- ✅ API will return 9,864 for Step 1 (matches console)
- ✅ API will return 991 for Step 2 (matches console)
- ✅ API will return 311 for Step 3 (matches console)
- ✅ Historical data fetch will be accurate
- ✅ Live data fetch will be accurate

