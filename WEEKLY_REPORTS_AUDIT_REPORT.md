# Weekly Reports Data Duplication Audit Report

## Issue Summary
All weekly periods in the reports page are showing identical data instead of period-specific data. This is causing confusion as users expect different weeks to show different metrics.

## Root Causes Identified

### 1. **Smart Cache Always Returns Current Week Data**
**Location**: `src/lib/smart-cache-helper.ts:711-848`

**Problem**: The `getSmartWeekCacheData()` function always uses `getCurrentWeekInfo()` to determine the cache key and data source, regardless of which historical week is being requested.

```typescript
// Line 712: Always gets current week info
const currentWeek = getCurrentWeekInfo();
const cacheKey = `${clientId}_${currentWeek.periodId}`;
```

**Impact**: When requesting data for week 2025-W30, 2025-W31, etc., the system always fetches and returns data for the current week (2025-W51).

### 2. **Force Refresh Flag Always Enabled**
**Location**: `src/lib/smart-cache-helper.ts:743`

**Problem**: The `FORCE_LIVE_DATA_FOR_BOOKING_STEPS` flag is hardcoded to `true`, which bypasses all caching and always fetches fresh current week data.

```typescript
const FORCE_LIVE_DATA_FOR_BOOKING_STEPS = true; // ❌ Always forces current week
```

### 3. **Reports Page Forces Fresh Data for All Weeks**
**Location**: `src/app/reports/page.tsx:911-942`

**Problem**: Multiple force refresh flags ensure that weekly data is never cached or retrieved from historical storage:

```typescript
const forceWeeklyFresh = viewType === 'weekly';           // ❌ Always true for weekly
const forceAllWeeklyFresh = viewType === 'weekly';       // ❌ Always true for weekly
```

### 4. **Current Week Detection Logic Flaw**
**Location**: `src/app/reports/page.tsx:923-930`

**Problem**: For weekly view, the system always treats periods as "current":

```typescript
const isCurrentMonth = (() => {
  if (viewType === 'monthly') {
    // Proper month comparison logic
  }
  return false; // ❌ For weekly, always treat as current
})();
```

### 5. **API Endpoint Mismatch**
**Location**: `src/app/reports/page.tsx:467-495`

**Problem**: When requesting historical weekly data, the system calls the current week smart cache endpoint instead of the historical data endpoint:

```typescript
// ❌ Always calls current week endpoint regardless of requested period
const cacheResult = await getSmartWeekCacheData(clientId, false);
```

## Data Flow Analysis

### Current (Broken) Flow:
1. User selects "Week 30 (22.07 - 28.07.2025)"
2. System generates correct period ID: `2025-W30`
3. System calculates correct date range: `2025-07-22` to `2025-07-28`
4. **BUG**: System calls `getSmartWeekCacheData()` which ignores the requested period
5. **BUG**: Smart cache always fetches current week data (2025-W51)
6. **BUG**: All weeks show identical current week data

### Expected (Correct) Flow:
1. User selects "Week 30 (22.07 - 28.07.2025)"
2. System generates period ID: `2025-W30`
3. System calculates date range: `2025-07-22` to `2025-07-28`
4. **FIX**: System checks if this is current week vs historical week
5. **FIX**: For historical weeks, fetch from `campaign_summaries` table
6. **FIX**: For current week, use smart cache with proper period handling

## Impact Assessment

### Affected Components:
- ✅ **Monthly Reports**: Working correctly (proper period handling)
- ❌ **Weekly Reports**: All periods show identical data
- ✅ **All-Time Reports**: Working correctly
- ✅ **Custom Date Reports**: Working correctly

### User Experience Impact:
- **High**: Users cannot analyze weekly performance trends
- **High**: Historical weekly data appears lost/corrupted
- **Medium**: Confusion about data accuracy and system reliability

## Recommended Fixes

### 1. **Fix Smart Cache Period Handling** (Critical)
**File**: `src/lib/smart-cache-helper.ts`

