# 🔧 CRITICAL FIX: Weekly Routing Issue

**Date:** November 18, 2025  
**Issue:** Current week requests are being routed to monthly cache

---

## 🚨 PROBLEM IDENTIFIED

**User Report:**
> "current week is using monthly not weekly"

**Root Cause:**
The `isCurrentWeekRequest` check at line 632 is failing to properly identify current week requests, causing them to fall through to the monthly cache logic.

---

## 🔍 ROUTING LOGIC ANALYSIS

### Current Flow (fetch-live-data/route.ts):

```typescript
// Line 627-632
const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
const requestType = daysDiff <= 8 ? 'weekly' : 'monthly';

const isCurrentMonthRequest = requestType === 'monthly' && isCurrentMonth(startDate, endDate);
const isCurrentWeekRequest = requestType === 'weekly' && isCurrentWeek(startDate, endDate);
```

### Routing Priority:
1. **Line 662:** `if (!isCurrentMonthRequest && !isCurrentWeekRequest)` → **DATABASE** (historical)
2. **Line 814:** `else if (isCurrentWeekRequest && !forceFresh)` → **WEEKLY CACHE** ✅
3. **Line 883:** `else if (isCurrentMonthRequest && !isCurrentWeekRequest && !forceFresh)` → **MONTHLY CACHE** ❌

---

## 🎯 THE BUG

### Scenario: User requests current week (Nov 17-23, 2025)

**Step 1:** Calculate `daysDiff`
- start: 2025-11-17
- end: 2025-11-23
- daysDiff = 7
- requestType = 'weekly' ✅

**Step 2:** Check `isCurrentWeek()`
```typescript
// Function at line 100-148
function isCurrentWeek(startDate: string, endDate: string): boolean {
  const currentWeekInfo = getCurrentWeekInfo();
  
  // STRICT checks:
  const startMatches = startDate === currentWeekInfo.startDate;
  const endMatches = endDate === currentWeekInfo.endDate;
  const isExactWeek = daysDiff === 7 && isMondayStart;
  const includesCurrentDay = endDate >= today;
  
  return startMatches && endMatches && isExactWeek && includesCurrentDay;
}
```

**Potential Issues:**
1. `getCurrentWeekInfo()` might return wrong dates
2. String comparison might fail due to format differences
3. `isMondayStart` check might fail
4. Date timezone issues

---

## 🔬 DIAGNOSTIC STEPS

### 1. Check what `isCurrentWeekRequest` returns:

Add logging to see actual values:

```typescript
console.log('🔍 WEEKLY REQUEST CHECK:', {
  startDate,
  endDate,
  daysDiff,
  requestType,
  currentWeekInfo: getCurrentWeekInfo(),
  isCurrentWeekRequest,
  isCurrentMonthRequest,
  willRoute: isCurrentWeekRequest ? 'WEEKLY CACHE' : 
              isCurrentMonthRequest ? 'MONTHLY CACHE' : 'DATABASE'
});
```

### 2. Check browser DevTools:

Look for log message:
- If you see "🟡 CURRENT WEEK DETECTED" → Weekly cache used ✅
- If you see "🔴 CURRENT MONTH DETECTED" → Monthly cache used ❌
- If you see "🔒 HISTORICAL PERIOD" → Database used

### 3. Check response debug info:

Response should have:
```json
{
  "debug": {
    "source": "weekly-smart-cache" // ← Should be this for current week
    // NOT "smart-cache" or "monthly-cache"
  }
}
```

---

## 🔧 POTENTIAL FIXES

### Fix 1: Improve isCurrentWeek() Detection

**Problem:** Too strict - might fail on edge cases

**Solution:**
```typescript
function isCurrentWeek(startDate: string, endDate: string): boolean {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Check if this is a 7-day period that includes today
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Must be exactly 7 days
  if (daysDiff !== 7) return false;
  
  // Must include today
  if (endDate < today || startDate > today) return false;
  
  // Must start on Monday
  if (start.getDay() !== 1) return false;
  
  return true;
}
```

### Fix 2: Add Fallback Logic

**Problem:** If weekly cache fails, don't fall through to monthly

**Solution:**
```typescript
} else if (isCurrentWeekRequest && !forceFresh) {
  // Try weekly cache
  const weeklyResult = await getSmartWeekCacheData(clientId, false, periodId);
  
  if (weeklyResult.success) {
    return NextResponse.json({
      success: true,
      data: weeklyResult.data,
      debug: { source: 'weekly-smart-cache' }
    });
  }
  
  // ✅ FIX: Don't fall through to monthly - fetch live instead
  logger.warn('Weekly cache failed, fetching live data for current week');
  // ... fetch live weekly data ...
}
```

### Fix 3: Stricter Routing Guard

**Problem:** Weekly requests reaching monthly cache

**Solution:** Already implemented on line 883:
```typescript
} else if (isCurrentMonthRequest && !isCurrentWeekRequest && !forceFresh) {
  // ✅ This should prevent fallthrough
}
```

But this only works if `isCurrentWeekRequest` is correctly set!

---

## 🚀 IMMEDIATE ACTION PLAN

### Step 1: Add Debug Logging

```bash
# In fetch-live-data/route.ts, after line 632, add:
console.log('🔍 ROUTING DEBUG:', {
  dateRange: { startDate, endDate },
  daysDiff,
  requestType,
  isCurrentWeekRequest,
  isCurrentMonthRequest,
  currentWeekInfo: getCurrentWeekInfo(),
  today: new Date().toISOString().split('T')[0],
  willRoute: isCurrentWeekRequest ? 'WEEKLY' : 
              isCurrentMonthRequest ? 'MONTHLY' : 'DATABASE'
});
```

### Step 2: Test with Actual Request

Ask user to:
1. Open reports page
2. Open DevTools Console
3. Select current week
4. Share the console output for "🔍 ROUTING DEBUG"

### Step 3: Fix Based on Findings

Based on the debug output, we'll know:
- Is `isCurrentWeekRequest` TRUE or FALSE?
- What are the actual date values?
- Where is the request being routed?

---

## 📊 EXPECTED BEHAVIOR

### Current Week (Nov 17-23, 2025):
```
Input: { startDate: '2025-11-17', endDate: '2025-11-23' }

Expected:
- daysDiff: 7
- requestType: 'weekly'
- isCurrentWeekRequest: TRUE ✅
- isCurrentMonthRequest: FALSE
- Route: WEEKLY CACHE
- Log: "🟡 CURRENT WEEK DETECTED"
- Response source: "weekly-smart-cache"
```

### Past Week (Nov 10-16, 2025):
```
Input: { startDate: '2025-11-10', endDate: '2025-11-16' }

Expected:
- daysDiff: 7
- requestType: 'weekly'
- isCurrentWeekRequest: FALSE
- isCurrentMonthRequest: FALSE
- Route: DATABASE
- Log: "🔒 HISTORICAL PERIOD"
- Response source: "database-historical"
```

---

## 🎯 NEXT STEPS

1. **Add debug logging** to identify where routing goes wrong
2. **Get actual console output** from user for current week request
3. **Fix `isCurrentWeek()` logic** if it's returning wrong value
4. **Add failsafe** to prevent weekly→monthly fallthrough
5. **Test with user** to confirm fix

---

**Priority:** CRITICAL - This is causing current week to show monthly data!

