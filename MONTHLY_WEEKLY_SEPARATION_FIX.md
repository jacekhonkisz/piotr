# 🔧 Monthly vs Weekly Data Collection - Complete Separation Fix

**Date**: November 9, 2025  
**Issue**: Monthly and weekly data collection systems were being mixed together  
**Status**: ✅ FIXED

---

## 🚨 THE FUNDAMENTAL PROBLEM

The system was **incorrectly aggregating weekly summaries to create monthly data**. This is fundamentally wrong because:

### ❌ WRONG APPROACH (Before):
```
Monthly Request (Oct 2025)
  ↓
1. Look for summary_type='monthly' → NOT FOUND
  ↓
2. FALLBACK: Aggregate summary_type='weekly' records
  ↓
3. Show aggregated weekly data as "monthly"
  ↓
RESULT: 572.25 PLN (only 1 week) or 1,586.40 PLN (2 weeks)
```

### ✅ CORRECT APPROACH (After):
```
Monthly Request (Oct 2025)
  ↓
1. Look for summary_type='monthly' → NOT FOUND
  ↓
2. NO FALLBACK - Return null
  ↓
3. Trigger live API call to collect FULL month
  ↓
RESULT: 4,813.12 PLN (complete month 1st-31st)
```

---

## 📊 TWO SEPARATE SYSTEMS

### SYSTEM A: MONTHLY COLLECTION

**Purpose**: Collect ALL data from 1st to last day of month as ONE record

**Collection Method**:
```javascript
// src/lib/background-data-collector.ts
// Lines 340-446: collectGoogleAdsMonthlySummary()

const monthData = {
  startDate: '2025-10-01',  // First day
  endDate: '2025-10-31'      // Last day
};

// Fetch from Google Ads API for ENTIRE month
const campaigns = await googleAdsService.getCampaignData(
  monthData.startDate, 
  monthData.endDate
);

// Store as ONE monthly record
summary_type: 'monthly',
summary_date: '2025-10-01',  // First day of month
platform: 'google'
```

**Storage**:
- Table: `campaign_summaries`
- `summary_type`: `'monthly'`
- `summary_date`: First day of month (`YYYY-MM-01`)
- `platform`: `'google'` or `'meta'`
- Data span: Full month (1st to last day)

**Retrieval**:
```sql
SELECT * FROM campaign_summaries
WHERE client_id = ?
  AND summary_type = 'monthly'
  AND summary_date = '2025-10-01'
  AND platform = 'google';
```

---

### SYSTEM B: WEEKLY COLLECTION

**Purpose**: Collect data for individual weeks (separate system)

**Collection Method**:
```javascript
// src/lib/background-data-collector.ts
// Lines 451-550: collectWeeklySummaryForClient()

const weekData = {
  startDate: '2025-10-13',  // Week start (Monday)
  endDate: '2025-10-19'      // Week end (Sunday)
};

// Fetch from Google Ads API for THIS WEEK ONLY
const campaigns = await googleAdsService.getCampaignData(
  weekData.startDate, 
  weekData.endDate
);

// Store as ONE weekly record
summary_type: 'weekly',
summary_date: '2025-10-13',  // Week start date
platform: 'google'
```

**Storage**:
- Table: `campaign_summaries`
- `summary_type`: `'weekly'`
- `summary_date`: Week start date (Monday)
- `platform`: `'google'` or `'meta'`
- Data span: One week (7 days)

**Retrieval**:
```sql
SELECT * FROM campaign_summaries
WHERE client_id = ?
  AND summary_type = 'weekly'
  AND summary_date = '2025-10-13'
  AND platform = 'google';
```

---

## 🐛 THE BUG THAT WAS FIXED

### Location:
`/src/app/api/fetch-google-ads-live-data/route.ts` (Lines 147-230)

### Before (Incorrect):
```typescript
// ❌ BUG: Tried to aggregate weekly data for monthly requests
if (monthlyQuery.data && monthlyQuery.data.length > 0) {
  monthlyResults = monthlyQuery.data;  // ✅ Correct
  console.log(`✅ Found monthly Google Ads summary`);
} else {
  // ❌ WRONG: Fallback to weekly aggregation
  const weeklyQuery = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('summary_type', 'weekly')
    .eq('platform', 'google')
    .gte('summary_date', startDate)
    .lte('summary_date', endDate)
    .limit(1);  // ❌ Only got 1 week!
  
  monthlyResults = weeklyQuery.data;  // ❌ Showed 572.25 PLN
}
```

