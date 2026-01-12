# Frontend Routing Audit - Weekly/Monthly & Google/Meta Separation

## Audit Checklist

### 1. Weekly vs Monthly Detection ✅
**Location:** `src/app/reports/page.tsx:1671`
```typescript
const detectedViewType = periodId.includes('-W') ? 'weekly' : 'monthly';
```
**Status:** ✅ Correct - Detects weekly by `-W` in periodId

### 2. Date Range Calculation ✅
**Location:** `src/app/reports/page.tsx:1839-1884`
- **Monthly:** Uses `getMonthBoundaries(year, month)` ✅
- **Weekly:** Uses `parseWeekPeriodId(periodId)` from `week-utils` ✅
**Status:** ✅ Correct - Separate logic for weekly vs monthly

### 3. Platform Routing ✅
**Location:** `src/app/reports/page.tsx:1648-1651`
```typescript
const effectivePlatform = platform || activeAdsProvider;
```
**Status:** ✅ Correct - Uses explicit platform parameter or state

### 4. API Endpoint Selection ✅
**Location:** `src/app/reports/page.tsx:109-448` (`fetchReportDataUnified`)
- **Google Ads:** Routes to `/api/fetch-google-ads-live-data` ✅
- **Meta Ads:** Routes to `/api/fetch-live-data` ✅
**Status:** ✅ Correct - Separate endpoints for each platform

### 5. Backend Weekly/Monthly Detection ✅
**Google Ads API:** `src/app/api/fetch-google-ads-live-data/route.ts:540-549`
```typescript
const daysDiff = Math.ceil((requestEnd.getTime() - requestStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
const isWeeklyRequest = daysDiff <= 7;
```
**Status:** ✅ Correct - Detects weekly by date range

**Meta Ads API:** `src/app/api/fetch-live-data/route.ts:722-727`
```typescript
const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
const requestType = daysDiff === 7 ? 'weekly' : 'monthly';
```
**Status:** ✅ Correct - Detects weekly by date range

### 6. Database Query Separation ✅
**Google Ads:** `src/app/api/fetch-google-ads-live-data/route.ts:80-103`
- Uses `summary_type='weekly'` with exact Monday match ✅
- Uses `summary_type='monthly'` for monthly ✅
**Status:** ✅ Correct - Separate queries

**Meta Ads:** `src/app/api/fetch-live-data/route.ts:234-280`
- Uses `summary_type='weekly'` with exact Monday match ✅
- Uses `summary_type='monthly'` for monthly ✅
**Status:** ✅ Correct - Separate queries

## Potential Issues Found

### Issue 1: View Type Auto-Fix
**Location:** `src/app/reports/page.tsx:1671-1677`
```typescript
const detectedViewType = periodId.includes('-W') ? 'weekly' : 'monthly';
if (viewType !== detectedViewType) {
  console.log(`⚠️ View type mismatch: state=${viewType}, detected=${detectedViewType}, auto-fixing...`);
  setViewType(detectedViewType);
}
```
**Status:** ⚠️ This auto-fixes viewType but might cause UI flicker

### Issue 2: Platform State vs Parameter
**Location:** `src/app/reports/page.tsx:1651`
```typescript
const effectivePlatform = platform || activeAdsProvider;
```
**Status:** ✅ Correct - But need to verify platform is always passed correctly

## Recommendations

1. ✅ **Routing is correct** - Weekly/monthly and Google/Meta separation is properly implemented
2. ✅ **Date range calculation is correct** - Separate logic for weekly vs monthly
3. ✅ **Database queries are correct** - Proper separation by summary_type and platform
4. ⚠️ **Monitor viewType auto-fix** - May cause UI flicker if periodId doesn't match viewType

