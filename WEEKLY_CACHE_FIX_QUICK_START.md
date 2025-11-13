# 🚨 WEEKLY CACHE FIX - QUICK START GUIDE

**Issue:** Weekly cache showing 0% fresh entries (all stale for 19+ hours)  
**Impact:** Belmonte and all clients showing outdated weekly data  
**Root Cause:** Vercel cron job not executing (most likely)

---

## ⚡ IMMEDIATE ACTIONS (5 minutes)

### 1. Check Vercel Cron Status
```
1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to: Logs tab
4. Search for: "refresh-current-week-cache"
5. Check if any logs appear at :10 of every 3rd hour
```

**Expected:** You should see logs every 3 hours (01:10, 04:10, 07:10, 10:10, 13:10, etc.)  
**If missing:** Cron is NOT executing ❌

---

### 2. Verify Cron is Enabled
```
1. Go to: Vercel Dashboard → Your Project
2. Click: Settings
3. Find: Cron Jobs section
4. Verify: All crons are ENABLED (not paused)
```

**If disabled:** Click "Enable" to activate  
**If enabled:** Proceed to step 3

---

### 3. Manual Cache Refresh (Immediate Fix)
```bash
# Replace YOUR_DOMAIN with your actual domain
curl -X POST https://YOUR_DOMAIN/api/automated/refresh-current-week-cache
```

**This will:**
- ✅ Update all stale weekly cache entries immediately
- ✅ Get Belmonte back to fresh state
- ✅ Provide relief while fixing cron issue

**Expected result:**
```json
{
  "success": true,
  "summary": {
    "totalClients": 13,
    "successCount": 12,
    "errorCount": 0,
    "skippedCount": 1
  }
}
```

---

### 4. Verify Fix
```
1. Go to: /admin/monitoring
2. Check: Meta Weekly Cache
3. Should now show: Fresh entries > 80%
4. Check: Last update should be "just now"
```

---

## 🔍 DIAGNOSTIC TOOLS PROVIDED

### Tool 1: Database Audit SQL
**File:** `audit_weekly_cache_issue.sql`  
**Purpose:** Check actual database state, Belmonte status, cache ages

**Run with:**
```bash
psql YOUR_DATABASE_URL < audit_weekly_cache_issue.sql
```

**Reveals:**
- Actual cache timestamps
- Belmonte's weekly cache status
- Current week calculation
- Token health
- Comparison with monthly cache

---

### Tool 2: Endpoint Test Script
**File:** `test_weekly_cache_endpoint.sh`  
**Purpose:** Test if the cache refresh endpoint works

**Run with:**
```bash
./test_weekly_cache_endpoint.sh YOUR_DOMAIN.vercel.app
```

**Tests:**
- ✅ Endpoint accessibility
- ✅ POST request handling
- ✅ Response validation
- ✅ Success/error detection

---

## 📋 TROUBLESHOOTING CHECKLIST

### If Cron Logs Are Missing:
- [ ] Check if `vercel.json` is in project root
- [ ] Verify `vercel.json` has correct syntax
- [ ] Confirm Vercel plan supports cron jobs (Pro/Enterprise)
- [ ] Check if crons are enabled in project settings
- [ ] Redeploy project to ensure `vercel.json` is picked up

---

### If Endpoint Returns Errors:
- [ ] Check application logs for error details
- [ ] Verify database connection is working
- [ ] Confirm API tokens are valid (`SELECT * FROM clients WHERE name ILIKE '%belmonte%'`)
- [ ] Check if Meta API is accessible
- [ ] Verify environment variables are set

---

### If Cache Still Shows Stale After Manual Refresh:
- [ ] Run `audit_weekly_cache_issue.sql` to check actual database state
- [ ] Verify period_id is correct (should match current week)
- [ ] Check if monitoring dashboard is reading correct table
- [ ] Clear browser cache and refresh monitoring page
- [ ] Check if there are multiple period_id entries (old weeks)

---

## 🎯 SUCCESS CRITERIA

**System is fixed when:**
1. ✅ Vercel logs show cron executions every 3 hours
2. ✅ Weekly cache shows > 80% fresh entries
3. ✅ Belmonte weekly cache < 3 hours old
4. ✅ Monitoring dashboard shows "Healthy" status
5. ✅ No cache entries > 6 hours old

---

## 📊 WHAT'S WORKING vs WHAT'S NOT

### ✅ WORKING (No Changes Needed)
- Monthly cache refresh (20% fresh, recently updated)
- Cache code implementation (correct)
- Background refresh logic (enabled)
- Cache freshness threshold (3 hours)
- Endpoint implementation (correct)

### ❌ NOT WORKING (Needs Fix)
- Weekly cron job execution (not triggering)
- Automated weekly cache updates (19+ hours stale)
- All weekly cache entries are stale

---

## 🔧 PERMANENT FIX STEPS

### Step 1: Enable/Fix Vercel Cron
```
1. Vercel Dashboard → Settings → Cron Jobs
2. Ensure all crons are ENABLED
3. If issues persist, contact Vercel support
```

---

### Step 2: Add Monitoring & Alerts
```typescript
// Future: Add health check endpoint
// /api/health/cache-freshness
// Returns 500 if any cache is > 6 hours stale

// Set up alerts:
// - Email if weekly cache > 6 hours
// - Slack notification on cron failure
// - Daily cache health summary
```

---

### Step 3: Verify Deployment
```bash
# Ensure vercel.json is deployed
git add vercel.json
git commit -m "Ensure cron config is deployed"
git push

# Check deployment includes vercel.json
# Vercel Dashboard → Deployments → Latest → Source
```

---

## 📞 NEED HELP?

### Quick Checks:
1. **Logs show cron running?** → Check endpoint errors
2. **Logs show no cron?** → Enable cron in Vercel settings
3. **Manual refresh works?** → Cron execution issue
4. **Manual refresh fails?** → Code/config issue

### Files to Review:
- `WEEKLY_CACHE_AUDIT_REPORT.md` - Full diagnostic report
- `audit_weekly_cache_issue.sql` - Database audit queries
- `test_weekly_cache_endpoint.sh` - Endpoint test script

### Support Contacts:
- Vercel Support (for cron issues)
- Check #engineering for similar issues
- Review Vercel Status page (status.vercel.com)

---

## 🎉 EXPECTED OUTCOME

**After fix:**
```
Meta Weekly Cache Status:
  Total Entries: 13
  Fresh: 12 (92%) ✅
  Stale: 1 (8%)
  Last Update: < 3 hours ago
  Health Status: ✅ Healthy
```

**Belmonte Status:**
```
Client: Belmonte Hotel
Cache Age: 45 minutes ✅
Status: Fresh
Period: 2025-W46 (current week)
Data: Up to date
```

---

**🚀 START HERE:**
1. Check Vercel cron logs (1 min)
2. Run manual refresh if needed (1 min)
3. Verify fix in monitoring dashboard (1 min)
4. Enable cron if disabled (2 min)

**Total time to fix: ~5 minutes**

