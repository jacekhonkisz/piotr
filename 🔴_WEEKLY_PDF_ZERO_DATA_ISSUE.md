# 🔴 WEEKLY PDF ZERO DATA ISSUE - ROOT CAUSE

**Date**: November 20, 2025  
**Status**: 🔴 **CRITICAL BUG IDENTIFIED**  
**Impact**: Weekly PDFs show 0 values while /reports shows correct data

---

## 🎯 The Problem

**Reports Page** (`/reports`):
- ✅ Shows: 3710,28 zł spend, 268.3K impressions, 7.2K clicks
- ✅ Data source: `meta-weekly-cache` or `campaign_summaries`

**PDF Generation**:
- ❌ Shows: 0,00 zł spend, 0 impressions, 0 clicks
- ❌ Same date range, but getting zero data

---

## 🔍 Root Cause Analysis

### The Data Flow

```
PDF Generation
    ↓
fetchReportData() → StandardizedDataFetcher.fetchData()
    ↓
For historical week (Nov 17-23):
    ↓
needsSmartCache = false (past week)
    ↓
fetchFromCachedSummaries()
    ↓
Query: summary_type='weekly', summary_date='2025-11-17' (Monday)
    ↓
❌ PROBLEM: Query might not find data OR data structure is wrong
```

### The Critical Code

**File**: `src/lib/standardized-data-fetcher.ts`  
**Lines**: 1074-1093

```typescript
// Query for weekly data
const { data: weeklyResults, error: weeklyError } = await dbClient
  .from('campaign_summaries')
  .select('*')
  .eq('client_id', clientId)
  .eq('summary_type', 'weekly')
  .eq('platform', platform)
  .eq('summary_date', weekMondayStr) // ← EXACT MATCH REQUIRED
  .limit(1);

if (weeklyResults && weeklyResults.length > 0) {
  storedSummary = weeklyResults[0];
  // ✅ Data found
} else {
  // ❌ No data found - returns zero data
  error = weeklyError;
}
```

### Why Reports Page Works But PDF Doesn't

**Hypothesis 1**: Date Range Mismatch
- Reports page: Uses `parseWeekPeriodId()` from `week-utils` → Gets exact Monday
- PDF generation: Might be using different date calculation → Wrong Monday

**Hypothesis 2**: Data Not Yet Archived
- Reports page: Uses `meta-weekly-cache` (current week cache)
- PDF generation: Tries `campaign_summaries` first (historical database)
- If data isn't archived yet, PDF gets zero data

**Hypothesis 3**: Platform Parameter Mismatch
- Reports page: Might pass `platform: 'meta'` correctly
- PDF generation: Might pass wrong platform value

---

## 🔬 Investigation Needed

### Check 1: What Date Range Does PDF Pass?

**Location**: `src/app/api/generate-pdf/route.ts` line 2646

```typescript
const metaResult = await StandardizedDataFetcher.fetchData({
  clientId,
  dateRange,  // ← What is this value?
  platform: 'meta',
  reason: 'pdf-generation-meta',
  sessionToken: clientData.meta_access_token
});
```

**Need to verify**:
- Is `dateRange.start` = `'2025-11-17'` (Monday)?
- Is `dateRange.end` = `'2025-11-23'` (Sunday)?
- Does it match what reports page uses?

### Check 2: What Does fetchFromCachedSummaries Return?

**Location**: `src/lib/standardized-data-fetcher.ts` line 1074

**Need to verify**:
- Does the query find data?
- What is `weekMondayStr` value?
- Is `weeklyResults.length > 0`?

### Check 3: Fallback to daily_kpi_data

**Location**: `src/lib/standardized-data-fetcher.ts` line 318

If `fetchFromCachedSummaries` fails, it should try `fetchFromDailyKpiData`.  
**Need to verify**: Does this fallback work for weekly periods?

---

## 🔧 Potential Fixes

