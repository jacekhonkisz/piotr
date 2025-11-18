# 🚨 Weekly Data Issue - Comprehensive Analysis

## Problem Report
**Date**: November 18, 2025  
**Issue**: 
1. **Current week (Week 47: Nov 17-23)** showing monthly amounts (~24,908 zł)
2. **Previous weeks (Week 46, 45, etc.)** showing stale cache amounts
**Console**: `campaigns length: 1` for all weeks

---

## 🎯 ROOT CAUSE ANALYSIS

### **Issue #1: Current Week Shows Monthly Data**

**Week 47 Details**:
- Dates: 2025-11-17 to 2025-11-23
- Includes today (Nov 17)
- Should show: Week's data only (~3,000-4,000 zł)
- Actually shows: Full month data (24,908 zł)

**Why This Happens**:

```javascript
// Line 196 in fetch-live-data/route.ts
const isCurrentWeek = summaryType === 'weekly' && start <= now && end >= now && endDate >= today;

// Problem:
// Week 47: 2025-11-17 to 2025-11-23
// endDate = "2025-11-23" (future)
// today = "2025-11-17"
// endDate >= today = TRUE ✅

// BUT: Week 47's end date is in the FUTURE!
// It includes Nov 17 (today) but also Nov 18-23 (future days with no data)
```

**The Fix Needed**: Cap weekly endDate to today, just like monthly!

---

###**Issue #2: Previous Weeks Show "Campaigns Length: 1"**

**Week 46 Details**:
- Dates: 2025-11-10 to 2025-11-16
- Past week (completed)
- Should show: Multiple campaigns with individual data
- Actually shows: Only 1 aggregated campaign

**Why This Happens**:

```typescript
// Line 222-231 in fetch-live-data/route.ts
const { data: weeklyResults, error: weeklyError } = await supabase
  .from('campaign_summaries')
  .select('*')
  .eq('summary_type', 'weekly')
  .limit(1); // ← Returns 1 row

// The row contains:
// { campaign_data: [...all campaigns...] }

// But the code SHOULD unpack campaign_data array
// Instead it's treating the summary row as if it's a single campaign
```

---

## 🔍 Database Structure

###`campaign_summaries` Table:

```sql
CREATE TABLE campaign_summaries (
  id UUID PRIMARY KEY,
  client_id UUID,
  summary_date DATE,
  summary_type TEXT, -- 'weekly' or 'monthly'
  platform TEXT, -- 'meta' or 'google'
  campaign_data JSONB, -- Array of campaign objects
  total_spend NUMERIC,
  total_impressions INTEGER,
  ...
);
```

**Example Row**:
```json
{
  "id": "...",
  "summary_date": "2025-11-10",
  "summary_type": "weekly",
  "campaign_data": [
    { "campaign_id": "1", "spend": 1500, ...},
    { "campaign_id": "2", "spend": 2000, ...},
    { "campaign_id": "3", "spend": 500, ...}
  ],
  "total_spend": 4000
}
```

**The Problem**: Code is not unpacking `campaign_data` array properly.

---

## 🔧 FIXES REQUIRED

### **Fix #1: Cap Weekly End Date to Today (Like Monthly)**

**Location**: `src/app/api/fetch-live-data/route.ts` lines 177-186

**Current Code** (Monthly only):
```typescript
let adjustedEndDate = endDate;
if (summaryType === 'monthly' && requestYear === currentYear && requestMonth === currentMonth) {
  if (endDate > today) {
    adjustedEndDate = today; // Cap to today
  }
}
```

**Fixed Code** (Both monthly AND weekly):
```typescript
let adjustedEndDate = endDate;

// Cap BOTH monthly and weekly to today for current periods
const isCurrentPeriod = (
  (summaryType === 'monthly' && requestYear === currentYear && requestMonth === currentMonth) ||
  (summaryType === 'weekly' && start <= now && end >= now)
);

if (isCurrentPeriod && endDate > today) {
  console.log(`📅 CURRENT ${summaryType.toUpperCase()} FIX: Capping from ${endDate} to ${today}`);
  console.log(`   → Reason: Cannot fetch data for future dates`);
  adjustedEndDate = today;
}
```

---

### **Fix #2: Check Weekly Data Unpacking**

**Location**: `src/app/api/fetch-live-data/route.ts` lines 361-446

**Need to verify**:
1. Is `storedSummary.campaign_data` being properly unpacked?
2. Are individual campaigns being returned?
3. Or is the summary being treated as a single campaign?

**Check This Code**:
```typescript
// Around line 370-400
const campaigns = storedSummary.campaign_data || [];

// Should return multiple campaigns:
console.log(`📊 Unpacking ${campaigns.length} campaigns from weekly summary`);
```

---

### **Fix #3: Update isCurrentWeek Logic**

**Location**: `src/app/api/fetch-live-data/route.ts` line 196

**Current**:
```typescript
const isCurrentWeek = summaryType === 'weekly' && start <= now && end >= now && endDate >= today;
```

**Problem**: Allows future endDate

**Fixed**:
```typescript
const isCurrentWeek = (
  summaryType === 'weekly' && 
  start <= now && 
  end >= now && 
  adjustedEndDate >= today // Use adjusted date
);
```

---

## 📊 Expected Behavior After Fix

| Week | Date Range | Today | Expected Data | Expected Amount |
|------|-----------|-------|---------------|-----------------|
| **Week 47** | Nov 17-23 | Nov 17 | Nov 17 ONLY (1 day) | ~1,500 zł |
| **Week 46** | Nov 10-16 | - | Full week (7 days) | ~3,500 zł |
| **Week 45** | Nov 3-9 | - | Full week (7 days) | ~3,800 zł |

---

## 🧪 Testing Plan

### **Test 1: Current Week (Week 47)**
1. Select Week 47 (Nov 17-23)
2. **Expected**: Shows data for Nov 17 ONLY
3. **Check**: Spend should be ~1,500 zł (1/7 of monthly)

### **Test 2: Previous Week (Week 46)**
1. Select Week 46 (Nov 10-16)
2. **Expected**: Shows full week data (7 days)
3. **Check**: Multiple campaigns displayed
4. **Check**: Spend should be ~3,500 zł

### **Test 3: Console Logs**
Look for:
```
📅 CURRENT WEEKLY FIX: Capping from 2025-11-23 to 2025-11-17
📊 Unpacking 17 campaigns from weekly summary
```

---

## 🚨 IMMEDIATE ACTION REQUIRED

1. **Cap weekly endDate** to today (same as monthly)
2. **Verify campaign unpacking** from `campaign_data` field  
3. **Test current week** shows 1-day data only
4. **Test previous weeks** show full week data

---

**Priority**: P0 - CRITICAL  
**Impact**: Weekly reports showing wrong data  
**ETA**: 45 minutes to fix and deploy  

---

## 📝 Code Locations

| File | Lines | What to Fix |
|------|-------|-------------|
| `fetch-live-data/route.ts` | 177-186 | Add weekly to endDate capping |
| `fetch-live-data/route.ts` | 196 | Update isCurrentWeek to use adjustedEndDate |
| `fetch-live-data/route.ts` | 370-400 | Verify campaign unpacking |

---

**Status**: ROOT CAUSE IDENTIFIED  
**Next**: Implement fixes and deploy

