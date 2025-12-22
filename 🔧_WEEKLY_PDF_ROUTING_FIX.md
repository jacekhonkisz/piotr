# Weekly PDF Routing Fix - Complete Audit & Solution

## Problem Identified

Weekly PDFs were displaying corrupted data (huge numbers, zeros) instead of correct values from smart cache. The root cause was **incorrect routing** - current week requests were being routed to `campaign_summaries` database instead of `current_week_cache` smart cache.

## Root Cause Analysis

### Issue 1: Strict End Date Matching
**Location**: `src/app/api/fetch-live-data/route.ts` (line 126) and `src/lib/standardized-data-fetcher.ts` (line 851-864)

**Problem**: 
- Requested end date: `2025-11-23` (Sunday - full week)
- Current week end date: `2025-11-21` (today - capped to today)
- The strict check `endDate === currentWeekInfo.endDate` failed
- This caused routing to database instead of smart cache

**Log Evidence**:
```
Line 37-48: STRICT WEEK CHECK failed
  endDateMatches: false
  reasoning: 'PAST WEEK (use database)'
  
Line 83: 📊 🔒 HISTORICAL PERIOD - ENFORCING DATABASE-FIRST POLICY
Line 118: 🚀 ✅ DATABASE SUCCESS: Historical data loaded in 371ms
```

### Issue 2: Overlap Check Too Strict
**Location**: `src/lib/standardized-data-fetcher.ts` (line 851-864)

**Problem**: 
- `fetchFromWeeklySmartCache` had strict overlap validation
- Requested range (Mon-Sun) didn't exactly match cached range (Mon-Today)
- This caused cache miss and database fallback

## Solution Applied

### Fix 1: Flexible Current Week Detection
**File**: `src/app/api/fetch-live-data/route.ts`

**Change**: Removed strict end date matching requirement
```typescript
// BEFORE: Required exact end date match
const result = startMatches && endMatches && isExactWeek && includesCurrentDay;

// AFTER: Accept if start matches AND includes today (even if end extends beyond)
const result = startMatches && includesCurrentDay && isExactWeek;
```

**Rationale**: Mon-Sun request (2025-11-17 to 2025-11-23) should use Mon-Today cache (2025-11-17 to 2025-11-21) when we're in the middle of the week.

### Fix 2: Flexible Overlap Check
**File**: `src/lib/standardized-data-fetcher.ts`

**Change**: Made overlap check more flexible for current week requests
```typescript
// ✅ CRITICAL FIX: More flexible overlap check for current week
// For current week requests, accept if:
// 1. Start date matches current week start (Monday), OR
// 2. Any part of requested range overlaps with current week

const startMatches = requestedStartStr === currentWeekStartStr;
const hasOverlap = requestedStart <= currentWeekEnd && requestedEnd >= currentWeekStart;
const isOverlapping = startMatches || hasOverlap;

// ✅ LOG: Show why we're accepting this request
if (startMatches && requestedEndStr > currentWeekEndStr) {
  console.log(`✅ Week start matches - accepting even though end extends to ${requestedEndStr}`);
  console.log(`✅ This is correct: Mon-Sun request should use Mon-Today cache data`);
}
```

**Rationale**: When start date matches (same week), accept the request even if end date extends to Sunday. The cache data (Mon-Today) is still valid for the Mon-Sun request.

## Data Flow After Fix

### Current Week Requests (e.g., 2025-11-17 to 2025-11-23)
1. ✅ `StandardizedDataFetcher` correctly identifies as current week
2. ✅ `fetchFromWeeklySmartCache` accepts request (start matches, overlap confirmed)
3. ✅ Data fetched from `current_week_cache` table
4. ✅ Correct, up-to-date data returned

### Historical Week Requests
1. ✅ `StandardizedDataFetcher` correctly identifies as historical
2. ✅ Routes to `campaign_summaries` database
3. ✅ Historical data returned

## Verification

After fix, logs should show:
- ✅ `isCurrentWeek: true`
- ✅ `willUseWeeklyCache: true`
- ✅ `routingDecision: '🟡 WEEKLY CACHE'`
- ✅ `✅ Week start matches - accepting even though end extends...`
- ✅ Data source: `current_week_cache` (not `campaign_summaries`)

## Files Modified

1. `src/lib/standardized-data-fetcher.ts` - Flexible overlap check in `fetchFromWeeklySmartCache`
2. `src/app/api/fetch-live-data/route.ts` - Flexible current week detection in `isCurrentWeek()`

## Testing

To verify the fix:
1. Generate a weekly PDF for current week (Mon-Sun range)
2. Check logs for routing decision
3. Verify data source is `current_week_cache`
4. Confirm data matches `/reports` page

