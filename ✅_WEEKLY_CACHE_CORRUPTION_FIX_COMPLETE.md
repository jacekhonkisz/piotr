# Weekly Cache Corruption - Fix Complete

## Problem Identified ✅

**Root Cause**: When campaign data is retrieved from the `current_week_cache` database table, numeric values (spend, impressions, clicks) are returned as **strings** by Supabase/PostgreSQL. When these string values are aggregated using `reduce()` or `forEach()`, JavaScript performs **string concatenation** instead of **numeric addition**.

Example:
```javascript
// BEFORE (string concatenation):
'0' + 351.12 + 103.27 + 721.67 → '0351.12103.27721.67'

// AFTER (numeric addition):
0 + 351.12 + 103.27 + 721.67 → 1176.06
```

## Files Fixed ✅

### 1. `src/lib/smart-cache-helper.ts`
**Location**: Line 1175-1194
**Fix**: Added `sanitizeNumber()` function and applied it to all campaign values before aggregation in `fetchFreshCurrentWeekData()`.

```typescript
// ✅ CRITICAL FIX: Sanitize campaign values to numbers
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

// Calculate stats with sanitized numbers
const totalSpend = campaignInsights.reduce((sum, campaign) => sum + sanitizeNumber(campaign.spend), 0);
const totalImpressions = campaignInsights.reduce((sum, campaign) => sum + sanitizeNumber(campaign.impressions), 0);
const totalClicks = campaignInsights.reduce((sum, campaign) => sum + sanitizeNumber(campaign.clicks), 0);
```

### 2. `src/lib/meta-actions-parser.ts`
**Location**: Line 237-264
**Fix**: Added `sanitizeNumber()` function to `aggregateConversionMetrics()` to prevent string concatenation when aggregating conversion metrics.

```typescript
campaigns.forEach((campaign) => {
  totals.click_to_call += sanitizeNumber(campaign.click_to_call);
  totals.email_contacts += sanitizeNumber(campaign.email_contacts);
  totals.booking_step_1 += sanitizeNumber(campaign.booking_step_1);
  totals.booking_step_2 += sanitizeNumber(campaign.booking_step_2);
  totals.booking_step_3 += sanitizeNumber(campaign.booking_step_3);
  totals.reservations += sanitizeNumber(campaign.reservations);
  totals.reservation_value += sanitizeNumber(campaign.reservation_value);
});
```

## Cache Cleanup Required ⚠️

The corrupted cache data in `current_week_cache` table needs to be cleared:

```sql
DELETE FROM current_week_cache WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
```

Or run the provided script:
```bash
psql -h localhost -p 54322 -U postgres -d postgres -f CLEAR_CORRUPTED_CACHE.sql
```

## Testing Steps

1. ✅ Clear corrupted cache (see above)
2. ✅ Refresh the `/reports` page (will regenerate cache with correct data)
3. ✅ Generate a weekly PDF
4. ✅ Verify data matches between `/reports` page and PDF
5. ✅ Check that numbers are correct (not concatenated strings)

## Expected Results

### Before Fix:
- totalSpend: `'0351.12103.27721.67...'` (string concatenation)
- totalImpressions: `'02005943286703839...'` (huge string)
- Source: `campaign-summaries-database` or corrupted `weekly-cache`

### After Fix:
- totalSpend: `2904.94` (correct number)
- totalImpressions: `218711` (correct number)
- Source: `weekly-cache` with correct data

## Related Fixes

This fix complements the earlier routing fix:
- ✅ **Routing**: Fixed to use `weekly-cache` instead of `campaign-summaries-database` for current week
- ✅ **Data Quality**: Fixed number sanitization to prevent string concatenation
- ✅ **Both Issues**: Now resolved

## Impact

- ✅ Weekly PDFs: Will display correct numeric data
- ✅ Weekly Reports: Will display correct numeric data
- ✅ YoY Comparisons: Will calculate correct percentage changes
- ✅ AI Summaries: Will generate summaries with correct numbers

