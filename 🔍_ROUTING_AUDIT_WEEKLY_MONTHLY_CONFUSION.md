# 🔍 ROUTING AUDIT: Weekly/Monthly Data Confusion

**Date:** November 18, 2025  
**Issue:** System has problems distinguishing weekly from monthly data  
**Status:** 🚨 **CRITICAL INCONSISTENCY FOUND**

---

## 🚨 ROOT CAUSE: INCONSISTENT DAY DIFF THRESHOLDS

### Problem: Two Different Classification Rules

**Location 1:** `/src/app/api/fetch-live-data/route.ts` Line 647
```typescript
const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
const requestType = daysDiff <= 8 ? 'weekly' : 'monthly'; // ← 8 DAYS!
```

**Location 2:** `/src/app/api/fetch-live-data/route.ts` Line 157-158 (loadFromDatabase)
```typescript
const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
const summaryType = daysDiff <= 7 ? 'weekly' : 'monthly'; // ← 7 DAYS!
```

---

## 💥 THE CONFLICT

### Scenario: 8-Day Date Range

**What happens:**
1. Request comes in with 8-day date range (e.g., Nov 10-17)
2. **Main routing logic** (line 647): `daysDiff = 8 → requestType = 'weekly'` ✅
3. Routes to weekly cache path
4. Cache falls through to database
5. **loadFromDatabase** function (line 158): `daysDiff = 8 → summaryType = 'monthly'` ❌
6. Queries database with `summary_type = 'monthly'`
7. **Returns monthly data for a weekly request!** 🚨

### Example Timeline:
```
Nov 10 (Mon) → Nov 17 (Mon) = 8 days

Main routing:     "This is WEEKLY" (daysDiff <= 8)
loadFromDatabase: "This is MONTHLY" (daysDiff > 7)

Result: User requests Week 46, gets November monthly data!
```

---

## 📊 AFFECTED CODE PATHS

### Path 1: Main POST Handler (Line 647)
```typescript
// Line 644-651
const start = new Date(startDate);
const end = new Date(endDate);
const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
const requestType = daysDiff <= 8 ? 'weekly' : 'monthly'; // 🔧 FIX: Allow up to 8 days

// Apply current/historical logic based on request type
const isCurrentMonthRequest = requestType === 'monthly' && isCurrentMonth(startDate, endDate);
const isCurrentWeekRequest = requestType === 'weekly' && isCurrentWeek(startDate, endDate);
```

**Note:** Comment says "week can span month boundary" - this is why it allows 8 days

### Path 2: loadFromDatabase Function (Line 157)
```typescript
// Line 154-160
const start = new Date(startDate);
const end = new Date(endDate);
const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
const summaryType = daysDiff <= 7 ? 'weekly' : 'monthly'; // ← STRICT 7 days

console.log(`📊 Detected ${summaryType} request (${daysDiff} days) for ${platform} platform`);
```

**No comment, no flexibility** - hardcoded to 7 days

---

## 🔍 OTHER INCONSISTENCIES

### generatePeriodIdFromDateRange (Line 75-77)
```typescript
const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

if (daysDiff <= 7) {  // ← Also 7 days!
  // Weekly period - calculate ISO week
```

### isCurrentWeek Function (Line 128)
```typescript
const daysDiff = Math.ceil((requestEnd.getTime() - requestStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
const isMondayStart = requestStart.getDay() === 1;
const isExactWeek = daysDiff === 7 && isMondayStart; // ← EXACTLY 7 days!
```

---

## 🎯 THE REAL ISSUE

### What SHOULD happen:
- ISO weeks are **always exactly 7 days**: Monday → Sunday
- Week 46: Nov 10 (Mon) → Nov 16 (Sun) = **7 days**
- Week 47: Nov 17 (Mon) → Nov 23 (Sun) = **7 days**

### Why does line 647 allow 8 days?
**Comment says:** "week can span month boundary"

**This is WRONG!** ❌
- Weeks don't "span" by adding days
- Week 46 is Nov 10-16 (in November)
- Week 47 is Nov 17-23 (also in November)
- Both are 7 days, both fully in November

