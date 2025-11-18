# 🚨 CRITICAL FINDING: Week Number Mismatch

**Date:** November 18, 2025  
**Issue:** User is viewing Week 46 data but interface shows "Week 47"

---

## 🔍 PROBLEM IDENTIFIED

### What the User Sees:
- **Interface Label:** "Raport - 10.11 - 16.11.2025"  
- **Period Selector:** Likely shows "Week 47" or similar
- **Spend:** 6271,48 zł

### What the Dates Actually Are:
- **Date Range:** November 10-16, 2025 (Monday to Sunday)
- **Correct Week Number:** **Week 46** (not Week 47)

### What Week 47 Actually Is:
- **Week 47, 2025:** November 17-23, 2025 (Monday to Sunday)
- **Calculation:**
  - Jan 4, 2025 = Saturday
  - First Monday of 2025 = December 30, 2024
  - Week 47 start = Dec 30, 2024 + (46 * 7 days) = November 17, 2025

---

## ❌ ROOT CAUSE

**The dropdown week selector is showing incorrect week numbers!**

OR

**The API is interpreting Week 47 as Week 46!**

---

## 🧪 VERIFICATION

### Calculation for Week 46:
```
Nov 10-16, 2025 = Week 46 ✅
```

### Calculation for Week 47:
```
Nov 17-23, 2025 = Week 47 ✅
```

### Screenshot Analysis:
```
Displayed: "10.11 - 16.11.2025"
Week Number Shown: Unknown (need to check dropdown)
User Expects: Week 47 data
Actual Week: Week 46
```

---

## 🎯 POSSIBLE CAUSES

### 1. Frontend Dropdown Off-By-One ⭐⭐⭐
**Most Likely**

The week dropdown is calculating week numbers incorrectly, showing "Week 47" for dates that are actually Week 46.

**Where to Check:**
- `src/app/reports/page.tsx` - Dropdown generation logic
- Week options array generation
- How `selectedPeriod` is mapped to dates

### 2. Backend Week Parsing Off-By-One ⭐⭐
The API is parsing "2025-W47" incorrectly as Nov 10-16 instead of Nov 17-23.

**Where to Check:**
- `src/lib/week-utils.ts` - `parseWeekPeriodId()`
- `src/lib/date-range-utils.ts` - `getISOWeekStartDate()`

### 3. Data Storage Issue ⭐
Data for Week 46 is being stored with period_id='2025-W47'.

**Where to Check:**
- `campaign_summaries` table
- Weekly collection logic in `background-data-collector.ts`

---

## 🔬 DIAGNOSTIC STEPS

### Step 1: Check What Period ID User Selected
```
1. Open reports page
2. Open browser console
3. Check selectedPeriod state
4. Check API request payload
```

### Step 2: Verify Database Data
```sql
-- Check what periods exist
SELECT DISTINCT period_id, summary_date, total_spend
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND period_id IN ('2025-W46', '2025-W47')
ORDER BY period_id;
```

### Step 3: Test Week Calculation
```javascript
// In browser console
const { parseWeekPeriodId } = require('./src/lib/week-utils.ts');

// Test Week 46
const week46 = parseWeekPeriodId('2025-W46');
console.log('Week 46:', week46);
// Should show: Nov 10-16

// Test Week 47
const week47 = parseWeekPeriodId('2025-W47');
console.log('Week 47:', week47);
// Should show: Nov 17-23
```

### Step 4: Check Dropdown Options
```javascript
// In reports page, check how weeks are generated
// Look for generateWeekOptions() or similar function
```

---

## 🔧 LIKELY FIXES

### If Dropdown is Wrong:
```typescript
// Fix week number generation in dropdown
// Ensure it uses same ISO week calculation as backend
```

### If Backend Parsing is Wrong:
```typescript
// Already fixed in week-utils.ts
// Verify deployment
```

### If Both Match But Are Wrong:
```typescript
// Both frontend and backend are using wrong algorithm
// Need to update both to use correct ISO week calculation
```

---

## 📊 DATA CONSISTENCY CHECK

**Critical Questions:**
1. Is the 6271,48 zł correct for the dates Nov 10-16?
2. Is there different data for Nov 17-23?
3. Are we comparing apples to oranges?

**Hypothesis:**
- User is actually looking at Week 46 data
- The data (6271,48 zł) is correct for Week 46
- But they think they're looking at Week 47
- Our "fix" didn't change anything because they're looking at the wrong week

---

## 🚀 IMMEDIATE ACTION REQUIRED

### 1. Ask User to Check Current Week
**Request:**
```
Please check:
1. What is today's date? (Nov 18, 2025)
2. What week does the dropdown show for "current week"?
3. What dates does it show for the current week?
```

**Expected:**
- Today (Nov 18) is in Week 47
- Current week should show: Nov 17-23, 2025
- If it shows Nov 10-16, the dropdown is off by 1 week

### 2. Check Database for Week 47
```sql
SELECT 
  period_id,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  created_at
FROM campaign_summaries
WHERE period_id = '2025-W47'
  AND summary_type = 'weekly'
ORDER BY created_at DESC;
```

### 3. Verify Which Week Has 6271 zł
```sql
SELECT 
  period_id,
  summary_date,
  platform,
  total_spend,
  created_at
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND total_spend BETWEEN 6200 AND 6300
  AND period_id LIKE '2025-W%'
ORDER BY period_id DESC;
```

---

## 💡 INSIGHT

**The user might not actually have a data problem!**

They might have a **week label problem**:
- They select "Week 47"
- System shows "Nov 10-16" (which is Week 46)
- Data (6271,48 zł) is correct for those dates
- But they expect Week 47 data (Nov 17-23)

**This would explain:**
- Why our fix "didn't work" (it did, but they're looking at wrong week)
- Why amount is "same" (it's the same week, just mislabeled)
- Why past weeks aren't fetched (they are, but under wrong numbers)

---

## 🎯 NEXT STEPS

1. **Verify** the user's selected week number vs displayed dates
2. **Check** if this is a labeling issue or a data issue
3. **Test** week calculation functions for off-by-one errors
4. **Compare** frontend and backend week calculations
5. **Audit** the dropdown generation logic

**Priority:** HIGH - This might be the root cause of all weekly issues!

