# ✅ WEEKLY PDF DATA FIX - APPLIED

**Date**: November 20, 2025  
**Status**: ✅ **FIXES APPLIED**  
**Issue**: Weekly PDFs showing 0 values while /reports shows correct data

---

## 🔍 Root Cause

The PDF generation was not detecting the current week correctly, causing it to:
1. Try `campaign_summaries` database first (for historical data)
2. Not find data (because current week isn't archived yet)
3. Return zero data instead of using weekly smart cache

**Reports Page** (Working ✅):
- Uses `meta-weekly-cache` (smart cache) for current week
- Gets correct data: 3710,28 zł spend, 268.3K impressions

**PDF Generation** (Broken ❌):
- Tried database first → No data found → Returned zeros
- Should use weekly smart cache for current week

---

## ✅ Fixes Applied

### Fix 1: More Flexible Current Week Detection

**File**: `src/lib/standardized-data-fetcher.ts`  
**Lines**: 225-232

**Before**:
```typescript
const isCurrentWeek = (daysDiff >= 6 && daysDiff <= 7) && includesCurrentDay && startDate.getDay() === 1;
//                                                                              ↑
//                                                              Required Monday start
```

**After**:
```typescript
const isWeekPeriod = daysDiff >= 6 && daysDiff <= 7;
const weekIncludesToday = isWeekPeriod && includesCurrentDay;
// More flexible - doesn't require Monday start
const isCurrentWeek = isWeekPeriod && weekIncludesToday;
```

**Impact**: PDF will now detect current week even if date range doesn't start exactly on Monday.

---

### Fix 2: More Flexible Weekly Cache Overlap Check

**File**: `src/lib/standardized-data-fetcher.ts`  
**Lines**: 849-862

**Before**:
```typescript
const isOverlapping = (
  (requestedStart <= currentWeekEnd && requestedEnd >= currentWeekStart) ||
  (requestedStart.toISOString().split('T')[0] === currentWeek.startDate)
);
// Too strict - exact match required
```

**After**:
```typescript
const isOverlapping = (
  (requestedStart <= currentWeekEnd && requestedEnd >= currentWeekStart) ||
  (requestedStart.toISOString().split('T')[0] === currentWeek.startDate) ||
  (requestedEnd.toISOString().split('T')[0] === currentWeek.endDate) ||
  // Also check if requested dates are within current week range
  (requestedStart >= currentWeekStart && requestedStart <= currentWeekEnd) ||
  (requestedEnd >= currentWeekStart && requestedEnd <= currentWeekEnd)
);
// More flexible - any overlap will use cache
```

**Impact**: PDF will use weekly smart cache even if date ranges don't match exactly.

---

### Fix 3: Enhanced Logging for Debugging

**File**: `src/app/api/generate-pdf/route.ts`  
**Lines**: 2644-2665

**Added**:
```typescript
logger.info('🔍 PDF WEEKLY DATA FETCH DEBUG:', {
  dateRange,
  daysDiff: ...,
  startDayOfWeek: ...,
  isLikelyWeekly: ...
});

logger.info('🔍 META DATA SOURCE DEBUG:', {
  totalSpend: ...,
  source: metaResult.debug?.source,
  cachePolicy: metaResult.debug?.cachePolicy,
  periodType: metaResult.debug?.periodType,
  dataSourcePriority: metaResult.debug?.dataSourcePriority,
  // ... more debug info
});
```

**Impact**: Can now see exactly what data source PDF is using and why.

---

## 🎯 Expected Behavior After Fix

### Current Week PDF (Nov 17-23, 2025)

```
PDF Request: Nov 17-23, 2025
    ↓
StandardizedDataFetcher detects: isCurrentWeek = true ✅
    ↓
needsSmartCache = true ✅
    ↓
fetchFromWeeklySmartCache() ✅
    ↓
Overlap check passes ✅
    ↓
Gets data from meta-weekly-cache ✅
    ↓
Returns: 3710,28 zł spend, 268.3K impressions, 7.2K clicks ✅
```

### Historical Week PDF (Past Week)

```
PDF Request: Past week (e.g., Nov 10-16, 2025)
    ↓
StandardizedDataFetcher detects: isCurrentWeek = false ✅
    ↓
needsSmartCache = false ✅
    ↓
fetchFromCachedSummaries() ✅
    ↓
Queries campaign_summaries with summary_type='weekly' ✅
    ↓
Returns archived data ✅
```

---

## 📊 Testing Checklist

### Test 1: Current Week PDF
- [ ] Generate PDF for current week (Nov 17-23)
- [ ] Verify it shows same data as /reports page
- [ ] Check logs: Should show `source: 'meta-weekly-cache'`
- [ ] Verify spend, impressions, clicks match reports page

### Test 2: Historical Week PDF
- [ ] Generate PDF for past week
- [ ] Verify it shows archived data from database
- [ ] Check logs: Should show `source: 'campaign-summaries-database'`
- [ ] Verify data is correct

### Test 3: Monthly PDF (Regression)
- [ ] Generate PDF for current month
- [ ] Verify it still works correctly
- [ ] Check logs: Should show `source: 'smart-cache-system'` or `'campaign-summaries-database'`

---

## 🔍 Debugging

If PDF still shows zeros, check logs for:

1. **Period Detection**:
```
🎯 STRICT PERIOD CLASSIFICATION:
  isCurrentWeek: true/false
  needsSmartCache: true/false
  strategy: 'SMART_CACHE' or 'DATABASE_FIRST'
```

2. **Data Source**:
```
🔍 META DATA SOURCE DEBUG:
  source: 'meta-weekly-cache' or 'campaign-summaries-database'
  totalSpend: 3710.28 or 0
  periodType: 'current-week' or 'historical'
```

3. **Cache Lookup**:
```
📅 WEEKLY SMART CACHE:
  Week validated: true/false
  isOverlapping: true/false
```

---

## 🎯 Success Criteria

After fix:
- ✅ Current week PDFs show same data as /reports page
- ✅ Historical week PDFs show archived data
- ✅ Monthly PDFs continue working (no regression)
- ✅ All data sources logged for debugging

---

## 📋 Files Modified

1. `src/lib/standardized-data-fetcher.ts`
   - More flexible current week detection
   - More flexible weekly cache overlap check

2. `src/app/api/generate-pdf/route.ts`
   - Enhanced logging for debugging

---

**Status**: ✅ **FIXES APPLIED**  
**Next Step**: Test with current week PDF generation  
**Expected Result**: PDF should now show same data as /reports page

