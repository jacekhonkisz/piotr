# 🔧 Fix: Cache Refresh Needed for API CTR/CPC Values

## Problem

You're seeing **calculated values** instead of **API values**:
- **CTR**: 2.31% (calculated) ❌ Should be: **1.07%** (from API)
- **CPC**: 0.47 zł (calculated) ❌ Should be: **1.02 zł** (from API)

## Root Cause

The cache for January 2026 was created **before** we added account-level insights fetching. The cache doesn't have:
- `stats.averageCtr` = 1.066998% (from API)
- `stats.averageCpc` = 1.01836 zł (from API)

So the components fall back to calculating from campaign totals.

## Solution

### Option 1: Clear Cache via SQL (Recommended)

Run this SQL script to delete the cache:

```sql
-- Delete current month cache for Havet (January 2026)
DELETE FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND period_id = '2026-01';
```

Then refresh the page - it will fetch fresh data with API values.

### Option 2: Use Refresh Button

1. Click the **"Odśwież"** (Refresh) button in the reports page
2. This will force a fresh API fetch with account-level insights
3. The new values will be cached

### Option 3: Wait for Automatic Refresh

The cache refreshes automatically every 3 hours. Wait for the next refresh cycle.

## Expected Results After Refresh

After clearing cache and refreshing:

- **CTR**: `1.07%` (from API: 1.066998%)
- **CPC**: `1.02 zł` (from API: 1.01836 zł)

These values will be:
- ✅ Consistent across all components
- ✅ Match Meta Business Suite exactly
- ✅ Formatted with 2 decimal places

## Verification

After refreshing, check the browser console for:
```
✅ Using CTR/CPC directly from account-level API insights: { averageCtr: 1.066998, averageCpc: 1.01836 }
```

If you see this log, the API values are being used correctly.