### After (Correct):
```typescript
// ✅ FIXED: Strict separation of monthly and weekly
if (monthlyQuery.data && monthlyQuery.data.length > 0) {
  monthlyResults = monthlyQuery.data;  // ✅ Use monthly record
  console.log(`✅ Found monthly Google Ads summary`);
} else {
  // ✅ CORRECT: No fallback to weekly
  console.log(`❌ No monthly summary found`);
  console.log(`   → Monthly and weekly systems are separate`);
  monthlyResults = null;  // Will trigger live API call
}
```

---

## 🎯 WHY THIS FIXES THE ISSUE

### Before Fix:
| Request Type | What Happened | Result |
|-------------|---------------|--------|
| October 2025 Monthly | No monthly record → Got 1 weekly record (.limit(1)) | 572.25 PLN ❌ |
| October 2025 Monthly | No monthly record → Got 2 weekly records (if aggregated) | 1,586.40 PLN ❌ |

### After Fix:
| Request Type | What Happened | Result |
|-------------|---------------|--------|
| October 2025 Monthly | No monthly record → Trigger live API call | 4,813.12 PLN ✅ |
| October 2025 Monthly | Has monthly record → Use it directly | Full month data ✅ |

---

## 📋 WHAT NEEDS TO HAPPEN NOW

### 1. **Collect October Monthly Data** 🔴 CRITICAL

The database is missing the monthly summary for October 2025. Need to run:

```bash
# Trigger monthly collection for October
node scripts/collect-october-monthly-belmonte.js
```

This will:
- Call Google Ads API for Oct 1-31
- Store as `summary_type='monthly'`, `summary_date='2025-10-01'`
- Store ~4,813 PLN (full month)

### 2. **Weekly Data is Separate** ✅ WORKING

The 2 weekly records that exist are correct:
- Week 1 (2025-10-13): 1,014.16 PLN
- Week 2 (2025-10-27): 572.25 PLN

These should NOT be used for monthly reports.

### 3. **Verify All Past Months**

Check if other months have proper monthly summaries:

```sql
SELECT 
  summary_date,
  summary_type,
  total_spend,
  platform
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
  AND summary_type = 'monthly'
ORDER BY summary_date DESC;
```

---

## 💡 COLLECTION SCHEDULE

### Monthly Collection:
- **Trigger**: 1st day of new month (e.g., Nov 1st collects Oct 1-31)
- **Frequency**: Once per month per client
- **Stores**: ONE record per month
- **API Endpoint**: `/api/automated/collect-monthly-summaries`
- **Collector**: `BackgroundDataCollector.collectMonthlySummariesForSingleClient()`

### Weekly Collection:
- **Trigger**: Every Monday (collects previous complete week)
- **Frequency**: Once per week per client
- **Stores**: ONE record per week
- **API Endpoint**: `/api/automated/collect-weekly-data`
- **Collector**: `BackgroundDataCollector.collectWeeklySummariesForSingleClient()`

---

## 🔍 HOW TO VERIFY THE FIX

### Test 1: Check October Monthly Data

```sql
-- Should return 1 record with ~4,813 PLN (after collection)
SELECT * FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND summary_date = '2025-10-01'
  AND platform = 'google';
```

### Test 2: Check Weekly Data (Should be unchanged)

```sql
-- Should return 2 records (1,014.16 and 572.25)
SELECT * FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'weekly'
  AND summary_date >= '2025-10-01'
  AND summary_date < '2025-11-01'
  AND platform = 'google';
```

### Test 3: Dashboard Display

1. Refresh dashboard
2. Select October 2025
3. Should show: **4,813.12 PLN** (after monthly collection completes)

---

## 📁 FILES MODIFIED

1. **`/src/app/api/fetch-google-ads-live-data/route.ts`** ✅
   - Lines 147-162
   - Removed weekly fallback for monthly requests
   - Enforced strict separation

---

## 🎉 EXPECTED OUTCOME

### Before:
- Monthly view showed weekly data (572.25 PLN - 1 week only)
- Systems were mixed together
- Inconsistent data

### After:
- Monthly view shows ONLY monthly data (4,813.12 PLN - full month)
- Weekly view shows ONLY weekly data (separate records)
- Clean separation between systems
- Consistent, accurate data

---

**Status**: ✅ **FIX APPLIED**  
**Next Step**: Collect October monthly data for Belmonte  
**Report Generated**: November 9, 2025








