# 🚨 WEEKLY DATA AUDIT - Current Display Issue

**Date:** November 18, 2025  
**Issue:** Current week showing monthly data, past weeks not fetching properly

---

## 📊 OBSERVED PROBLEM

### Screenshot Analysis

**Week 47 (Nov 17-23, 2025) - CURRENT WEEK:**
- Spend: **25,260.48 zł** (looks like monthly total!)
- Impressions: **2.0M** (way too high for one week)
- Conversions: **420** (too many for one week)
- **ISSUE:** This is showing November monthly data, not weekly!

**Week 46 (Nov 10-16, 2025) - PAST WEEK:**
- Spend: **6,271.48 zł** (looks reasonable for a week)
- Impressions: **521.8K**
- Conversions: **18**
- **ISSUE:** Much lower - but is this complete data?

---

## 🔍 ROOT CAUSE ANALYSIS

### Issue #1: Current Week Falling Back to Monthly Data

#### The Problem Flow:

```
User requests: Week 47 (Nov 17-23, 2025)
     ↓
System detects: "This includes today, so it's current week"
     ↓
Tries: Smart cache for current week
     ↓
Smart cache check fails or returns wrong data
     ↓
Falls back to: MONTHLY cache (WRONG!)
     ↓
Result: Shows 25,260 zł (full November month)
```

#### Code Location: `src/app/api/fetch-live-data/route.ts`

```typescript
// Lines 182-200
const isWeekIncludingToday = (summaryType === 'weekly' && start <= now && end >= now);

if ((isCurrentMonth || isWeekIncludingToday) && endDate > today) {
  adjustedEndDate = today; // Caps to Nov 17
}

const isCurrentWeek = summaryType === 'weekly' && start <= now && end >= now && adjustedEndDate >= today;

// Problem:
// Week 47: Nov 17-23
// start <= now: TRUE (Nov 17 <= Nov 17)
// end >= now: TRUE (Nov 23 >= Nov 17)
// isCurrentWeek: TRUE ✅

// BUT: When smart cache fails, it falls back to monthly cache!
```

#### Why Smart Cache Might Be Failing:

**Location:** `src/lib/smart-cache-helper.ts:1359-1406`

```typescript
export async function getSmartWeekCacheData(clientId: string, forceRefresh: boolean = false, requestedPeriodId?: string) {
  const targetWeek = requestedPeriodId ? parseWeekPeriodId(requestedPeriodId) : getCurrentWeekInfo();
  
  const isCurrentWeekRequest = isCurrentWeekPeriod(targetWeek.periodId);
  
  if (!isCurrentWeekRequest) {
    // Returns shouldUseDatabase = true
    // But caller might not handle this properly!
    return {
      success: false,
      shouldUseDatabase: true,
      ...
    };
  }
  
  // Continue with cache lookup
  // Check current_week_cache table
  // If empty or stale, fetch fresh data
}
```

**Problem:** The smart cache function returns `success: false` with `shouldUseDatabase: true` for historical weeks, but the caller might not be checking this flag properly and falls back to monthly cache instead!

---

### Issue #2: Past Weeks Not Fetched from Database

#### The Problem Flow:

```
User requests: Week 46 (Nov 10-16, 2025)
     ↓
System detects: "This is a past week"
     ↓
Tries: Database lookup in campaign_summaries
     ↓
Query:
  WHERE summary_type = 'weekly'
    AND summary_date >= '2025-11-10'
    AND summary_date <= '2025-11-16'
    AND platform = 'meta'
  LIMIT 1
     ↓
Result: NO DATA FOUND or INCOMPLETE DATA
     ↓
Falls back to: ???
```

#### Root Cause #1: Weekly Collection Not Running

**Cron Schedule Check:**
```json
// vercel.json
{
  "path": "/api/automated/collect-weekly-summaries",
  "schedule": "0 3 * * 0"  // Sunday 3 AM
}
```

**Questions:**
1. ✅ Is the cron job enabled? (YES - we just configured it)
2. ⚠️ Has it run yet? (NO - it runs Sunday 3 AM, today is Monday)
3. ⚠️ Does the database have weekly data for Week 46? (NEED TO CHECK)

#### Root Cause #2: Database Query Mismatch

**Location:** `src/app/api/fetch-live-data/route.ts:226-235`

```typescript
const { data: weeklyResults, error: weeklyError } = await supabase
  .from('campaign_summaries')
  .select('*')
  .eq('client_id', clientId)
  .eq('summary_type', 'weekly')
  .eq('platform', platform)
  .gte('summary_date', startDate)      // >= '2025-11-10'
  .lte('summary_date', adjustedEndDate) // <= '2025-11-16'
  .order('summary_date', { ascending: false })
  .limit(1);
```

