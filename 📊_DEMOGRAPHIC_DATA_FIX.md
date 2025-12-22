# Demographic Data Fix for Weekly Reports

## Problem Identified ✅

**Root Cause**: The `/api/fetch-meta-tables` endpoint was only checking for **current month** periods, not **current week** periods. This caused weekly reports to skip the smart cache and fail to fetch demographic/placement data.

### Evidence
```
[WARN] ⚠️ No demographic data available for charts
demographicLength: 0
demographicSample: []
```

## Code Issues Found

### 1. `src/app/api/fetch-meta-tables/route.ts`
**Before**:
- Only checked `isCurrentMonth` (line 106-109)
- Did NOT check for weekly periods at all
- Weekly requests would fall through to live API fetch, which often returned empty data

**After**:
- ✅ Now calculates `isWeeklyRequest` based on date range (daysDiff <=7)
- ✅ Now checks `isCurrentWeek` (weekly request that includes today)
- ✅ Routes to `getSmartWeekCacheData()` for weekly periods
- ✅ Routes to `getSmartCacheData()` for monthly periods

### 2. Smart Cache Routing
**Weekly Periods**:
```typescript
if (isCurrentWeek) {
  const { getSmartWeekCacheData } = await import('../../../lib/smart-cache-helper');
  const { getCurrentWeekInfo } = await import('../../../lib/week-utils');
  const currentWeek = getCurrentWeekInfo();
  cacheResult = await getSmartWeekCacheData(clientId, false, currentWeek.periodId);
}
```

**Monthly Periods**:
```typescript
else {
  const { getSmartCacheData } = await import('../../../lib/smart-cache-helper');
  cacheResult = await getSmartCacheData(clientId, false, 'meta');
}
```

## Changes Made ✅

### `/src/app/api/fetch-meta-tables/route.ts`

1. **Line 99-127**: Added weekly period detection
```typescript
// Calculate if this is a weekly or monthly request
const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
const isWeeklyRequest = daysDiff <= 7;

// Check if this is current week
const isCurrentWeek = isWeeklyRequest && startDate <= now && endDate >= now;
```

2. **Line 129-153**: Added conditional cache routing
- Weekly periods → `getSmartWeekCacheData()`
- Monthly periods → `getSmartCacheData()`

3. **Line 172-190**: Updated response source indicator
- Now shows `'weekly-smart-cache'` for weekly periods
- Shows `'monthly-smart-cache'` for monthly periods

## Testing Steps

1. ✅ Refresh the `/reports` page for current week
2. ✅ Check that "Wyniki Demograficzne" section shows data
3. ✅ Generate a weekly PDF
4. ✅ Verify demographic charts appear in PDF
5. ✅ Check logs for `📊 Smart WEEKLY cache result:`

## Expected Results

### Before Fix:
- demographicPerformance: `[]` (empty)
- placementPerformance: `[]` or minimal data
- Warning: "No demographic data available for charts"

### After Fix:
- demographicPerformance: Array with age/gender data
- placementPerformance: Array with platform/position data
- Source: `weekly-smart-cache` or `monthly-smart-cache`

## Related Systems

This fix ensures that:
- ✅ Weekly reports fetch demographic data from `current_week_cache`
- ✅ Monthly reports fetch demographic data from `current_month_cache`
- ✅ Both PDFs and `/reports` page use the same data source
- ✅ Consistent behavior between weekly and monthly periods

## Impact

- ✅ Weekly PDFs: Will now show demographic/placement data
- ✅ Weekly Reports: Demographics tab will populate correctly
- ✅ Data Consistency: Same source for UI and PDF
- ✅ Performance: Uses cached data instead of live API