```typescript
// ❌ Current (broken)
export async function getSmartWeekCacheData(clientId: string, forceRefresh: boolean = false) {
  const currentWeek = getCurrentWeekInfo(); // Always current week
  
// ✅ Fixed
export async function getSmartWeekCacheData(clientId: string, forceRefresh: boolean = false, requestedPeriodId?: string) {
  const targetWeek = requestedPeriodId ? parseWeekPeriodId(requestedPeriodId) : getCurrentWeekInfo();
```

### 2. **Disable Force Refresh for Historical Weeks** (Critical)
**File**: `src/lib/smart-cache-helper.ts`

```typescript
// ❌ Current
const FORCE_LIVE_DATA_FOR_BOOKING_STEPS = true;

// ✅ Fixed
const FORCE_LIVE_DATA_FOR_BOOKING_STEPS = false; // Only force for current week if needed
```

### 3. **Implement Proper Historical Week Detection** (Critical)
**File**: `src/app/reports/page.tsx`

```typescript
// ✅ Add proper week comparison logic
const isCurrentWeek = (() => {
  if (viewType === 'weekly') {
    const currentWeek = getCurrentWeekInfo();
    return periodId === currentWeek.periodId;
  }
  return false;
})();
```

### 4. **Route Historical vs Current Week Requests** (Critical)
**File**: `src/app/reports/page.tsx`

```typescript
// ✅ Route to appropriate data source
if (viewType === 'weekly') {
  if (isCurrentWeek) {
    // Use smart cache for current week
    const cacheResult = await getSmartWeekCacheData(clientId, false, periodId);
  } else {
    // Use database for historical weeks
    const historicalData = await loadFromDatabase(clientId, periodStartDate, periodEndDate);
  }
}
```

### 5. **Create Historical Week Data Loader** (Medium Priority)
**File**: `src/lib/historical-week-loader.ts` (new file)

```typescript
export async function loadHistoricalWeekData(clientId: string, periodId: string) {
  // Parse period ID to get date range
  const dateRange = parseWeekPeriodId(periodId);
  
  // Query campaign_summaries table for stored weekly data
  const { data, error } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_date', dateRange.start)
    .eq('summary_type', 'weekly')
    .single();
    
  return formatWeeklyReportData(data);
}
```

## Testing Strategy

### 1. **Verify Current Week Functionality**
- Test that current week (2025-W51) shows live/cached data
- Verify smart cache is working for current week

### 2. **Test Historical Week Data**
- Test weeks 2025-W30, 2025-W31, 2025-W32 show different data
- Verify data matches what's stored in `campaign_summaries` table

### 3. **Test Week Transitions**
- Test behavior when switching between current and historical weeks
- Verify no data bleeding between periods

## Implementation Priority

### Phase 1 (Immediate - Critical Fixes)
1. Fix smart cache period handling
2. Disable force refresh for historical weeks
3. Add proper current week detection

### Phase 2 (Short-term - Data Routing)
1. Implement historical vs current week routing
2. Create historical week data loader
3. Add proper error handling

### Phase 3 (Long-term - Optimization)
1. Optimize historical week caching
2. Add week-specific cache invalidation
3. Implement background historical data collection

## Database Impact

### Tables Affected:
- `current_week_cache`: Used for current week only
- `campaign_summaries`: Source for historical weekly data
- No schema changes required

### Data Verification Needed:
- Verify `campaign_summaries` contains weekly data for requested periods
- Check if weekly data collection is running properly
- Ensure date ranges in stored data match period calculations

## Conclusion

The weekly reports issue is caused by a fundamental flaw in the caching system that always returns current week data regardless of the requested period. The fix requires routing historical week requests to the database while keeping current week requests in the smart cache system.

**Estimated Fix Time**: 4-6 hours
**Risk Level**: Low (fixes are isolated to weekly functionality)
**Testing Required**: Medium (need to verify both current and historical weeks)
