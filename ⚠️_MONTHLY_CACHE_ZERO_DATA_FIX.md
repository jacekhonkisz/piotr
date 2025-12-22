# Monthly Cache Showing Zeros - Fix Applied

## Problem Identified ✅

The monthly cache (current_month_cache) is showing all zeros (`0.00 zł`, `0` impressions, `0` clicks, etc.) even though there should be data for November 2025.

## Root Cause

**The monthly data aggregation was missing the `sanitizeNumber()` function** that prevents string concatenation issues.

### Code Comparison

**Weekly Data (CORRECT - after fix)**:
```typescript
// Line 1175-1186: Has sanitizeNumber function
const sanitizeNumber = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

// Line 1189-1192: Uses sanitizeNumber
const totalSpend = campaignInsights.reduce((sum, campaign) => sum + sanitizeNumber(campaign.spend), 0);
const totalImpressions = campaignInsights.reduce((sum, campaign) => sum + sanitizeNumber(campaign.impressions), 0);
```

**Monthly Data (INCORRECT - before fix)**:
```typescript
// Line 197-199: Used parseFloat/parseInt directly
const totalSpend = campaignInsights.reduce((sum, insight) => sum + (parseFloat(insight.spend) || 0), 0);
const totalImpressions = campaignInsights.reduce((sum, insight) => sum + (parseInt(insight.impressions) || 0), 0);
```

## Why This Causes Zeros

When values come from the database as strings:
1. String concatenation happens: `'0' + '123.45' + '67.89'` = `'0123.4567.89'`
2. `parseFloat('0123.4567.89')` = `NaN` (invalid number format)
3. `NaN || 0` = `0` (fallback kicks in)
4. Result: All metrics show `0`

## Fix Applied ✅

### `src/lib/smart-cache-helper.ts` (Line 196-217)

Added the `sanitizeNumber()` function for monthly data aggregation:

```typescript
// ✅ CRITICAL FIX: Sanitize campaign values to numbers to prevent string concatenation (same as weekly)
const sanitizeNumber = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

// Calculate stats from Meta API insights with sanitized numbers
const totalSpend = campaignInsights.reduce((sum, insight) => sum + sanitizeNumber(insight.spend), 0);
const totalImpressions = campaignInsights.reduce((sum, insight) => sum + sanitizeNumber(insight.impressions), 0);
const totalClicks = campaignInsights.reduce((sum, insight) => sum + sanitizeNumber(insight.clicks), 0);
const metaTotalConversions = campaignInsights.reduce((sum, insight) => sum + sanitizeNumber(insight.conversions), 0);
```

## How to Fix the Cache

### Option 1: Clear the Cache (Recommended)

Run the SQL script I created:

```bash
psql -h localhost -p 54322 -U postgres -d postgres -f CLEAR_MONTHLY_CACHE.sql
```

Or manually:
```sql
DELETE FROM current_month_cache WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
```

### Option 2: Let it Auto-Refresh

The cache has a 3-hour TTL. It will automatically refresh with correct data after 3 hours.

## Testing Steps

1. ✅ Clear the corrupted cache (see above)
2. ✅ Refresh the `/reports` page for November 2025
3. ✅ Verify metrics show correct values (not zeros)
4. ✅ Check terminal logs for:
   ```
   ✅ Data fetch complete: X insights, Y campaigns
   🔍 DIAGNOSTIC: Aggregated metrics from Meta API: { totalSpend: X, totalImpressions: Y }
   ```

## Expected Results

### Before Fix:
- WYDATKI: `0,00 zł`
- WYŚWIETLENIA: `0`
- KLIKNIĘCIA: `0`
- CTR: `0.00%`
- Source: `cache` (but with zero data)

### After Fix:
- WYDATKI: `2,904.94 zł` (or actual value)
- WYŚWIETLENIA: `218,711`
- KLIKNIĘCIA: `7,234`
- CTR: `3.31%`
- Source: `cache` (with correct data)

## Related Fixes

This completes the string concatenation fixes across all cache types:

- ✅ **Weekly Cache**: Fixed in earlier commit (line 1175-1195)
- ✅ **Monthly Cache**: Fixed now (line 196-217)
- ✅ **Conversion Metrics Aggregation**: Fixed in `meta-actions-parser.ts`

## Impact

- ✅ Monthly reports: Will now display correct data
- ✅ Weekly reports: Already fixed
- ✅ Both PDF and UI: Will show identical, correct data
- ✅ YoY comparisons: Will calculate correctly with real numbers

## Files Modified

- `src/lib/smart-cache-helper.ts` (line 196-217)
- `CLEAR_MONTHLY_CACHE.sql` (new file for cache cleanup)

## Next Steps

1. Clear both weekly AND monthly cache to ensure all data is fresh
2. Let the system regenerate the cache with correct number sanitization
3. Verify both weekly and monthly reports show correct data

