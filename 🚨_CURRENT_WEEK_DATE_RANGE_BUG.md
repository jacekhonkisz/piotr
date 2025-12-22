# 🚨 Current Week Date Range Bug

## Problem Identified

The current week fetching logic has a **date range mismatch** when a `requestedPeriodId` is provided.

### The Bug

In `getSmartWeekCacheData()` at line 1361:

```typescript
const targetWeek = requestedPeriodId ? parseWeekPeriodId(requestedPeriodId) : getCurrentWeekInfo();
```

**Issue:**
- When `requestedPeriodId` is **NOT provided**: Uses `getCurrentWeekInfo()` → ✅ End date capped to today
- When `requestedPeriodId` **IS provided**: Uses `parseWeekPeriodId()` → ❌ End date is full week (Sunday, including future dates)

### Impact

1. **Current week requests without periodId**: ✅ Correctly fetches up to today
   - Example: `2025-11-17` to `2025-11-20` (today is Thursday)

2. **Current week requests WITH periodId**: ❌ Fetches full week including future dates
   - Example: `2025-11-17` to `2025-11-23` (includes Friday, Saturday, Sunday - future dates!)
   - Meta API may reject future dates or return incorrect data

### Root Cause

`parseWeekPeriodId()` always returns the full ISO week boundaries (Monday to Sunday), while `getCurrentWeekInfo()` caps the end date to today for the current week.

### Example

**Today: 2025-11-20 (Thursday)**

```typescript
// Without periodId (correct)
getCurrentWeekInfo()
// Returns: { startDate: "2025-11-17", endDate: "2025-11-20" } ✅

// With periodId "2025-W47" (incorrect)
parseWeekPeriodId("2025-W47")
// Returns: { startDate: "2025-11-17", endDate: "2025-11-23" } ❌
// This includes future dates (Friday, Saturday, Sunday)!
```

### Fix Required

When `requestedPeriodId` is provided AND it's the current week, we should:
1. Use `parseWeekPeriodId()` to get the week boundaries
2. **Then cap the end date to today** if it's the current week

### Proposed Fix

```typescript
export async function getSmartWeekCacheData(clientId: string, forceRefresh: boolean = false, requestedPeriodId?: string) {
  // Use requested period or default to current week
  let targetWeek = requestedPeriodId ? parseWeekPeriodId(requestedPeriodId) : getCurrentWeekInfo();
  
  // 🔧 FIX: If this is the current week, cap end date to today
  const isCurrentWeekRequest = isCurrentWeekPeriod(targetWeek.periodId);
  if (isCurrentWeekRequest) {
    const currentWeekInfo = getCurrentWeekInfo();
    // Use the capped end date from getCurrentWeekInfo()
    targetWeek = {
      ...targetWeek,
      endDate: currentWeekInfo.endDate // Use capped end date
    };
  }
  
  // ... rest of function
}
```

This ensures that:
- ✅ Historical weeks use full week boundaries (correct)
- ✅ Current week always uses today as end date (correct)
- ✅ No future dates are passed to Meta API



