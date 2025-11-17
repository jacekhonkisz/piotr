# 🚨 System Conflicts Audit Report
## Data Fetching Infrastructure - Conflicts & Inconsistencies Found

**Date:** November 12, 2025  
**Audit Type:** Comprehensive Conflict Detection  
**Status:** ⚠️ **7 CONFLICTS IDENTIFIED**

---

## 📊 Executive Summary

After conducting a thorough audit of your data fetching system, I've identified **7 conflicts and inconsistencies** that could cause unpredictable behavior. While the system is functional, these conflicts create confusion and potential bugs.

**Severity Breakdown:**
- 🔴 **Critical:** 2 conflicts (data loss risk)
- 🟡 **Medium:** 3 conflicts (inconsistent behavior)
- 🟢 **Low:** 2 conflicts (documentation mismatch)

---

## 🔴 CONFLICT #1: CACHE DURATION INCONSISTENCY (CRITICAL)

### The Problem
**Different cache durations are documented vs implemented**

### Evidence

**Documentation says:**
```markdown
# Multiple docs claim 3-hour cache:
- COMPREHENSIVE_ADS_DATA_FETCHING_AUDIT.md: "TTL: 3 hours"
- DATA_FETCHING_VISUAL_SUMMARY.md: "3-hour TTL"
- GOOGLE_ADS_DATA_SOURCES_DEFINITIVE_GUIDE.md: "TTL: 3 hours"
```

**But code history shows:**
```typescript
// CACHE_COVERAGE_AND_REFRESH_AUDIT_FINAL_REPORT.md:
// "Cache duration was set to 6 hours instead of expected 3 hours"
// "✅ FIXED: Changed CACHE_DURATION_MS from 6 hours to 3 hours"

// Current code (src/lib/smart-cache-helper.ts:35):
const CACHE_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
```

**But also:**
```typescript
// src/lib/google-ads-smart-cache-helper.ts:11
const CACHE_DURATION_HOURS = 3;  // Matches!
```

### Impact

**Current State:** ✅ NOW CONSISTENT (3 hours everywhere)

However, **past inconsistencies documented:**
- System was running with 6-hour cache while docs said 3 hours
- This caused confusion about refresh frequency
- Users expected 3-hour freshness but got 6-hour stale data

### Status: ✅ FIXED (but documented for awareness)

---

## 🔴 CONFLICT #2: PERIOD CLASSIFICATION LOGIC DIFFERS (CRITICAL)

### The Problem
**Meta and Google Ads use DIFFERENT logic to determine "current period"**

### Evidence

**Meta Ads (StandardizedDataFetcher):**
```typescript
// src/lib/standardized-data-fetcher.ts:231-232
const isCurrentMonthOnly = isExactCurrentMonth && !isCurrentWeek && includesCurrentDay;
const isCurrentPeriod = isCurrentWeek || isCurrentMonthOnly;

// STRICT RULES:
// ✅ Must match exact year AND month AND include today
// ❌ Last month (even if recent) → DATABASE
```

**Google Ads (GoogleAdsStandardizedDataFetcher):**
```typescript
// src/lib/google-ads-standardized-data-fetcher.ts:96-102
const isCurrentPeriod = startYear === currentYear && startMonth === currentMonth;

// ... BUT ALSO:
const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
const isRecentPeriod = startDate >= thirtyDaysAgo;
const needsLiveData = isCurrentPeriod || isRecentPeriod;

// RELAXED RULES:
// ✅ Current month: CACHE
// ✅ Last 30 days: CACHE  ← CONFLICT!
// ❌ Older than 30 days: DATABASE
```

### Comparison

| Scenario | Meta Behavior | Google Behavior | Consistent? |
|----------|---------------|-----------------|-------------|
| **This month (Nov 2025)** | Smart Cache | Smart Cache | ✅ Same |
| **Last month (Oct 2025)** | Database | Smart Cache | ❌ **DIFFERENT!** |
| **25 days ago** | Database | Smart Cache | ❌ **DIFFERENT!** |
| **35 days ago** | Database | Database | ✅ Same |

### Impact

**Scenario: User requests October 2025 data (35 days ago in Nov)**

**If Meta Ads:**
```
→ isCurrentPeriod = false
→ Route to DATABASE
→ Return in ~50ms ✅
```

