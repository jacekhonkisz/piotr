# 🔍 COMPREHENSIVE WEEKLY DATA AUDIT - ALL POSSIBILITIES
**Date:** November 18, 2025  
**Issue:** Week 47 (10.11 - 16.11.2025) still showing 6271,48 zł after fix deployed

---

## 📊 REPORTED SYMPTOMS

**From Screenshot:**
- Week 47 (10.11 - 16.11.2025)
- **Wydatki (Spend):** 6271,48 zł
- Wyświetlenia: 521.8K
- Kliknięcia: 15.2K
- CTR: 2.91%
- CPC: 0,41 zł
- Konwersje: 18

**User Report:**
> "i still see exactly same amount displayed"

---

## 🔍 AUDIT CHECKLIST - ALL POSSIBILITIES

### ✅ 1. DATA FLOW VERIFICATION

**Question:** What endpoint is the frontend calling?

**Findings:**
- Reports page (`/app/reports/page.tsx`) uses `fetchReportDataUnified()`
- `fetchReportDataUnified()` calls `StandardizedDataFetcher.fetchData()`
- `StandardizedDataFetcher` (client-side) redirects to `/api/fetch-live-data`
- `/api/fetch-live-data` is the endpoint we fixed on line 883

**Status:** ✅ Confirmed - Correct endpoint identified

---

### ✅ 2. DATE RANGE CALCULATION

**Question:** Is the date range being calculated correctly?

**Week 47, 2025:**
- ISO Week 47 should be: November 17-23, 2025 (Monday to Sunday)
- Screenshot shows: 10.11 - 16.11.2025

**CRITICAL FINDING:** 
The screenshot date range **10.11 - 16.11.2025** (November 10-16) does NOT match ISO Week 47 (November 17-23).

**Possible Issues:**
1. Frontend date calculation is wrong
2. Week number is off by 1
3. Date format is ambiguous (DD.MM or MM.DD?)

**Action Required:** Verify date calculation logic in `getWeekBoundaries()` and `parseWeekPeriodId()`

---

### ⏳ 3. CACHING LAYERS

**Possible Cache Locations:**

1. **Browser Cache**
   - localStorage
   - sessionStorage
   - Service Worker cache
   - HTTP cache
   - **Action:** Hard refresh (Cmd+Shift+R) 

2. **CDN/Vercel Edge Cache**
   - CDN layer caching
   - Edge functions cache
   - **Action:** Wait 5-10 minutes or purge CDN

3. **Server Cache (`current_week_cache`)**
   - Database table: `current_week_cache`
   - Period ID: `2025-W47`
   - **Action:** Already cleared via `/api/admin/clear-weekly-cache`

4. **Database Cache (`campaign_summaries`)**
   - Historical data cache
   - Period ID: `2025-W47`
   - **Action:** Check if data exists and is correct

5. **API Response Cache**
   - In-memory cache in `BackgroundDataCollector`
   - **Action:** Check `globalDataFetchCache` in standardized-data-fetcher.ts

---

### ⏳ 4. DATABASE DATA VERIFICATION

**Question:** What data is actually stored in the database?

**Tables to Check:**
1. `campaign_summaries` - WHERE `period_id = '2025-W47'` AND `summary_type = 'weekly'`
2. `current_week_cache` - WHERE `period_id = '2025-W47'`
3. `current_month_cache` - WHERE `period_id LIKE '2025-11%'`

**Action Required:** Run SQL queries to verify data

---

### ⏳ 5. API ENDPOINT VERIFICATION

**Question:** Is the fix actually deployed and active?

**What to Check:**
1. Is the fixed code deployed to Vercel?
2. Is the deployment successful?
3. Are there any deployment errors?
4. Is the correct version running?

**Action Required:** Check Vercel deployment logs

---

### ⏳ 6. REQUEST/RESPONSE INSPECTION

**Question:** What is the actual API request and response?

**What to Check:**
1. Network tab: What endpoint is being called?
2. Request payload: What dateRange is being sent?
3. Response data: What data is being returned?
4. Response headers: What source is indicated in debug info?

**Action Required:** Inspect browser DevTools Network tab

---

### ⏳ 7. DATE RANGE BOUNDARIES

**Question:** Are week boundaries calculated consistently?

**Potential Issues:**
1. Frontend calculates different dates than backend
2. Timezone differences (UTC vs local)
3. Off-by-one errors in week calculation
4. Different ISO week implementations

**Files to Check:**
- `src/lib/date-range-utils.ts` - `getWeekBoundaries()`
- `src/lib/week-utils.ts` - `parseWeekPeriodId()`
- `src/components/WeeklyReportView.tsx` - `getWeekDateRange()`
- `src/app/reports/page.tsx` - `getWeekDateRange()`

