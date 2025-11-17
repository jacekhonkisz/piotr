# Google Ads Dashboard vs Reports - Data Source Audit

## Problem

**Dashboard shows 0s for Google Ads, but Reports page shows correct values.**

## Root Cause Identified

### Reports Page (✅ Working)
```typescript
// Uses GoogleAdsStandardizedDataFetcher.fetchData()
// Priority order:
1. daily_kpi_data (most accurate)
2. Google Ads smart cache (3-hour refresh)
3. Database summaries (historical)
4. Live Google Ads API (fallback)
```

### Dashboard (❌ Not Working)
```typescript
// Uses /api/google-ads-smart-cache DIRECTLY
// Only checks:
1. Google Ads smart cache (current month only)
2. Falls back to GoogleAdsStandardizedDataFetcher if cache fails
```

## The Issue

**Dashboard is bypassing the standardized fetcher's priority system!**

When the dashboard calls `/api/google-ads-smart-cache` directly:
- ✅ It gets current month data from cache
- ❌ But if cache is empty/stale, it doesn't check `daily_kpi_data` first
- ❌ It goes straight to the fallback which might return 0s

When the reports page uses `GoogleAdsStandardizedDataFetcher.fetchData()`:
- ✅ It checks `daily_kpi_data` FIRST (most accurate)
- ✅ Then checks smart cache
- ✅ Then checks database
- ✅ Then checks live API

## Solution

**Make dashboard use the SAME standardized fetcher as reports page!**

Instead of calling `/api/google-ads-smart-cache` directly, the dashboard should:
1. Use `GoogleAdsStandardizedDataFetcher.fetchData()` for ALL Google Ads requests
2. Only use cache-first mode for instant UI updates, but still go through standardized fetcher
3. Let the standardized fetcher handle the priority order

## Files to Fix

1. `src/app/dashboard/page.tsx` - Line 815-930
   - Remove direct `/api/google-ads-smart-cache` call
   - Use `GoogleAdsStandardizedDataFetcher.fetchData()` instead
   - Pass `dateRange` parameter (currently missing!)

## Expected Behavior After Fix

- Dashboard will check `daily_kpi_data` first (like reports)
- Dashboard will get same data as reports page
- Dashboard will show correct values instead of 0s