### The Real Problem:
Line 647's `daysDiff <= 8` is trying to be "flexible" but causes:
1. 8-day ranges classified as weekly
2. Those 8-day "weekly" requests hit `loadFromDatabase`
3. `loadFromDatabase` says "8 days = monthly"
4. Returns wrong data type

---

## 🔧 THE FIX

### Option 1: Standardize on 7 Days (RECOMMENDED)

**Change line 647:**
```typescript
// BEFORE:
const requestType = daysDiff <= 8 ? 'weekly' : 'monthly';

// AFTER:
const requestType = daysDiff === 7 ? 'weekly' : 'monthly'; // ISO week is exactly 7 days
```

**Why EXACTLY 7:**
- ISO weeks are strictly 7 days
- No ambiguity
- Consistent with database storage
- Consistent with `isCurrentWeek` validation

### Option 2: Make loadFromDatabase Match (NOT RECOMMENDED)

**Change line 158:**
```typescript
// BEFORE:
const summaryType = daysDiff <= 7 ? 'weekly' : 'monthly';

// AFTER:
const summaryType = daysDiff <= 8 ? 'weekly' : 'monthly';
```

**Why NOT recommended:**
- ISO weeks are NOT 8 days
- Database stores 7-day weeks
- Would allow invalid "8-day weeks"
- Breaks consistency with ISO standard

---

## 📋 ALL LOCATIONS TO UPDATE

### Must Update:
1. **Line 647:** Change `<= 8` to `=== 7`
2. **Verify:** Line 158 stays `<= 7` (correct)
3. **Verify:** Line 77 stays `<= 7` (correct)
4. **Verify:** Line 128 stays `=== 7` (correct)

### Additional Considerations:

**For robustness, consider:**
```typescript
const requestType = (daysDiff >= 6 && daysDiff <= 8) ? 'weekly' : 'monthly';
```

**Why 6-8 range:**
- 6 days: Week starting Friday, ending Thursday (edge case)
- 7 days: Normal ISO week (Monday-Sunday)
- 8 days: Week with +1 day buffer for timezone issues

**But STRICT is better:**
```typescript
const requestType = daysDiff === 7 ? 'weekly' : 'monthly';
```

---

## 🎯 RECOMMENDED IMMEDIATE FIX

**Single Line Change:**

File: `/src/app/api/fetch-live-data/route.ts`  
Line: 647

```typescript
// OLD:
const requestType = daysDiff <= 8 ? 'weekly' : 'monthly'; // 🔧 FIX: Allow up to 8 days for weekly (week can span month boundary)

// NEW:
const requestType = daysDiff === 7 ? 'weekly' : 'monthly'; // 🔧 FIX: ISO weeks are exactly 7 days (Mon-Sun)
```

**Impact:**
- ✅ Weekly requests (7 days) → Weekly cache/database
- ✅ Monthly requests (28-31 days) → Monthly cache/database
- ✅ 8-day requests → Now correctly classified as monthly (or rejected as invalid)
- ✅ Consistent with `loadFromDatabase`
- ✅ Consistent with ISO week standard

---

## 🧪 TEST CASES

### After Fix:

| Date Range | Days | OLD Classification | NEW Classification | Database Query |
|------------|------|-------------------|-------------------|----------------|
| Nov 10-16 | 7 | weekly ✅ | weekly ✅ | summary_type='weekly' ✅ |
| Nov 10-17 | 8 | weekly ❌ | monthly ✅ | summary_type='monthly' ✅ |
| Nov 1-30 | 30 | monthly ✅ | monthly ✅ | summary_type='monthly' ✅ |
| Nov 17-23 | 7 | weekly ✅ | weekly ✅ | summary_type='weekly' ✅ |

---

## 🚀 DEPLOYMENT PLAN

1. **Update line 647:** Change `<= 8` to `=== 7`
2. **Test locally:** Verify Week 46 (Nov 10-16) loads correctly
3. **Test edge case:** Verify 8-day range is rejected or classified as monthly
4. **Deploy to production**
5. **Monitor:** Check that weekly reports show weekly data (not monthly)

---

**Status:** Ready to fix - awaiting approval to proceed