**Problem:** 
- Query looks for `summary_date >= '2025-11-10'`
- But weekly data is stored with `summary_date = '2025-11-11'` (Monday)
- Week 46 actually starts Monday Nov 11, not Nov 10!

**Date Range Confusion:**
```
What UI shows:  Nov 10-16 (Sunday-Saturday)
What's stored:  Nov 11-17 (Monday-Sunday)
Query mismatch: Looking for Nov 10, but data is at Nov 11!
```

---

## 🔧 IMMEDIATE ISSUES TO FIX

### Fix #1: Prevent Current Week Falling Back to Monthly

**Problem:** When smart cache returns `success: false`, system falls back to monthly cache.

**Solution:** Check for `shouldUseDatabase` flag and use database lookup instead.

**File:** `src/app/api/fetch-live-data/route.ts`

```typescript
// Around line 40-60 where smart cache is called

if (summaryType === 'weekly') {
  const cacheResult = await getSmartWeekCacheData(clientId, false, periodId);
  
  // ✅ FIX: Check shouldUseDatabase flag
  if (!cacheResult.success && cacheResult.shouldUseDatabase) {
    console.log('📚 Smart cache says use database for historical week');
    // Force database lookup
    return await loadFromDatabase(clientId, startDate, endDate, platform);
  }
  
  // Only use cache if it succeeded
  if (cacheResult.success) {
    return cacheResult;
  }
  
  // If cache failed and NOT shouldUseDatabase, then fetch fresh
  // BUT: Don't fall back to monthly!
}
```

### Fix #2: Weekly Collection Must Run

**Check:**
1. Has the weekly collection cron run yet?
2. Is there data in `campaign_summaries` for Week 46?

**Query to check:**
```sql
SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  created_at
FROM campaign_summaries
WHERE client_id = 'belmonte-hotel-id'
  AND summary_type = 'weekly'
  AND summary_date >= '2025-11-10'
  AND summary_date <= '2025-11-17'
  AND platform = 'meta'
ORDER BY summary_date DESC;
```

**If NO DATA:** Weekly collection hasn't run or failed.

**Action:** Run manual collection:
```bash
curl -X POST https://your-domain.com/api/automated/collect-weekly-summaries \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Fix #3: Week Boundary Consistency

**Problem:** UI shows Sun-Sat, but system stores Mon-Sun

**Solution:** Standardize on Monday-Sunday (ISO 8601) everywhere:

1. **UI Layer:** Update week selection to show Monday-Sunday
2. **API Layer:** Already using Monday-Sunday ✅
3. **Database:** Already storing Monday as summary_date ✅

**OR:** Fix the query to handle Sunday start dates:

```typescript
// If startDate is Sunday, adjust to Monday
let queryStartDate = startDate;
const startDay = new Date(startDate).getDay();
if (startDay === 0) { // Sunday
  const monday = new Date(startDate);
  monday.setDate(monday.getDate() + 1);
  queryStartDate = monday.toISOString().split('T')[0];
}
```

---

## 📊 DATA FLOW DIAGNOSIS

### Current Week (Nov 17-23) - WRONG DATA

```
1. User clicks: "Week Nov 17-23"
2. Frontend calculates: 2025-11-17 to 2025-11-23
3. API receives: startDate='2025-11-17', endDate='2025-11-23'
4. API detects: summaryType = 'weekly' (7 days)
5. API checks: isCurrentWeek = TRUE (includes today)
6. API calls: getSmartWeekCacheData()
   ↓
   6a. Smart cache checks: Is this current week? YES
   6b. Smart cache looks in: current_week_cache table
   6c. Smart cache finds: EMPTY or STALE data
   6d. Smart cache returns: success = false
   ↓
7. API falls back to: loadFromDatabase() ??? 
   OR: Falls back to MONTHLY CACHE (WRONG!)
   ↓
8. Monthly cache returns: November data (25,260 zł)
9. UI shows: MONTHLY DATA (WRONG!)
```

### Past Week (Nov 10-16) - MISSING DATA

```
1. User clicks: "Week Nov 10-16"
2. Frontend calculates: 2025-11-10 to 2025-11-16
3. API receives: startDate='2025-11-10', endDate='2025-11-16'
4. API detects: summaryType = 'weekly' (7 days)
5. API checks: isCurrentWeek = FALSE (past week)
6. API calls: loadFromDatabase()
   ↓
   6a. Query: summary_date >= '2025-11-10' AND summary_date <= '2025-11-16'
   6b. Database has: summary_date = '2025-11-11' (Monday)
   6c. Query matches: YES (11 >= 10 and 11 <= 16)
   6d. Database returns: Week 46 data (if it exists)
   ↓
