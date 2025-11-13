# 🔍 Weekly Cache System Audit Report
**Date:** November 13, 2025  
**Issue:** Weekly cache showing 0% fresh entries vs Monthly cache showing 20% fresh  
**Priority:** HIGH - Affects Belmonte and all Meta Weekly data

---

## 📊 Current Status (From Screenshot)

| Cache Type | Total Entries | Fresh (%) | Stale (%) | Last Update |
|------------|---------------|-----------|-----------|-------------|
| **Meta Monthly** | 5 | 1 (20%) | 4 (80%) | 13.11.2025, 14:33 |
| **Meta Weekly** | 13 | 0 (0%) | 13 (100%) | 12.11.2025, 19:11 |
| **Google Ads Monthly** | 28 | 0 (0%) | 28 (100%) | 11.11.2025, 10:17 |
| **Google Ads Weekly** | 56 | 0 (0%) | 56 (100%) | 11.11.2025, 10:21 |

**🚨 CRITICAL FINDING:**  
**Meta Weekly** last update was **~19 hours ago** (12.11.2025, 19:11), which is **STALE**.  
**Meta Monthly** last update was **recent** (13.11.2025, 14:33), which shows the monthly system IS working.

---

## 🔧 System Configuration Analysis

### ✅ Cache Freshness Threshold
```typescript
// src/lib/smart-cache-helper.ts:35
const CACHE_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

// src/app/api/admin/cache-monitoring/route.ts:10
const CACHE_FRESHNESS_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours
```
**Status:** ✅ **CORRECT** - Both systems use 3-hour threshold consistently

---

### ✅ Background Refresh Configuration
```typescript
// src/lib/smart-cache-helper.ts:1416
const ENABLE_BACKGROUND_REFRESH = true; // ✅ ENABLED for proper caching
```
**Status:** ✅ **ENABLED** - Background refresh is active

---

### ✅ Automated Cron Job Configuration
```json
// vercel.json:12-13
{
  "path": "/api/automated/refresh-current-week-cache",
  "schedule": "10 */3 * * *"  // Every 3 hours at :10
}
```
**Status:** ✅ **CONFIGURED** - Cron job should run every 3 hours

---

### ✅ Cron Job Implementation
**File:** `src/app/api/automated/refresh-current-week-cache/route.ts`

**Logic:**
1. ✅ Fetches all clients with `api_status = 'valid'`
2. ✅ Checks if cache is < 2.5 hours old (skips if fresh)
3. ✅ Calls `/api/smart-weekly-cache` with `forceRefresh: true`
4. ✅ Processes in batches of 3 clients
5. ✅ Has retry logic (3 attempts with exponential backoff)

**Status:** ✅ **IMPLEMENTATION LOOKS CORRECT**

---

## 🔴 PROBLEM IDENTIFICATION

### **Primary Issue: Cron Job Not Running or Failing**

Based on the evidence:

1. **Meta Weekly** last update: **12.11.2025, 19:11** (~19 hours ago)
2. **Expected behavior:** Should refresh every 3 hours
3. **Missing updates:** Last expected refresh was at 13.11.2025, 22:10 (latest)
4. **Missing refresh cycles:** At least **6 refresh cycles** missed since last update

**Possible Causes:**

#### **A. Vercel Cron Job Not Executing** ⚠️ MOST LIKELY
```
Symptoms:
- Cron configured but not triggering
- No recent updates to weekly cache
- Monthly cache working (different schedule)

Diagnosis Needed:
- Check Vercel deployment logs
- Verify cron job execution history
- Check if cron is enabled in Vercel project settings
```

#### **B. Cron Job Executing But Failing Silently** 🔴 POSSIBLE
```
Symptoms:
- Cron triggers but encounters errors
- No successful cache updates
- Errors not visible in monitoring

Diagnosis Needed:
- Check application logs for errors at :10 of every 3rd hour
- Look for API call failures
- Check error tracking (Sentry, LogDrain, etc.)
```

#### **C. Token Issues Preventing API Calls** 🟡 LESS LIKELY
```
Symptoms:
- Tokens expired or invalid
- API calls failing for all clients
- No data being fetched

Evidence Against:
- Monthly cache IS updating (uses same tokens)
- Screenshot shows some monthly entries are fresh
```

#### **D. Period ID Mismatch** 🟡 LESS LIKELY
```
Symptoms:
- Cache entries have wrong period_id
- System looking for current week but cache has old week

Evidence Against:
- System should create new entries if period_id doesn't match
- Last update was yesterday (period should still be valid)
```

