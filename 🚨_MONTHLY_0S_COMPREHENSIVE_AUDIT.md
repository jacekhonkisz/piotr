# 🚨 MONTHLY DATA SHOWING 0s - COMPREHENSIVE AUDIT

## Problem Report
**Date**: November 17, 2025  
**Issue**: Current monthly data (November 2025) showing ALL 0s  
**Working**: Current week showing correct data  
**Working**: Historical months showing correct data  
**Status**: 🔴 **CRITICAL BUG IDENTIFIED**

---

## User Report
- ✅ **Historical data**: Looks alright  
- ❌ **Current monthly (Belmonte)**: Showing 0s  
- ✅ **Current WEEK**: Showing numbers correctly  

---

## 🎯 ROOT CAUSE IDENTIFIED

### **File**: `src/app/api/fetch-live-data/route.ts`  
### **Lines**: 173-186

```typescript
const isExactCurrentMonth = (
  summaryType === 'monthly' && 
  requestYear === currentYear && 
  requestMonth === currentMonth &&
  endDate >= today  // ⬅️ BUG IS HERE!
);
```

### **The Problem**:

**November 2025 Request**:
- `startDate`: `"2025-11-01"`
- `endDate`: `"2025-11-30"` (full month boundary)
- `today`: `"2025-11-17"` (current date)
- `endDate >= today`: `"2025-11-30" >= "2025-11-17"` = **TRUE**
- **Result**: `isExactCurrentMonth = TRUE`
- **Action**: Routes to SMART CACHE

**Week Request (Working)**:
- `startDate`: `"2025-11-11"`
- `endDate`: `"2025-11-17"` (current week)
- `today`: `"2025-11-17"`
- Includes today, gets LIVE API data
- **Result**: Data appears correctly!

---

## Why Smart Cache Returns 0s

### **Smart Cache Logic** (Lines 188-320):

```typescript
if (isExactCurrentMonth || isCurrentWeek) {
  // Uses smart-cache-manager.ts
  // Returns cached data OR fetches fresh if cache expired
}
```

### **Possible Issues**:

1. **Cache Not Populated**
   - Smart cache collection hasn't run for current month yet
   - Daily KPI collection may be disabled
   - Cache refresh endpoint not being called

2. **Cache Expiry**
   - 3-hour cache might have expired
   - No fresh data fetched when cache is stale

3. **Date Range Mismatch**
   - Cache stores data for partial month (Nov 1-17)
   - Request asks for full month (Nov 1-30)
   - Cache returns empty because dates don't match exactly

4. **Database Query Issue**
   - Cache queries `daily_kpi_data` table
   - Query might be using wrong date filter
   - Returns 0 campaigns if no exact match

---

## Why Week Works But Month Doesn't

| Aspect | Weekly (WORKS) | Monthly (FAILS) |
|--------|----------------|-----------------|
| **Date Range** | Nov 11-17 (actual days) | Nov 1-30 (full month) |
| **Today Check** | End includes today | End is future (Nov 30) |
| **Data Source** | LIVE API (fresh) | SMART CACHE (stale/empty) |
| **Cache Behavior** | Skip cache, fetch fresh | Use cached (0s returned) |
| **Result** | ✅ Real numbers | ❌ All zeros |

---

## Code Flow Analysis

### **Monthly Request Flow** (BROKEN):

```
1. User selects November 2025
   ↓
2. getMonthBoundaries(2025, 11) 
   → Returns: { start: "2025-11-01", end: "2025-11-30" }
   ↓
3. Check: isExactCurrentMonth?
   → endDate ("2025-11-30") >= today ("2025-11-17") = TRUE ✅
   ↓
4. Route to SMART CACHE
   ↓
5. Smart cache queries daily_kpi_data
   → Looks for data matching EXACTLY "2025-11-01" to "2025-11-30"
   → But only has data until "2025-11-17"
   ↓
6. Cache returns EMPTY or INCOMPLETE
   ↓
7. Response: { campaigns: [] } (ALL 0s)
```

### **Weekly Request Flow** (WORKING):

```
1. User selects Current Week
   ↓
2. getWeekBoundaries() 
   → Returns: { start: "2025-11-11", end: "2025-11-17" }
   ↓
3. Check: isCurrentWeek?
   → start <= now && end >= now = TRUE ✅
   ↓
4. Route to LIVE API (skips cache for current week)
   ↓
5. Calls Meta API with actual date range
   ↓
6. Meta API returns REAL data for Nov 11-17
   ↓
7. Response: { campaigns: [...], spend: 24908.79 } ✅
```

---

## 🔧 SOLUTIONS

### **Solution 1: Fix Current Month Logic** (RECOMMENDED)

**Change**: Adjust `isExactCurrentMonth` check to cap at today