**Action Required:** Compare implementations

---

### ⏳ 8. DATA AGGREGATION LOGIC

**Question:** Is data being aggregated from the correct source?

**Possible Issues:**
1. Aggregating multiple weeks of data
2. Aggregating partial weeks
3. Including/excluding current day
4. Timezone affecting date boundaries

**Files to Check:**
- `src/app/api/fetch-live-data/route.ts` - Line 883 (our fix)
- `src/lib/background-data-collector.ts` - Weekly collection logic

**Action Required:** Verify aggregation logic

---

### ⏳ 9. COLLECTION STATUS

**Question:** Has the weekly collection job run successfully?

**What to Check:**
1. Did the cron job run after deployment?
2. Were there any errors in collection?
3. Was data written to `campaign_summaries`?
4. Are there logs showing successful collection?

**Action Required:** Check Vercel cron logs

---

### ⏳ 10. FALLBACK LOGIC

**Question:** Is there a fallback fetching mechanism we missed?

**Possible Overlooked Sources:**
1. Old API endpoints still being called
2. Legacy fetching code paths
3. Frontend local calculations
4. Cached Redux/state management
5. Service worker intercepts

**Action Required:** Grep for all fetch calls

---

## 🎯 IMMEDIATE ACTIONS

**Priority 1: Verify Date Calculation**
```bash
# Check what date range is being calculated for Week 47
```

**Priority 2: Check Database Data**
```sql
-- Verify what's in campaign_summaries for Week 47
SELECT 
  period_id,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  summary_date,
  created_at
FROM campaign_summaries
WHERE period_id = '2025-W47'
  AND summary_type = 'weekly'
ORDER BY created_at DESC
LIMIT 10;
```

**Priority 3: Inspect Browser Network**
```
1. Open Chrome DevTools
2. Go to Network tab
3. Filter by "fetch-live-data"
4. Reload reports page
5. Check request/response data
```

**Priority 4: Hard Refresh Browser**
```
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

---

## 📝 DEBUGGING STEPS

### Step 1: Verify Deployment
```bash
cd /Users/macbook/piotr
git log -1 --oneline  # Check last commit
vercel logs --follow  # Check deployment logs
```

### Step 2: Check Database
```bash
# Run SQL query to check data
```

### Step 3: Inspect API Response
```
1. Open reports page
2. Open DevTools (F12)
3. Go to Network tab
4. Select Week 47
5. Find fetch-live-data request
6. Examine:
   - Request payload (dateRange)
   - Response data (total_spend)
   - Response headers (debug.source)
```

### Step 4: Check Logs
```bash
# Check Vercel function logs
vercel logs /api/fetch-live-data --follow
```

### Step 5: Verify Date Calculation
```javascript
// In browser console:
// Check what dates are being calculated
const weekInfo = parseWeekPeriodId('2025-W47');
console.log('Week 47 boundaries:', weekInfo);
```

---

## 🔍 ROOT CAUSE HYPOTHESES

### Hypothesis 1: Date Calculation Mismatch ⭐⭐⭐ (Most Likely)
**Evidence:**
- Screenshot shows 10.11-16.11 (Nov 10-16)
- ISO Week 47 should be Nov 17-23
- Week numbers are off by 1

**Test:** Calculate expected dates for Week 47, 2025

### Hypothesis 2: Browser Cache ⭐⭐
**Evidence:**
- User says "still see same amount"
- No hard refresh mentioned

**Test:** Hard refresh (Cmd+Shift+R)

### Hypothesis 3: Database Has Wrong Data ⭐⭐
**Evidence:**
- Collection may have written incorrect data
- Or data is from wrong period

**Test:** Query `campaign_summaries` table directly

### Hypothesis 4: Fix Not Deployed ⭐
**Evidence:**
- Deployment completed but may have errors
- Vercel may have cached old version

**Test:** Check Vercel deployment status

### Hypothesis 5: Multiple Data Sources ⭐
**Evidence:**
- Complex data flow with multiple fetchers
- Possible legacy code paths

**Test:** Grep for all API calls

---

## 🚀 NEXT STEPS

1. **Immediate:** Verify date calculation logic
2. **Quick:** Ask user to hard refresh browser
3. **Database:** Check what data exists in database
4. **Network:** Inspect API request/response in DevTools
5. **Logs:** Check Vercel logs for errors
6. **Collection:** Verify weekly collection ran successfully

---

**This audit document will be updated as we investigate each possibility.**

