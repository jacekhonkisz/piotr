# 🚀 Deploy Unified Cache Refresh System

**Date:** November 13, 2025  
**Fix:** Consolidate 4 separate cache refresh cron jobs into 1 unified job  
**Impact:** Fixes stale weekly cache (21h old) and Google Ads caches (54h old)

---

## 📋 What Changed

### ✅ Created New Unified Endpoint
**File:** `src/app/api/automated/refresh-all-caches/route.ts`

**What it does:**
- Refreshes all 4 cache types in one execution
- Meta Monthly, Meta Weekly, Google Ads Monthly, Google Ads Weekly
- Sequential execution with 5-second delays between each
- Comprehensive error handling and logging

### ✅ Updated Vercel Cron Configuration
**File:** `vercel.json`

**Old:** 4 separate cron jobs at different times
```json
"schedule": "5 */3 * * *"   // Meta Monthly
"schedule": "10 */3 * * *"  // Meta Weekly
"schedule": "15 */3 * * *"  // Google Ads Monthly
"schedule": "20 */3 * * *"  // Google Ads Weekly
```

**New:** 1 unified cron job
```json
"schedule": "0 */3 * * *"   // All caches together
```

---

## 🎯 Benefits

### Reliability
- ✅ Single cron execution is more reliable than multiple
- ✅ Guaranteed all caches refresh together
- ✅ Easier to monitor (one job vs four)
- ✅ No timing conflicts or race conditions

### Maintainability
- ✅ One endpoint to debug instead of four
- ✅ Centralized logging and error handling
- ✅ Easier to add new cache types in future

### Cost
- ✅ Fewer cron executions (1 vs 4 every 3 hours)
- ✅ Still within Pro plan limits easily

---

## 🚀 Deployment Steps

### Step 1: Commit Changes
```bash
cd /Users/macbook/piotr

# Check what changed
git status

# Add the new files
git add src/app/api/automated/refresh-all-caches/route.ts
git add vercel.json

# Commit
git commit -m "feat: consolidate cache refresh into unified cron job

- Create unified refresh-all-caches endpoint
- Update vercel.json to use single cron (every 3h)
- Fixes: Meta Weekly (21h stale) and Google Ads caches (54h stale)
- Improves reliability and maintainability"
```

### Step 2: Push to Deploy
```bash
git push origin main
```

**Vercel will automatically:**
- ✅ Deploy the new endpoint
- ✅ Update cron configuration
- ✅ Start running unified cron every 3 hours

---

## ⚡ Immediate Manual Refresh (Before Deployment)

While waiting for deployment, manually refresh the stale caches:

```bash
# Replace YOUR_DOMAIN with your actual Vercel domain

# Option A: Use new unified endpoint (if already deployed)
curl -X POST https://YOUR_DOMAIN/api/automated/refresh-all-caches

# Option B: Use individual endpoints (current setup)
curl -X POST https://YOUR_DOMAIN/api/automated/refresh-current-week-cache
curl -X POST https://YOUR_DOMAIN/api/automated/refresh-google-ads-current-month-cache
curl -X POST https://YOUR_DOMAIN/api/automated/refresh-google-ads-current-week-cache
```

---

## 🔍 Verification Steps

### Step 1: Check Deployment
```
1. Go to: https://vercel.com/dashboard
2. Select your project
3. Check: Latest deployment status
4. Verify: No build errors
5. Check: Cron jobs tab shows new unified cron
```

### Step 2: Test Unified Endpoint
```bash
# Test the new endpoint manually
curl -X POST https://YOUR_DOMAIN/api/automated/refresh-all-caches
```

**Expected Response:**
```json
{
  "success": true,
  "message": "All cache refresh operations completed",
  "summary": {
    "totalCacheTypes": 4,
    "successful": 4,
    "failed": 0,
    "totalTime": 25000
  },
  "details": {
    "metaMonthly": { "status": "success" },
    "metaWeekly": { "status": "success" },
    "googleAdsMonthly": { "status": "success" },
    "googleAdsWeekly": { "status": "success" }
  }
}
```

### Step 3: Check Cache Monitoring Dashboard
```
1. Go to: YOUR_DOMAIN/admin/monitoring
2. Wait 30 seconds for data to load
3. Check all 4 cache types:
   - Meta Monthly: Should show ✅ Healthy, high % fresh
   - Meta Weekly: Should show ✅ Healthy, high % fresh  
   - Google Ads Monthly: Should show ✅ Healthy, high % fresh
   - Google Ads Weekly: Should show ✅ Healthy, high % fresh
```

