# 🚀 ENHANCED DEBUG & DEPLOYMENT GUIDE

**Date:** November 18, 2025  
**Issue:** Current week using monthly data + missing weekly metrics
**Fix:** Enhanced debug logging + routing verification

---

## 🔧 CHANGES MADE

### 1. Enhanced Debug Logging (fetch-live-data/route.ts)

**Added detailed routing analysis:**
```typescript
console.log(`📊 CRITICAL DEBUG - ROUTING ANALYSIS:`, {
  startDate,
  endDate,
  daysDiff,
  requestType,
  today,
  currentWeekStart,
  currentWeekEnd,
  isCurrentMonthRequest,
  isCurrentWeekRequest,
  routingDecision: isCurrentWeekRequest ? '🟡 WEEKLY CACHE' :
                   isCurrentMonthRequest ? '🔴 MONTHLY CACHE' : '💾 DATABASE',
  weekCheckDetails: {
    startMatches: startDate === currentWeekInfo.startDate,
    endMatches: endDate === currentWeekInfo.endDate,
    includesCurrentDay: endDate >= today,
    startsBeforeToday: startDate <= today
  }
});
```

### 2. Clear Routing Indicators

**Added explicit routing messages:**
- **Weekly:** `✅ ROUTING: Current week request → WEEKLY CACHE`
- **Monthly:** `✅ ROUTING: Current month request → MONTHLY CACHE`
- **Historical:** `🔒 HISTORICAL PERIOD - ENFORCING DATABASE-FIRST POLICY`

---

## 📋 DEPLOYMENT STEPS

### Step 1: Commit Changes
```bash
cd /Users/macbook/piotr

git add src/app/api/fetch-live-data/route.ts
git add "🔧_CRITICAL_FIX_WEEKLY_ROUTING.md"
git add "🚀_ENHANCED_DEBUG_DEPLOYMENT.md"

git commit -m "Debug: Add enhanced routing debug logging for weekly/monthly detection

- Add detailed debug info showing routing decisions
- Show current week boundaries and comparisons
- Add explicit routing indicators (WEEKLY/MONTHLY/DATABASE)
- Help diagnose why current week uses monthly cache

Issue: Current week requests being routed to monthly cache
This will show us exactly where the routing logic fails"

git push origin main
```

### Step 2: Wait for Deployment (2-3 minutes)

### Step 3: Test with User

---

## 🔍 DIAGNOSTIC PROCEDURE

### Ask User to:

1. **Open Reports Page**
   - Navigate to the reports page
   - Select **current week** (should show Nov 17-23, 2025)

2. **Open DevTools**
   - Press **F12** (or Cmd+Option+I on Mac)
   - Go to **Console** tab
   - Clear console (trash icon)

3. **Reload Page**
   - Press **Cmd+R** (Mac) or **Ctrl+R** (Windows)
   - Watch console output

4. **Find This Log Message:**
   ```
   📊 CRITICAL DEBUG - ROUTING ANALYSIS:
   ```

5. **Share the Complete Output**

---

## 📊 WHAT TO LOOK FOR

### ✅ CORRECT ROUTING (Current Week → Weekly Cache):

```javascript
📊 CRITICAL DEBUG - ROUTING ANALYSIS: {
  startDate: '2025-11-17',
  endDate: '2025-11-23',
  daysDiff: 7,
  requestType: 'weekly',
  today: '2025-11-18',
  currentWeekStart: '2025-11-17',
  currentWeekEnd: '2025-11-23',
  isCurrentWeekRequest: true,  // ✅ TRUE!
  isCurrentMonthRequest: false,
  routingDecision: '🟡 WEEKLY CACHE', // ✅ CORRECT!
  weekCheckDetails: {
    startMatches: true,         // ✅
    endMatches: true,           // ✅
    includesCurrentDay: true,   // ✅
    startsBeforeToday: true     // ✅
  }
}

✅ ROUTING: Current week request → WEEKLY CACHE
```