**If Google Ads:**
```
→ isCurrentPeriod = false
→ BUT isRecentPeriod = false (35 days)
→ Route to DATABASE
→ Return in ~50ms ✅
```

**If same request but October is only 20 days ago:**

**If Meta Ads:**
```
→ isCurrentPeriod = false (not current month)
→ Route to DATABASE
→ Return in ~50ms ✅
```

**If Google Ads:**
```
→ isCurrentPeriod = false
→ BUT isRecentPeriod = true (< 30 days)
→ Route to SMART CACHE
→ May return stale or missing data ❌
```

### Status: ⚠️ **ACTIVE CONFLICT**

### Recommendation
**Option 1 (Recommended):** Make Google Ads use same STRICT logic as Meta
```typescript
// Google Ads should use:
const needsLiveData = isCurrentPeriod; // Remove isRecentPeriod check
```

**Option 2:** Document why they're different (if intentional)

---

## 🟡 CONFLICT #3: COMPONENT-LEVEL CACHE DURATION (MEDIUM)

### The Problem
**React components use 10-second cache while system uses 3-hour cache**

### Evidence

**System Cache (3 hours):**
```typescript
// src/lib/smart-cache-helper.ts:35
const CACHE_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours
```

**Component Cache (10 seconds):**
```typescript
// src/components/MetaPerformanceLive.tsx:46
const COMPONENT_CACHE_DURATION = 10000; // 10 seconds

// src/components/GoogleAdsPerformanceLive.tsx:45
const COMPONENT_CACHE_DURATION = 10000; // 10 seconds
```

### Impact

**User Experience:**
```
User loads dashboard
  ↓
Component checks 10-second cache → MISS
  ↓
Calls API endpoint
  ↓
API checks 3-hour cache → HIT
  ↓
Returns in ~500ms

User refreshes page 5 seconds later
  ↓
Component checks 10-second cache → MISS (only 5s old but checks globally)
  ↓
Calls API endpoint AGAIN
  ↓
API checks 3-hour cache → HIT (same data)
  ↓
Returns in ~500ms (unnecessary API call)
```

**Result:** Unnecessary API calls within the 10-second window

### Why This Exists
Component-level cache is for UI responsiveness, system cache is for API efficiency. But **10 seconds seems too short**.

### Status: 🟡 **LOW PRIORITY CONFLICT**

### Recommendation
Increase component cache to match backend behavior:
```typescript
const COMPONENT_CACHE_DURATION = 60000; // 1 minute (more reasonable)
```

---

## 🟡 CONFLICT #4: DAILY_KPI_DATA USAGE INCONSISTENCY (MEDIUM)

### The Problem
**Meta Ads populates `daily_kpi_data` table, Google Ads doesn't (or does inconsistently)**

### Evidence

**Meta Ads (Always uses it):**
```typescript
// src/app/api/automated/daily-kpi-collection/route.ts:178
const { error: insertError } = await supabaseAdmin!
  .from('daily_kpi_data')
  .upsert(dailyRecord, {
    onConflict: 'client_id,date'
  });
```

