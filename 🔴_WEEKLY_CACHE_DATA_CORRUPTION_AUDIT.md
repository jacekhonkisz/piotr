# Weekly Cache Data Corruption - Root Cause Analysis

## Problem Summary

Weekly PDFs are displaying corrupted data (huge numbers like `2.005943286703839e+86`) because **the data stored in the weekly cache is corrupted with string concatenation**.

## Evidence from Logs

### ✅ Routing is CORRECT
```
Line 91: ✅ Returning fresh weekly cached data
Line 98: source: 'weekly-cache'
Line 104: 📊 Weekly cache source: weekly-cache
```
**The routing fix worked!** Current week requests are now correctly using `weekly-cache` instead of `campaign-summaries-database`.

### ❌ Cache Data is CORRUPTED
```
Line 97:
totalSpend: '0351.12103.2721.6702.56226.7861.77200.31245.97329.69342.5148.9841.45157.96365.87237.85281.61188.7655.4926.55'

Line 109:
totalImpressions: '0200594328670383901711994821110011230201321706415879194711161279745480517003966919931406'

Line 110:
totalClicks: '039938331356443763632111099104812724106071041348228820'
```

These are STRINGS, not numbers! When JavaScript sees:
- `'0' + 351.12 + 103.27 + ...` → String concatenation
- Instead of: `0 + 351.12 + 103.27 + ...` → Numeric addition

## Root Cause

The **weekly cache population logic** is aggregating campaign data incorrectly:
1. When multiple campaigns are summed, the initial value is a string `'0'` instead of number `0`
2. JavaScript's `+` operator concatenates strings instead of adding numbers
3. This corrupted data is stored in `current_week_cache` table
4. PDFs and reports fetch this corrupted data

## Where the Cache is Populated

The weekly cache is populated by:
1. `fetchFreshCurrentWeekData()` in `smart-cache-helper.ts`
2. `BackgroundDataCollector` for weekly summaries
3. Meta API responses that are aggregated and stored

## Fix Required

Fix the aggregation logic where campaigns are summed to ensure:
1. Initial accumulator values are **numbers**, not strings
2. All campaign values are converted to **numbers** before aggregation
3. Use `Number()` or `parseFloat()` to sanitize values

## Impact

- ✅ Routing: FIXED (using weekly cache correctly)
- ❌ Data Quality: BROKEN (cache contains corrupted string-concatenated data)
- ❌ PDFs: Displaying corrupted numbers
- ❌ Reports: Displaying corrupted numbers
- ❌ YoY Comparisons: Incorrect calculations (line 164: `spendChange: 0` - should be -43%)

## Next Steps

1. Find where campaigns are aggregated for weekly cache
2. Add number sanitization before aggregation
3. Clear the corrupted cache
4. Re-populate with correct data

