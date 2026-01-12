# 🔍 Audit: Current Period Fallback to Recalculation

## Issue

Current period (January 2026) is still showing **calculated** CTR/CPC values (2.28% CTR, 0.48 zł CPC) instead of API values, even though:
- ✅ Historical periods have been updated with API values
- ✅ All systems are configured to use API values
- ✅ Cache has been cleared

## Root Cause Analysis

### Data Flow for Current Periods

1. **StandardizedDataFetcher** detects current period → `needsSmartCache = true`
2. **Smart Cache Helper** is called to fetch/retrieve data
3. **Cache Check**: If cache exists and is fresh → return cached data
4. **Fresh Fetch**: If no cache → `fetchFreshCurrentMonthData()` is called
5. **API Fetch**: Fetches account-level insights → stores in cache with `stats.averageCtr` and `stats.averageCpc`
6. **Display**: Components should use `stats.averageCtr` and `stats.averageCpc`

### Potential Issues

#### Issue 1: Cache Not Storing API Values ✅ FIXED
- **Status**: ✅ Fixed - `fetchFreshCurrentMonthData()` stores `averageCtr` and `averageCpc` in cache (lines 590-597)

#### Issue 2: Cache Retrieval Not Returning API Values ❓ NEEDS CHECK
- **Status**: Need to verify cache retrieval returns `stats.averageCtr` and `stats.averageCpc`

#### Issue 3: Display Components Recalculating ❓ NEEDS CHECK
- **Status**: Need to verify components use cached API values, not recalculate

#### Issue 4: Fallback to daily_kpi_data Recalculation ❌ FOUND
- **Location**: `standardized-data-fetcher.ts` lines 615-616
- **Issue**: When using `daily_kpi_data`, it **recalculates** CTR/CPC from totals
- **Impact**: If current period falls back to `daily_kpi_data`, it will recalculate

## Findings

### 1. Smart Cache Storage ✅
- **File**: `src/lib/smart-cache-helper.ts` lines 590-597
- **Status**: ✅ Correctly stores `averageCtr` and `averageCpc` in `stats` object

### 2. Smart Cache Retrieval ✅
- **File**: `src/lib/smart-cache-helper.ts` lines 1091-1099
- **Status**: ✅ Returns cached data as-is, including `stats.averageCtr` and `stats.averageCpc`

### 3. StandardizedDataFetcher Fallback ❌
- **File**: `src/lib/standardized-data-fetcher.ts` lines 615-616
- **Issue**: When using `daily_kpi_data`, it recalculates:
  ```typescript
  const averageCtr = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0;
  const averageCpc = totals.totalClicks > 0 ? totals.totalSpend / totals.totalClicks : 0;
  ```
- **Impact**: If current period uses `daily_kpi_data` instead of smart cache, it will recalculate

### 4. Display Components ✅
- **Status**: ✅ All components check for existence and use API values when available

## Solution

### Fix 1: Ensure Current Period Always Uses Smart Cache

**Priority**: HIGH

Current periods should **always** use smart cache, which has API values. The fallback to `daily_kpi_data` should only happen for historical periods.

**File**: `src/lib/standardized-data-fetcher.ts`

**Fix**: Ensure `needsSmartCache = true` for current periods, and don't fallback to `daily_kpi_data` for current periods.

### Fix 2: Remove Recalculation from daily_kpi_data Fallback

**Priority**: MEDIUM

Even if `daily_kpi_data` is used, it should try to get API values from `campaign_summaries` first.

**File**: `src/lib/standardized-data-fetcher.ts` lines 555-650

**Fix**: When using `daily_kpi_data`, also check `campaign_summaries` for API values (`average_ctr`, `average_cpc`).

## Verification Steps

1. **Check Cache Contents**:
   ```bash
   npx tsx scripts/audit-current-period-cache.ts
   ```

2. **Check Browser Console**:
   - Look for "Using CTR/CPC directly from account-level API insights"
   - Check if data source is "smart-cache" or "daily_kpi_data"

3. **Check Data Source**:
   - Reports page shows "Źródło: memory-cache" or "Źródło: cache"
   - If it shows "Źródło: daily_kpi_data", that's the problem

## Expected Behavior

For current periods:
1. ✅ Use smart cache (if available and fresh)
2. ✅ If no cache, fetch fresh with account-level insights
3. ✅ Store API values in cache
4. ✅ Return API values to display
5. ❌ **NEVER** fallback to `daily_kpi_data` recalculation

## Summary

**Status**: ⚠️ **ISSUE FOUND**

The fallback to `daily_kpi_data` in `standardized-data-fetcher.ts` recalculates CTR/CPC. Current periods should always use smart cache with API values.