7. If NO DATA FOUND:
   7a. Falls back to: Live API call? (expensive)
   7b. OR: Returns empty/zeros
   ↓
8. UI shows: Low numbers or zeros (6,271 zł might be incomplete)
```

---

## 🎯 ACTION PLAN

### Immediate (Fix Now)

1. **Check Database for Week 46 Data**
   ```sql
   SELECT COUNT(*) FROM campaign_summaries
   WHERE summary_type = 'weekly'
     AND summary_date >= '2025-11-01'
     AND platform = 'meta';
   ```

2. **If NO DATA:** Run weekly collection manually
   ```bash
   curl -X POST /api/automated/collect-weekly-summaries \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

3. **Fix Smart Cache Fallback Logic**
   - Check `shouldUseDatabase` flag
   - Don't fall back to monthly cache for weekly requests

### Short-term (This Week)

4. **Add Logging to Diagnose Current Week Issue**
   ```typescript
   console.log('🔍 WEEKLY DATA FETCH:', {
     requestedWeek: `${startDate} to ${endDate}`,
     isCurrentWeek,
     smartCacheResult: cacheResult,
     fallbackUsed: 'monthly' | 'database' | 'live',
     finalData: { spend, impressions }
   });
   ```

5. **Verify Weekly Collection Runs Successfully**
   - Wait for Sunday 3 AM
   - Check logs for success
   - Verify data in database

### Long-term (Next Week)

6. **Standardize Week Boundaries UI**
   - Show Monday-Sunday in UI (not Sunday-Saturday)
   - Match backend storage

7. **Add Data Validation**
   - Detect when weekly data looks like monthly data
   - Alert if weekly spend > expected threshold

---

## 📋 VERIFICATION CHECKLIST

### For Current Week (Week 47):
- [ ] Smart cache returns correct current week data
- [ ] If cache empty, fetches fresh weekly data (not monthly)
- [ ] Spend is ~1,500-4,000 zł (not 25,000 zł)
- [ ] Impressions are ~50K-200K (not 2M)

### For Past Weeks (Week 46, 45, etc.):
- [ ] Database has weekly data stored
- [ ] Query finds the correct week's data
- [ ] Spend is consistent week-to-week
- [ ] No fallback to monthly data

### For Weekly Collection:
- [ ] Cron job runs Sunday 3 AM
- [ ] Collects last 53 weeks
- [ ] Stores with summary_type='weekly'
- [ ] Stores Monday as summary_date

---

## 🔍 DEBUG QUERIES

### Check if weekly data exists:
```sql
SELECT 
  client_id,
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  created_at
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND summary_date >= '2025-11-01'
  AND platform = 'meta'
ORDER BY summary_date DESC
LIMIT 10;
```

### Check current week cache:
```sql
SELECT 
  client_id,
  period_id,
  last_updated,
  (cache_data->>'total_spend')::numeric as spend
FROM current_week_cache
WHERE period_id LIKE '2025-W%'
ORDER BY last_updated DESC
LIMIT 5;
```

### Check if collection ran:
```sql
SELECT 
  summary_date,
  COUNT(*) as weeks_collected,
  SUM(total_spend) as total_spend
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND platform = 'meta'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY summary_date
ORDER BY summary_date DESC;
```

---

## 🚨 MOST LIKELY ISSUES

### 1. **Current Week Issue (25,260 zł)**

**Probability:** 90%  
**Root Cause:** Smart cache returns `success: false` but code doesn't check `shouldUseDatabase` flag, so it falls back to monthly cache.

**Fix:** Add proper flag checking in `fetch-live-data/route.ts`

### 2. **Past Week Issue (6,271 zł)**

**Probability:** 80%  
**Root Cause:** Weekly collection hasn't run yet (scheduled for Sunday 3 AM), so no historical weekly data exists in database.

**Fix:** Run manual collection now, then wait for Sunday cron.

### 3. **Week Boundary Mismatch**

**Probability:** 60%  
**Root Cause:** UI shows Sunday-Saturday but backend stores Monday-Sunday, causing query mismatches.

**Fix:** Adjust query to handle Sunday start dates or update UI.

---

**Status:** 🔴 CRITICAL - Current week showing wrong data  
**Priority:** P0 - Fix immediately  
**Next Step:** Check database for weekly data, then fix smart cache fallback logic