### Fix 1: Ensure PDF Uses Same Date Calculation as Reports

**File**: `src/app/api/generate-pdf/route.ts`

```typescript
// BEFORE (might be wrong):
const dateRange = body.dateRange; // Direct from request

// AFTER (use same calculation as reports):
import { parseWeekPeriodId } from '../../../lib/week-utils';

// If it's a weekly period (7 days):
const daysDiff = Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
if (daysDiff === 7) {
  // Calculate week period ID and use standardized week calculation
  const weekInfo = parseWeekPeriodId(/* calculate from dateRange */);
  dateRange = {
    start: weekInfo.startDate,
    end: weekInfo.endDate
  };
}
```

### Fix 2: Add Fallback to Weekly Cache for Current Week

**File**: `src/lib/standardized-data-fetcher.ts`

```typescript
// If fetchFromCachedSummaries fails for weekly, try weekly cache
if (summaryType === 'weekly' && !storedSummary) {
  // Try weekly smart cache as fallback
  const { getSmartWeekCacheData } = await import('./smart-cache-helper');
  const weekCacheResult = await getSmartWeekCacheData(clientId, false, /* periodId */);
  
  if (weekCacheResult.success) {
    // Use cache data
  }
}
```

### Fix 3: Ensure Platform Parameter is Correct

**File**: `src/app/api/generate-pdf/route.ts`

```typescript
// Verify platform is passed correctly
logger.info('🔍 PDF DATA FETCH DEBUG:', {
  clientId,
  dateRange,
  platform: 'meta', // Should be 'meta' not 'Meta' or 'META'
  dateRangeStart: dateRange.start,
  dateRangeEnd: dateRange.end,
  daysDiff: Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)) + 1
});
```

---

## 🎯 Immediate Action

1. **Add logging** to see what date range PDF is using
2. **Add logging** to see what `fetchFromCachedSummaries` returns
3. **Compare** the exact date range used by reports vs PDF
4. **Check** if weekly data exists in `campaign_summaries` for that week

---

## 📊 Expected vs Actual

### Expected Behavior
```
PDF Request: Nov 17-23, 2025
    ↓
StandardizedDataFetcher detects: weekly (7 days)
    ↓
fetchFromCachedSummaries queries: summary_date='2025-11-17'
    ↓
Finds data in campaign_summaries
    ↓
Returns: 3710,28 zł spend, 268.3K impressions, 7.2K clicks
```

### Actual Behavior (Broken)
```
PDF Request: Nov 17-23, 2025
    ↓
StandardizedDataFetcher detects: weekly (7 days)
    ↓
fetchFromCachedSummaries queries: summary_date='2025-11-17' (or wrong date?)
    ↓
❌ No data found OR wrong query
    ↓
Returns: 0,00 zł spend, 0 impressions, 0 clicks
```

---

## 🔍 Debugging Steps

1. **Add logging in PDF generation**:
```typescript
logger.info('🔍 PDF WEEKLY DATA FETCH:', {
  dateRange,
  calculatedMonday: weekMondayStr,
  queryParams: {
    client_id: clientId,
    summary_type: 'weekly',
    platform: 'meta',
    summary_date: weekMondayStr
  }
});
```

2. **Add logging in fetchFromCachedSummaries**:
```typescript
console.log('🔍 WEEKLY QUERY RESULT:', {
  found: weeklyResults?.length > 0,
  count: weeklyResults?.length || 0,
  summaryDate: weeklyResults?.[0]?.summary_date,
  totalSpend: weeklyResults?.[0]?.total_spend,
  error: weeklyError?.message
});
```

3. **Compare with reports page**:
- Check what date range reports page uses
- Check what query reports page executes
- Compare the exact values

---

**Status**: 🔴 **BUG IDENTIFIED - NEEDS INVESTIGATION**  
**Priority**: CRITICAL - Weekly PDFs unusable  
**Next Step**: Add logging to identify exact mismatch