### Step 4: Verify Cron Execution (After 3 Hours)
```
1. Wait until next scheduled run (00:00, 03:00, 06:00, etc.)
2. Go to: Vercel Dashboard → Logs
3. Search for: "refresh-all-caches"
4. Should see: Execution logs every 3 hours
5. Check: All 4 cache types refreshed successfully
```

---

## 📊 Expected Results

### Before Deployment:
```
Meta Monthly:      1.9h old  ✅ Fresh (working)
Meta Weekly:       21.3h old ❌ Stale (NOT working)
Google Ads Monthly: 54.2h old ❌ Very Stale (NOT working)
Google Ads Weekly:  54.1h old ❌ Very Stale (NOT working)
```

### After Deployment + First Run:
```
Meta Monthly:      < 30 min old ✅ Fresh
Meta Weekly:       < 30 min old ✅ Fresh
Google Ads Monthly: < 30 min old ✅ Fresh
Google Ads Weekly:  < 30 min old ✅ Fresh
```

### After 24 Hours (Steady State):
```
All caches:        < 3 hours old ✅ All Fresh
Fresh percentage:  > 90% ✅ Healthy
Health status:     ✅ Healthy (all 4 caches)
```

---

## 🎯 Success Criteria

**Deploy is successful when:**
- ✅ All 4 cache types show < 3 hours old
- ✅ Belmonte weekly cache is fresh (< 3 hours)
- ✅ Cache monitoring shows > 80% fresh entries
- ✅ Vercel logs show unified cron executing every 3 hours
- ✅ No errors in application logs

---

## 🔧 Rollback Plan (If Needed)

If something goes wrong, you can quickly rollback:

### Option 1: Revert Git Commit
```bash
git revert HEAD
git push origin main
```

### Option 2: Manual Individual Refreshes
```bash
# The individual endpoints still exist, just not in cron
# You can call them manually if needed
curl -X POST https://YOUR_DOMAIN/api/automated/refresh-current-month-cache
curl -X POST https://YOUR_DOMAIN/api/automated/refresh-current-week-cache
curl -X POST https://YOUR_DOMAIN/api/automated/refresh-google-ads-current-month-cache
curl -X POST https://YOUR_DOMAIN/api/automated/refresh-google-ads-current-week-cache
```

---

## 📝 What Happens to Old Endpoints?

**Individual cache refresh endpoints are NOT deleted:**
- `/api/automated/refresh-current-month-cache` ✅ Still exists
- `/api/automated/refresh-current-week-cache` ✅ Still exists
- `/api/automated/refresh-google-ads-current-month-cache` ✅ Still exists
- `/api/automated/refresh-google-ads-current-week-cache` ✅ Still exists

**They're just not in the cron schedule anymore.**

**You can still:**
- Call them manually for testing
- Use them for debugging specific cache issues
- Fall back to them if unified endpoint has issues

---

## 📊 Monitoring After Deployment

### First 24 Hours - Watch Closely
- Check cache monitoring every 3 hours
- Verify each cron execution in Vercel logs
- Monitor for any error notifications
- Confirm all 4 caches stay fresh

### After 24 Hours - Routine Monitoring
- Daily check of cache health status
- Weekly review of cron execution logs
- Set up alerts for cache > 6 hours old (future enhancement)

---

## 🎉 Expected Timeline

```
T+0:     Deploy changes to Vercel (5 min)
T+5:     Test unified endpoint manually (2 min)
T+7:     Verify cache monitoring shows fresh data (2 min)
T+3h:    First automated cron execution
T+6h:    Verify second cron execution
T+24h:   Confirm system stable and all caches healthy
```

---

## 🚨 Troubleshooting

### If unified endpoint fails:
1. Check Vercel function logs for errors
2. Verify all 4 individual endpoints work manually
3. Check API rate limits (Meta/Google Ads)
4. Verify tokens are valid

### If cron doesn't execute:
1. Check Vercel cron jobs dashboard
2. Verify vercel.json syntax is correct
3. Confirm cron is enabled in Vercel settings
4. Check Vercel plan supports crons

### If some caches refresh but not others:
1. Check individual endpoint errors in logs
2. Verify specific API credentials (Meta vs Google)
3. Test failing endpoint manually
4. Check rate limits for specific platform

---

## 📞 Support

**Files to check if issues arise:**
- `src/app/api/automated/refresh-all-caches/route.ts` - Unified endpoint
- `vercel.json` - Cron configuration
- Vercel Dashboard → Logs - Execution history
- `/admin/monitoring` - Cache health status

**Key metrics to monitor:**
- Cache age < 3 hours ✅
- Fresh percentage > 80% ✅
- Cron executions every 3 hours ✅
- No errors in logs ✅

---

**Ready to deploy! 🚀**

Run the commands in Step 1 and Step 2, then verify using Step 3.