```typescript
// BEFORE (BROKEN):
const isExactCurrentMonth = (
  summaryType === 'monthly' && 
  requestYear === currentYear && 
  requestMonth === currentMonth &&
  endDate >= today  // Allows future dates
);

// AFTER (FIXED):
const isExactCurrentMonth = (
  summaryType === 'monthly' && 
  requestYear === currentYear && 
  requestMonth === currentMonth
  // Removed future date check - use cache for current month regardless
);

// OR cap the endDate to today for current month
const adjustedEndDate = isCurrentMonthRequest ? 
  Math.min(new Date(endDate), new Date(today)) : 
  endDate;
```

**Impact**:
- Current month will use smart cache
- But cache needs to have data up to today
- Requires cache to be populated correctly

---

### **Solution 2: Force Live API for Current Month** (QUICK FIX)

**Change**: Treat current month like current week - always fetch live

```typescript
const isPastPeriod = !isCurrentWeek; // Remove isExactCurrentMonth check

// Then later:
if (isPastPeriod) {
  // Use database
} else {
  // Use LIVE API for current month AND current week
}
```

**Impact**:
- Current month always gets fresh data
- Slower (hits Meta API every time)
- But guaranteed to show correct data

---

### **Solution 3: Cap Month Request to Today** (HYBRID)

**Change**: Adjust date range for current month requests

```typescript
if (summaryType === 'monthly' && isExactCurrentMonth) {
  // Cap end date to today for current month
  const cappedEndDate = end Date > today ? today : endDate;
  
  console.log(`📅 Current month detected, capping to today:`, {
    originalEnd: endDate,
    cappedEnd: cappedEndDate,
    reason: 'Cannot fetch future data'
  });
  
  endDate = cappedEndDate;
}
```

**Impact**:
- Requests data only up to today
- Cache can match the date range
- More likely to return data

---

## 🧪 Testing Plan

### **Test 1: Verify Cache Contents**
```sql
SELECT 
  date,
  COUNT(*) as campaign_count,
  SUM(spend) as total_spend
FROM daily_kpi_data
WHERE client_id = 'BELMONTE_CLIENT_ID'
  AND date >= '2025-11-01'
  AND date <= '2025-11-17'
  AND platform = 'meta'
GROUP BY date
ORDER BY date DESC;
```

**Expected**: Should show data for each day Nov 1-17

---

### **Test 2: Check Smart Cache Manager**
```typescript
// In smart-cache-manager.ts
// Add logging to see what's being queried and returned
console.log('🔍 Cache query:', { startDate, endDate, today });
console.log('🔍 Cache result:', { campaigns: result.length });
```

---

### **Test 3: Force Live API**
```typescript
// Temporarily bypass cache for current month
if (isExactCurrentMonth) {
  console.log('⚠️ FORCING LIVE API for current month testing');
  return await fetchFromMetaAPI(clientId, startDate, today); // Cap to today
}
```

---

## 📊 Database Investigation

### **Check Daily KPI Data**:
```sql
-- Check if current month has any data
SELECT * FROM daily_kpi_data 
WHERE client_id = 'BELMONTE_ID'
AND date BETWEEN '2025-11-01' AND '2025-11-17'
ORDER BY date DESC
LIMIT 10;
```

### **Check Campaign Summaries**:
```sql
-- Check if monthly summary exists
SELECT * FROM campaign_summaries
WHERE client_id = 'BELMONTE_ID'
AND summary_type = 'monthly'
AND summary_date >= '2025-11-01'
ORDER BY summary_date DESC;
```

---

## 🚨 IMMEDIATE ACTION REQUIRED

### **Priority 1**: Cap Current Month to Today
Modify `loadFromDatabase()` function to cap current month requests:

```typescript
// Around line 176-181
if (summaryType === 'monthly' && requestMonth === currentMonth) {
  // Cap to today for current month
  if (endDate > today) {
    console.log(`📅 Capping current month from ${endDate} to ${today}`);
    endDate = today;
  }
}
```

### **Priority 2**: Verify Cache Population
Check if daily KPI collection is running:
- `/api/automated/daily-kpi-collection` - Should run daily
- Verify `CRON_SECRET` is set
- Check Vercel cron logs

### **Priority 3**: Add Fallback Logic
If cache is empty for current month, fall back to live API:

```typescript
if (isExactCurrentMonth && cachedCampaigns.length === 0) {
  console.warn('⚠️ Cache empty for current month, falling back to live API');
  return await fetchFromMetaAPI(clientId, startDate, today);
}
```

---

## 🎯 RECOMMENDED FIX

**Implement Solution 3 (Cap to Today)**:

1. Cap `endDate` to `today` for current month requests
2. This makes cache query match available data
3. Add fallback to live API if cache is still empty
4. Keep existing smart cache system working

**Code Location**: `src/app/api/fetch-live-data/route.ts:173-186`

---

**Status**: ROOT CAUSE IDENTIFIED  
**Fix Required**: Modify current month date capping logic  
**ETA**: 30 minutes to implement and test  
**Priority**: P0 - CRITICAL (blocking current month reporting)