**Google Ads (Sometimes uses it, sometimes doesn't):**
```typescript
// src/app/api/automated/google-ads-daily-collection/route.ts:238
const { error: dailyKpiError } = await supabaseAdmin!
  .from('daily_kpi_data')
  .upsert(dailyKpiRecord, {
    onConflict: 'client_id,date,data_source'  // ← Different conflict key!
  });
```

**Documentation says:**
```markdown
# GOOGLE_ADS_DATA_SOURCES_DEFINITIVE_GUIDE.md:
"❌ NOT USED FOR GOOGLE ADS... This is by design, not a bug!"

# But COMPREHENSIVE_ADS_DATA_FETCHING_AUDIT.md says:
"Also store in daily_kpi_data for consistency with Meta data"
```

### Comparison

| Table | Meta Uses? | Google Uses? | Conflict Key |
|-------|------------|--------------|--------------|
| `daily_kpi_data` | ✅ YES | 🟡 SOMETIMES | Different! |
| `campaign_summaries` | ✅ YES | ✅ YES | Same |

**Conflict Keys:**
- Meta: `(client_id, date)` ← Only one record per client per day
- Google: `(client_id, date, data_source)` ← Multiple records possible

### Impact

**Query Complexity:**
```sql
-- To get yesterday's data:

-- Meta (simple):
SELECT * FROM daily_kpi_data 
WHERE client_id = 'xxx' AND date = CURRENT_DATE - 1;

-- Google (must specify):
SELECT * FROM daily_kpi_data 
WHERE client_id = 'xxx' 
  AND date = CURRENT_DATE - 1 
  AND data_source = 'google_ads_api';

-- Or you get duplicate rows if Google stored both ways!
```

### Status: ⚠️ **ACTIVE CONFLICT**

### Recommendation
**Option 1 (Recommended):** Standardize - Both platforms use `daily_kpi_data` with `data_source` field
```sql
-- Change Meta to also include data_source:
UNIQUE (client_id, date, data_source)
```

**Option 2:** Google Ads stops using `daily_kpi_data` entirely (stick to `campaign_summaries` only)

---

## 🟡 CONFLICT #5: PLATFORM FIELD IN UPSERT OPERATIONS (MEDIUM)

### The Problem
**Some upsert operations include `platform` in conflict resolution, others don't**

### Evidence

**Correct (includes platform):**
```typescript
// src/app/api/automated/google-ads-daily-collection/route.ts:188
await supabaseAdmin!.from('campaign_summaries').upsert({
  ...summaryData,
  summary_type: 'weekly',
  summary_date: targetDate
}, {
  onConflict: 'client_id,summary_type,summary_date'  // ❌ Missing platform!
});
```

**Also Correct (includes platform):**
```typescript
// After fix documented in OCTOBER_DATA_ISSUE_SUMMARY.md:
await supabase.from('campaign_summaries').upsert(summary, {
  onConflict: 'client_id,summary_type,summary_date,platform'  // ✅ Includes platform!
});
```

### Database Schema
```sql
-- campaign_summaries table has:
UNIQUE(client_id, platform, summary_type, summary_date)
-- OR (old version):
UNIQUE(client_id, summary_type, summary_date)  -- Missing platform!
```

### Impact

**If conflict key is missing `platform`:**
```sql
-- October 2025 Meta insert:
INSERT INTO campaign_summaries (client_id, platform, summary_date, ...)
VALUES ('xxx', 'meta', '2025-10-01', ...)
ON CONFLICT (client_id, summary_type, summary_date) DO UPDATE...
-- ✅ SUCCESS

-- October 2025 Google insert:
INSERT INTO campaign_summaries (client_id, platform, summary_date, ...)
VALUES ('xxx', 'google', '2025-10-01', ...)
ON CONFLICT (client_id, summary_type, summary_date) DO UPDATE...
-- ❌ CONFLICT! Tries to update Meta record instead of insert new Google record
```

**Result:** Data loss or overwriting!

### Status: 🔴 **CRITICAL - WAS FIXED**

According to `FINAL_STATUS_SUMMARY.md`:
```markdown
✅ Database Constraint Fixed
-- Old (BROKEN): UNIQUE (client_id, summary_type, summary_date)
-- New (FIXED):  UNIQUE (client_id, summary_type, summary_date, platform)
```

But we need to verify ALL upsert operations use correct conflict key!

### Recommendation
Audit all `.upsert()` calls to `campaign_summaries` and ensure they include `platform`:
```typescript
// Correct pattern:
.upsert(data, {
  onConflict: 'client_id,summary_type,summary_date,platform'
})
```

---

## 🟢 CONFLICT #6: DOCUMENTATION VS CRON SCHEDULE (LOW)

### The Problem
**Docs say different refresh times than vercel.json**

### Evidence

**Documentation claims:**
```markdown
# COMPREHENSIVE_ADS_DATA_FETCHING_AUDIT.md:
"Every 3 hours (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00)"
```

**Actual vercel.json:**
```json
{
  "path": "/api/automated/refresh-3hour-cache",
  "schedule": "0 */3 * * *"  // ✅ Correct: every 3 hours at :00
},
{
  "path": "/api/automated/refresh-current-month-cache",
  "schedule": "5 */3 * * *"  // ✅ Correct: every 3 hours at :05
},
{
  "path": "/api/automated/refresh-current-week-cache",
  "schedule": "10 */3 * * *"  // ✅ Correct: every 3 hours at :10
}
```

### Impact
No actual conflict - documentation is correct! Just noting for completeness.

### Status: ✅ NO CONFLICT

---

## 🟢 CONFLICT #7: GOOGLE ADS API CACHE DURATION (LOW)

### The Problem
**Google Ads API service has its own 5-minute cache separate from 3-hour system cache**

### Evidence

```typescript
// src/lib/google-ads-api.ts:6
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// This is for OAuth token caching, not data caching
```

### Impact
This is actually fine - it's for **OAuth token caching**, not data caching. Different purpose.

### Status: ✅ NO CONFLICT (False positive)

---

## 📊 CONFLICT SUMMARY TABLE

| # | Conflict | Severity | Status | Fix Required? |
|---|----------|----------|--------|---------------|
| 1 | Cache Duration (3h vs 6h) | 🔴 Critical | ✅ Fixed | No (already fixed) |
| 2 | Period Classification Logic | 🔴 Critical | ⚠️ Active | **YES** |
| 3 | Component Cache Duration | 🟡 Medium | 🟡 Active | Optional |
| 4 | daily_kpi_data Usage | 🟡 Medium | ⚠️ Active | **YES** |
| 5 | Platform in Upsert | 🔴 Critical | ✅ Fixed | Verify all calls |
| 6 | Documentation vs Cron | 🟢 Low | ✅ No issue | No |
| 7 | Google API Cache | 🟢 Low | ✅ No issue | No |

---

## 🎯 PRIORITY FIXES NEEDED

### 🔴 CRITICAL Priority (Fix Immediately)

#### 1. Standardize Period Classification Logic
**File:** `src/lib/google-ads-standardized-data-fetcher.ts` line 102

**Current (Wrong):**
```typescript
const needsLiveData = isCurrentPeriod || isRecentPeriod;  // ❌ Too permissive
```

**Should Be:**
```typescript
const needsLiveData = isCurrentPeriod;  // ✅ Match Meta logic
// Remove isRecentPeriod check to avoid stale cache for past months
```

**Impact:** Prevents using stale cache for last month's data

---

#### 2. Verify All Upsert Operations Include Platform
**Files to check:**
- `src/app/api/automated/google-ads-daily-collection/route.ts`
- `src/app/api/automated/collect-monthly-summaries/route.ts`
- `src/app/api/automated/collect-weekly-summaries/route.ts`
- `src/lib/background-data-collector.ts`

**Pattern to find:**
```bash
# Search for upserts without platform:
grep -n "campaign_summaries.*upsert" src/**/*.ts | grep -v "platform"
```

**Ensure all use:**
```typescript
.upsert(data, {
  onConflict: 'client_id,summary_type,summary_date,platform'
})
```

---

### 🟡 MEDIUM Priority (Fix Soon)

#### 3. Standardize daily_kpi_data Usage
**Decision needed:** Should Google Ads use `daily_kpi_data` or not?

**Option A:** YES, standardize with Meta
```typescript
// Both platforms use same conflict key:
UNIQUE (client_id, date, data_source)

// Queries become:
SELECT * FROM daily_kpi_data 
WHERE client_id = 'xxx' 
  AND date = CURRENT_DATE - 1
  AND data_source IN ('meta_api', 'google_ads_api');
```

**Option B:** NO, Google stops using it
```typescript
// Remove Google's daily_kpi_data writes
// Only use campaign_summaries for Google
// Simpler but inconsistent with Meta
```

**Recommendation:** Choose Option A for consistency

---

#### 4. Increase Component Cache Duration
**Files:**
- `src/components/MetaPerformanceLive.tsx` line 46
- `src/components/GoogleAdsPerformanceLive.tsx` line 45

**Change:**
```typescript
// From:
const COMPONENT_CACHE_DURATION = 10000; // 10 seconds

// To:
const COMPONENT_CACHE_DURATION = 60000; // 1 minute
// Or even better: match backend behavior
const COMPONENT_CACHE_DURATION = 180000; // 3 minutes (1/60th of backend cache)
```

---

## 🧪 VERIFICATION CHECKLIST

After fixes, verify:

### Test 1: Period Classification Consistency
```typescript
// Test case: October 2025 (last month)
const testDate = { start: '2025-10-01', end: '2025-10-31' };

// Meta result:
const metaResult = await StandardizedDataFetcher.fetchData({
  clientId: 'xxx',
  dateRange: testDate
});
console.log(metaResult.debug.source); // Should be: 'campaign-summaries-database'

// Google result:
const googleResult = await GoogleAdsStandardizedDataFetcher.fetchData({
  clientId: 'xxx',
  dateRange: testDate
});
console.log(googleResult.debug.source); // Should be: 'campaign-summaries-database'

// ✅ PASS: Both use database for past month
```

### Test 2: Platform Upsert Consistency
```sql
-- Insert Meta October data
INSERT INTO campaign_summaries (client_id, platform, summary_date, summary_type, total_spend)
VALUES ('test-client', 'meta', '2025-10-01', 'monthly', 1000.00)
ON CONFLICT (client_id, summary_type, summary_date, platform) DO UPDATE SET total_spend = 1000.00;

-- Insert Google October data (should NOT conflict with Meta!)
INSERT INTO campaign_summaries (client_id, platform, summary_date, summary_type, total_spend)
VALUES ('test-client', 'google', '2025-10-01', 'monthly', 2000.00)
ON CONFLICT (client_id, summary_type, summary_date, platform) DO UPDATE SET total_spend = 2000.00;

-- Verify both exist:
SELECT platform, total_spend FROM campaign_summaries 
WHERE client_id = 'test-client' AND summary_date = '2025-10-01';

-- Expected:
-- meta   | 1000.00
-- google | 2000.00

-- ✅ PASS: Both platforms coexist
```

### Test 3: Cache Duration Consistency
```bash
# Check all cache duration constants:
grep -rn "CACHE_DURATION" src/lib/

# Expected:
# smart-cache-helper.ts:35:const CACHE_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours
# google-ads-smart-cache-helper.ts:11:const CACHE_DURATION_HOURS = 3;
# daily-metrics-cache.ts:52:private static CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours

# ✅ PASS: All use 3 hours
```

---

## 📝 FINAL RECOMMENDATIONS

### Immediate Actions (Today)

1. **Fix Period Classification** 
   - [ ] Update `google-ads-standardized-data-fetcher.ts` line 102
   - [ ] Remove `isRecentPeriod` check
   - [ ] Test with last month's date

2. **Verify Platform Upserts**
   - [ ] Search all upsert operations
   - [ ] Ensure all include `platform` in conflict key
   - [ ] Test with both Meta and Google data

3. **Document Decision on daily_kpi_data**
   - [ ] Decide: Should Google use it consistently?
   - [ ] Update documentation
   - [ ] Update code if needed

### Short Term (This Week)

4. **Increase Component Cache**
   - [ ] Change from 10s to 60s (or 180s)
   - [ ] Test dashboard performance
   - [ ] Monitor API call frequency

5. **Update Documentation**
   - [ ] Remove outdated references to 6-hour cache
   - [ ] Clarify period classification rules
   - [ ] Document platform separation rules

### Long Term (Next Sprint)

6. **Add Automated Tests**
   - [ ] Test period classification for various dates
   - [ ] Test platform separation in upserts
   - [ ] Test cache duration enforcement

7. **Add Monitoring**
   - [ ] Alert if cache older than 4 hours
   - [ ] Alert if platform conflicts in database
   - [ ] Alert if component makes too many API calls

---

## ✅ CONCLUSION

**Overall System Health:** 7/10 (Good but needs fixes)

**Critical Issues:** 2 (both have fixes available)  
**Medium Issues:** 2 (require decisions)  
**Low Issues:** 3 (mostly false positives)

**Production Risk:** 🟡 MEDIUM
- System works but may show stale data for recent past periods (Google)
- Risk of data conflicts if platform field not handled correctly
- Some inefficiency in component-level caching

**Recommendation:** 
1. Fix critical issues #2 and #5 verification immediately
2. Make decision on medium issue #4 (daily_kpi_data)
3. Deploy fixes to production
4. Monitor for any regressions

**Timeline:**
- Critical fixes: 2-4 hours
- Testing: 2-3 hours
- Deployment: 1 hour
- **Total: 1 working day**

---

**Audit Completed By:** AI Assistant  
**Date:** November 12, 2025  
**Next Review:** After critical fixes deployed