### ❌ WRONG ROUTING (Current Week → Monthly Cache):

```javascript
📊 CRITICAL DEBUG - ROUTING ANALYSIS: {
  startDate: '2025-11-17',
  endDate: '2025-11-23',
  daysDiff: 7,
  requestType: 'weekly',
  isCurrentWeekRequest: false,  // ❌ FALSE! (Should be TRUE)
  isCurrentMonthRequest: true,  // ❌ TRUE! (Should be FALSE)
  routingDecision: '🔴 MONTHLY CACHE', // ❌ WRONG!
  weekCheckDetails: {
    startMatches: false,  // ← Check why this is false
    endMatches: false,    // ← Check why this is false
    ...
  }
}

✅ ROUTING: Current month request → MONTHLY CACHE
```

---

## 🎯 DIAGNOSIS FLOWCHART

### If `isCurrentWeekRequest = false`:

**Check `weekCheckDetails`:**

1. **`startMatches = false`**
   - `startDate` doesn't match `currentWeekStart`
   - **Problem:** `getCurrentWeekInfo()` returning wrong dates
   - **Fix:** Update `getCurrentWeekInfo()` logic

2. **`endMatches = false`**
   - `endDate` doesn't match `currentWeekEnd`
   - **Problem:** Same as above
   - **Fix:** Update `getCurrentWeekInfo()` logic

3. **`includesCurrentDay = false`**
   - `endDate < today`
   - **Problem:** Requesting past week, not current
   - **Expected:** This is correct behavior for past weeks

4. **All checks pass but still false**
   - **Problem:** `isCurrentWeek()` function has additional strict checks
   - **Fix:** Review Monday start check and date comparisons

---

## 🔧 POTENTIAL FIXES

### Fix 1: getCurrentWeekInfo() Returns Wrong Dates

**If debug shows:**
```javascript
currentWeekStart: '2025-11-10',  // ❌ Should be '2025-11-17'
currentWeekEnd: '2025-11-16',    // ❌ Should be '2025-11-23'
```

**Solution:**
```typescript
// In week-utils.ts
export function getCurrentWeekInfo() {
  const now = new Date();
  
  // Calculate ISO week number
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  // Use parseWeekPeriodId to get boundaries
  const periodId = `${d.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  return parseWeekPeriodId(periodId);
}
```

### Fix 2: String Comparison Failing

**If debug shows:**
```javascript
startDate: '2025-11-17',
currentWeekStart: '2025-11-17',
startMatches: false  // ❌ Strings match but comparison fails
```

**Solution:** Normalize date formats before comparison

### Fix 3: isCurrentWeek() Too Strict

**If all checks pass but `isCurrentWeekRequest` still false:**

**Solution:** Simplify `isCurrentWeek()` logic:
```typescript
function isCurrentWeek(startDate: string, endDate: string): boolean {
  const currentWeek = getCurrentWeekInfo();
  return startDate === currentWeek.startDate && 
         endDate === currentWeek.endDate;
}
```

---

## 📝 WHAT TO ASK USER

1. **Share full console output** starting from `📊 CRITICAL DEBUG - ROUTING ANALYSIS:`

2. **Confirm which week selected:**
   - What week number is shown in dropdown?
   - What dates are displayed (10.11-16.11 or 17.11-23.11)?

3. **Check response debug info:**
   - Open Network tab
   - Find `/api/fetch-live-data` request
   - Check response → `debug.source`
   - Should be `"weekly-smart-cache"` for current week

4. **Check if metrics are missing:**
   - What metrics are displayed?
   - Which ones are missing or showing 0?

---

## 🚀 AFTER GETTING DEBUG INFO

Based on the debug output, we'll:

1. **Identify exact failure point** (which check is failing)
2. **Create targeted fix** for that specific issue
3. **Deploy fix** with additional safeguards
4. **Verify** with user that both issues are resolved:
   - Current week uses weekly cache ✅
   - All metrics are properly fetched ✅

---

**Next:** Deploy these changes and get user's console output!

