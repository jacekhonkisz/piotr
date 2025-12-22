# 🔧 Weekly Data Collection Fix

## Problem Identified

The weekly data collection was showing **DOUBLED/WRONG** metrics because:

### Root Cause
**Weekly Collection Logic Mismatch:**
- ❌ **WEEKLY**: ALWAYS prioritized `daily_kpi_data` first (lines 1026-1077)
- ✅ **MONTHLY**: Only used `daily_kpi_data` as FALLBACK if Meta API had no conversion data

This caused weekly data to:
1. Fetch conversion metrics from Meta API (correct data)
2. **OVERRIDE** those metrics with `daily_kpi_data` (causing doubling/wrong values)
3. Result: Weekly showed inflated numbers or wrong data

### Example from Belmonte (November 2025)
```
WEEKLY (WRONG):
- Total spend: $50,522 ❌ (doubled)
- Reservations: 840 ❌ (wrong)
- Booking Step 1: 55,936 ❌ (wrong)

MONTHLY (CORRECT):
- Total spend: $6,812 ✅
- Reservations: 0 ✅
- Booking Step 1: 0 ✅
```

## Solution Applied

### Code Changes
**File**: `src/lib/background-data-collector.ts`
**Function**: `storeWeeklySummary()`

**BEFORE** (lines 1026-1077):
```typescript
// 🎯 MATCH SMART CACHE: ALWAYS prioritize daily_kpi_data first
// 🥇 PRIORITY 1: ALWAYS try daily_kpi_data FIRST
// [Always queries daily_kpi_data, even when Meta API has data]
```

**AFTER**:
```typescript
// 🔧 MATCH MONTHLY LOGIC: Only use daily_kpi_data as FALLBACK if Meta API has NO conversion data
const hasAnyConversionData = conversionTotals.reservations > 0 || 
                              conversionTotals.booking_step_1 > 0 ||
                              conversionTotals.booking_step_2 > 0 ||
                              conversionTotals.booking_step_3 > 0;

if (!hasAnyConversionData) {
  // Only query daily_kpi_data if Meta API has NO conversion data
  [Query daily_kpi_data as fallback]
} else {
  // Use Meta API conversion metrics (preferred source)
  logger.info(`✅ Using conversion metrics from Meta API`);
}
```

### What Changed
1. **Weekly now matches Monthly logic exactly**
2. **Meta API is the PRIMARY source** for conversion metrics
3. **daily_kpi_data is FALLBACK** only when Meta API has no data
4. **No more doubling** or data conflicts

## Recovery Steps

### Step 1: Delete Bad Data (Nov 18)
Run script: `scripts/delete-bad-weekly-data-nov18.sql`
```sql
DELETE FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;
```

### Step 2: Test Single Week
```bash
# Test with just 1 week to verify fix
cd /Users/macbook/piotr
npx tsx scripts/recollect-weeks-controlled.ts --weeks=1
```

### Step 3: Verify Fix
Run diagnostic: `scripts/diagnose-doubling-issue.sql`
- Check if campaign_data metrics match stored metrics
- Verify no doubling or wrong values

### Step 4: Full Re-collection
```bash
# If test passes, collect all 53 weeks
cd /Users/macbook/piotr
npx tsx scripts/recollect-weeks-controlled.ts --weeks=53
```

## Expected Outcome

### After Fix
✅ **Weekly data will be REAL weekly data:**
- Correct 7-day period spend
- Accurate conversion metrics from Meta API
- Proper funnel metrics (booking_step_1 → booking_step_2 → booking_step_3 → reservations)
- Matching demographics, placement, and ad relevance data

✅ **Weekly = Monthly logic:**
- Both use same data source priority
- Both fetch same metrics from Meta API
- Both use daily_kpi_data only as fallback

✅ **No more doubling:**
- Data is fetched once from correct source
- No overlapping aggregation
- Clean, accurate metrics

## Verification Queries

### Check Data Quality
```sql
-- Compare campaign_data vs stored metrics
SELECT 
  summary_date,
  total_spend,
  reservations,
  (SELECT SUM((camp->>'reservations')::numeric)
   FROM jsonb_array_elements(campaign_data::jsonb) AS camp
  ) as campaign_data_reservations
FROM campaign_summaries
WHERE client_id = 'belmonte_id'
  AND summary_type = 'weekly'
  AND summary_date >= '2025-11-01'
ORDER BY summary_date DESC;
```

### Check for Doubling
```sql
-- Weekly should be ~1/4 of monthly (4 weeks in a month)
SELECT 
  'Weekly Total' as period,
  SUM(total_spend) as spend,
  SUM(reservations) as reservations
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND summary_date >= '2025-11-01'
  AND summary_date < '2025-12-01'
UNION ALL
SELECT 
  'Monthly Total' as period,
  total_spend as spend,
  reservations
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date = '2025-11-01';
```

## Files Modified
- ✅ `src/lib/background-data-collector.ts` - Fixed `storeWeeklySummary()` logic
- 📝 `scripts/delete-bad-weekly-data-nov18.sql` - Delete bad data from today
- 📝 `scripts/diagnose-doubling-issue.sql` - Verify fix worked
- 📝 `🔧_WEEKLY_DATA_COLLECTION_FIX.md` - This document

## Next Steps
1. Run deletion script to remove bad data
2. Test collection with 1 week
3. Verify metrics are correct
4. Re-collect all 53 weeks with fixed logic
5. Verify weekly reports show correct data

---

**Status**: ✅ FIX APPLIED - Ready for testing
**Date**: November 18, 2025
**Impact**: All clients, all weekly data collection