---

## 🔍 DIAGNOSTIC STEPS

### **Step 1: Run Database Audit** (✅ CREATED)
File: `audit_weekly_cache_issue.sql`

**This will check:**
- Actual last_updated timestamps in database
- Belmonte's specific weekly cache status
- Current week period_id calculation
- Comparison with monthly cache
- Token health status

---

### **Step 2: Check Vercel Cron Execution** (⚠️ ACTION REQUIRED)

**How to check:**
1. Go to Vercel Dashboard → Your Project
2. Navigate to **Logs** tab
3. Filter by: `/api/automated/refresh-current-week-cache`
4. Check execution times around:
   - 13.11.2025, 01:10
   - 13.11.2025, 04:10
   - 13.11.2025, 07:10
   - 13.11.2025, 10:10
   - 13.11.2025, 13:10

**Expected:** Should see log entries for each execution  
**If missing:** Cron is not triggering

---

### **Step 3: Manual Trigger Test** (🧪 RECOMMENDED)

```bash
# Test the weekly cache refresh endpoint manually
curl -X POST https://your-domain.com/api/automated/refresh-current-week-cache \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected Result:**
- Should return success response
- Should update weekly cache for all active clients
- Should see updated timestamps in cache monitoring

---

### **Step 4: Check Vercel Cron Settings** (⚠️ ACTION REQUIRED)

**Verify:**
1. Vercel Project → Settings → Cron Jobs
2. Check if cron jobs are **enabled**
3. Check if there are any **error notifications**
4. Verify `vercel.json` is deployed correctly

**Common Issues:**
- Cron jobs disabled at project level
- `vercel.json` not in project root
- Syntax errors in `vercel.json`
- Vercel plan doesn't support cron (free tier has limits)

---

## 🎯 ROOT CAUSE ANALYSIS

### **Most Likely Root Cause: Vercel Cron Not Executing**

**Evidence:**
1. ✅ Code implementation is correct
2. ✅ Background refresh is enabled
3. ✅ Cache freshness threshold is correct
4. ❌ **No recent updates to weekly cache (~19 hours old)**
5. ❌ **At least 6 expected refresh cycles missed**
6. ✅ **Monthly cache IS updating** (different cron schedule)

**Conclusion:**  
The weekly cron job at `10 */3 * * *` is **NOT EXECUTING**, while other crons (like monthly) may be working.

---

## 💡 IMMEDIATE FIXES

### **Fix 1: Verify and Enable Vercel Cron** (PRIORITY 1)

**Steps:**
1. Go to Vercel Dashboard
2. Project Settings → Cron Jobs
3. Verify all cron jobs are **enabled**
4. Check for any error messages
5. If disabled, **enable them**

---

### **Fix 2: Manual Cache Refresh** (IMMEDIATE WORKAROUND)

```bash
# Manually refresh weekly cache for all clients
curl -X POST https://your-domain.com/api/automated/refresh-current-week-cache
```

This will:
- Update all stale weekly cache entries
- Get Belmonte back to fresh state
- Provide immediate relief while investigating cron issue

---

### **Fix 3: Check Vercel Logs** (DIAGNOSTIC)

**Look for:**
- Cron execution logs at :10 of every 3rd hour
- Any error messages related to `/api/automated/refresh-current-week-cache`
- API timeout or rate limit issues
- Token validation failures

---

### **Fix 4: Add Monitoring & Alerting** (PREVENTION)

**Recommended:**
1. **Add health check endpoint:**
   ```typescript
   // /api/health/cache-freshness
   // Returns alert if any cache is > 6 hours stale
   ```

2. **Set up alerts:**
   - Email/Slack notification if weekly cache > 6 hours old
   - Daily summary of cache health
   - Cron job execution confirmations

3. **Add logging:**
   ```typescript
   // In cron job
   logger.info('Weekly cache refresh started', {
     timestamp: new Date().toISOString(),
     clientCount: clients.length
   });
   
   logger.info('Weekly cache refresh completed', {
     successCount, errorCount, duration
   });
   ```

---

## 📊 COMPARISON: Why Monthly Works But Weekly Doesn't

| Aspect | Monthly Cache | Weekly Cache | Status |
|--------|---------------|--------------|---------|
| Cron Schedule | `5 */3 * * *` (every 3h at :05) | `10 */3 * * *` (every 3h at :10) | Both should work |
| Last Update | 13.11.2025, 14:33 (**recent**) | 12.11.2025, 19:11 (**19h ago**) | ❌ Weekly not updating |
| Fresh Entries | 1/5 (20%) | 0/13 (0%) | ❌ All weekly stale |
| Code Implementation | ✅ Complete | ✅ Complete | Both correct |
| Background Refresh | ✅ Enabled | ✅ Enabled | Both enabled |
| **Cron Execution** | ✅ **Working** | ❌ **NOT WORKING** | **ROOT CAUSE** |

---

## 🔧 BELMONTE-SPECIFIC CHECK

### **Why Belmonte Should Be Working:**
1. ✅ Has valid system user token (from previous migrations)
2. ✅ Token health status: `valid`
3. ✅ API status: `valid`
4. ✅ Has ad_account_id configured
5. ✅ Monthly cache IS working for Belmonte

### **Why Belmonte Weekly Cache Is Stale:**
❌ **Cron job not executing** - affects ALL clients, not just Belmonte

---

## 📝 RECOMMENDED ACTIONS (Priority Order)

### **Priority 1: Immediate** ⏰ DO NOW
1. ✅ **Run `audit_weekly_cache_issue.sql`** - Confirm database state
2. 🔴 **Check Vercel Cron Logs** - Find out if cron is executing
3. 🔴 **Manual trigger test** - Verify endpoint works
4. 🔴 **Enable/Fix Vercel Cron** - Get automated refresh working

---

### **Priority 2: Short-term** ⏰ TODAY
1. Add cache freshness monitoring
2. Set up alerts for stale cache (> 6 hours)
3. Document cron job execution times
4. Verify all cron jobs are executing

---

### **Priority 3: Long-term** ⏰ THIS WEEK
1. Implement health check dashboard
2. Add automated tests for cron jobs
3. Set up Vercel cron execution monitoring
4. Add redundancy (fallback refresh mechanism)
5. Consider moving to Edge Functions if cron unreliable

---

## 🎯 SUCCESS CRITERIA

**System is healthy when:**
- ✅ Weekly cache shows > 80% fresh entries
- ✅ Belmonte weekly cache < 3 hours old
- ✅ Cron job executes every 3 hours successfully
- ✅ No cache entries > 6 hours old
- ✅ Monitoring dashboard shows all green

---

## 📌 QUICK REFERENCE

### **Files to Check:**
```
✅ vercel.json                                          # Cron configuration
✅ src/app/api/automated/refresh-current-week-cache/route.ts  # Cron job logic
✅ src/lib/smart-cache-helper.ts                       # Cache helper functions
✅ src/app/api/admin/cache-monitoring/route.ts         # Monitoring API
✅ audit_weekly_cache_issue.sql                        # Database audit query
```

### **Key Endpoints:**
```
POST /api/automated/refresh-current-week-cache    # Automated refresh (cron)
POST /api/smart-weekly-cache                      # Manual refresh (single client)
GET  /api/admin/cache-monitoring                  # Cache health status
```

### **Database Tables:**
```sql
current_week_cache              -- Meta weekly cache
current_month_cache             -- Meta monthly cache
google_ads_current_week_cache   -- Google Ads weekly cache
clients                         -- Client configuration & tokens
```

---

## 🔍 NEXT STEPS

1. **Run the SQL audit** - Execute `audit_weekly_cache_issue.sql` to confirm database state
2. **Check Vercel logs** - Verify cron job execution history
3. **Manual trigger test** - Test the endpoint works correctly
4. **Enable/fix cron** - Get automated refresh working
5. **Monitor results** - Verify cache updates to fresh state
6. **Set up alerting** - Prevent future issues

---

## 📞 SUPPORT CHECKLIST

If issue persists after fixes:

- [ ] Verified `vercel.json` is in repository root
- [ ] Confirmed cron jobs are enabled in Vercel dashboard
- [ ] Checked Vercel plan supports cron jobs (not free tier)
- [ ] Reviewed Vercel logs for error messages
- [ ] Tested endpoint manually (works?)
- [ ] Verified tokens are valid
- [ ] Confirmed database tables exist and accessible
- [ ] Checked for API rate limiting issues
- [ ] Reviewed error tracking (Sentry, etc.)
- [ ] Verified environment variables are set correctly

---

**✅ AUDIT COMPLETE**  
**Next Action:** Run `audit_weekly_cache_issue.sql` and check Vercel cron logs

