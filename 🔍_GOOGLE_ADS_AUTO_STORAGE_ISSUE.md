# 🔍 Google Ads Auto-Storage Issue - Diagnosis

**Date:** January 2, 2026  
**Client:** Havet Hotel  
**Issue:** Google Ads data fetching works, but not storing automatically  
**Status:** 🔴 **INVESTIGATING**

---

## 🎯 **THE PROBLEM**

**What you said:**
- ✅ Refresh token exists
- ✅ Fetching works (manual fetch succeeds)
- ❌ System is not storing data automatically

**This means:**
- Authentication is working
- API calls are successful
- But automatic cache refresh jobs are not storing data

---

## 🔍 **ROOT CAUSE ANALYSIS**

### **Most Likely Causes:**

#### **1. Client `api_status` Not Set to 'valid'** ⚠️ **MOST LIKELY**

**The Problem:**
The unified cache refresh job (`/api/automated/refresh-all-caches`) only processes clients with:

```typescript
.eq('api_status', 'valid')
```

**If Havet's `api_status` is NOT 'valid', the cron job will skip it entirely.**

**Check:**
```sql
SELECT id, name, api_status, google_ads_customer_id
FROM clients
WHERE name ILIKE '%havet%';
```

**Fix:**
```sql
UPDATE clients 
SET api_status = 'valid'
WHERE name ILIKE '%havet%';
```

---

#### **2. Cron Job Not Running** ⚠️ **POSSIBLE**

**The Problem:**
The cron job might not be configured or running.

**Check:**
- Is `/api/automated/refresh-all-caches` in your `vercel.json`?
- Is it scheduled correctly?
- Are there any errors in Vercel cron logs?

**Current Schedule (from vercel.json):**
```json
{
  "path": "/api/automated/refresh-all-caches",
  "schedule": "0 */2 * * *"  // Every 2 hours
}
```

**Verify:**
1. Check Vercel dashboard → Cron Jobs
2. Look for recent executions
3. Check for errors

---

#### **3. Cron Job Running But Skipping Havet** ⚠️ **POSSIBLE**

**The Problem:**
The cron job runs but skips Havet due to:
- Missing `google_ads_customer_id`
- Missing refresh token (but you said it exists)
- Error during processing (silently caught)

**Check the code logic:**
```typescript
// From refresh-all-caches/route.ts line 227-240
for (const client of clients) {
  if (!client.google_ads_customer_id) {
    googleMonthlySkipped++;
    continue;  // ← Skips if no customer_id
  }
  
  const hasRefreshToken = hasManagerToken || !!client.google_ads_refresh_token;
  if (!hasRefreshToken) {
    logger.info(`⏭️ Skipping ${client.name} - no Google Ads refresh token available`);
    googleMonthlySkipped++;
    continue;  // ← Skips if no token
  }
  
  // ... tries to refresh ...
}
```

**What to check:**
1. Does Havet have `google_ads_customer_id`?
2. Is the refresh token actually in the database?
3. Are there any errors in the logs?

---

#### **4. Storage Logic Error** ⚠️ **LESS LIKELY**

**The Problem:**
The fetch succeeds but storage fails silently.

**Check:**
- Are there any database errors?
- Is the cache table accessible?
- Are there RLS policy issues?

---

## 🛠️ **DIAGNOSTIC STEPS**

### **Step 1: Run Diagnostic SQL**

Run `DIAGNOSE_GOOGLE_ADS_AUTO_STORAGE.sql` to check:
- Client configuration
- Cache status
- Recent updates
- Cron eligibility

---

### **Step 2: Check Client Status**

```sql
SELECT 
  id,
  name,
  api_status,
  google_ads_customer_id,
  CASE WHEN google_ads_refresh_token IS NOT NULL THEN 'YES' ELSE 'NO' END as has_token
FROM clients
WHERE name ILIKE '%havet%';
```

**Expected:**
- `api_status` = `'valid'` ✅
- `google_ads_customer_id` = `'733-667-6488'` ✅
- `has_token` = `'YES'` ✅

---

### **Step 3: Check Cache Table**

```sql
SELECT 
  period_id,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  (cache_data->'stats'->>'totalSpend')::numeric as spend,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 as hours_old
FROM google_ads_current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
ORDER BY last_updated DESC
LIMIT 5;
```

**What to look for:**
- Is there a cache entry for current month?
- When was it last updated?
- Is it older than 6 hours? (cron runs every 2 hours)

---

### **Step 4: Check Cron Job Logs**

**In Vercel Dashboard:**
1. Go to your project
2. Click "Cron Jobs"
3. Find `/api/automated/refresh-all-caches`
4. Check recent executions
5. Look for errors or logs

**What to look for:**
- ✅ Job ran successfully
- ✅ Processed Google Ads clients
- ✅ Havet was included
- ❌ Any errors

---

### **Step 5: Manually Trigger Refresh**

Test if the endpoint works manually:

```bash
curl -X POST http://your-domain.com/api/automated/refresh-all-caches \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Or use the admin endpoint:**
```bash
curl -X POST http://your-domain.com/api/admin/cache-monitoring/refresh-all
```

**Check the response:**
- Does it show Google Ads monthly cache refresh?
- Does it show Havet in the results?
- Any errors?

---

## 🔧 **QUICK FIXES**

### **Fix 1: Set api_status to 'valid'**

```sql
UPDATE clients 
SET api_status = 'valid'
WHERE name ILIKE '%havet%'
  AND api_status != 'valid';
```

**This is the most common issue!**

---

### **Fix 2: Verify Cron Job Configuration**

Check `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/automated/refresh-all-caches",
      "schedule": "0 */2 * * *"  // Every 2 hours
    }
  ]
}
```

**If missing, add it!**

---

### **Fix 3: Check CRON_SECRET**

The cron job requires authentication:

```typescript
if (!verifyCronAuth(request)) {
  return createUnauthorizedResponse();
}
```

**Make sure:**
- `CRON_SECRET` is set in environment variables
- Vercel cron jobs are configured with the secret
- The secret matches

---

## 📊 **EXPECTED BEHAVIOR**

### **When Working Correctly:**

1. **Every 2 hours:**
   - Cron job `/api/automated/refresh-all-caches` runs
   - Finds all clients with `api_status = 'valid'`
   - For each client with Google Ads:
     - Checks for `google_ads_customer_id` ✅
     - Checks for refresh token (client or manager) ✅
     - Calls `getGoogleAdsSmartCacheData()` ✅
     - Stores result in `google_ads_current_month_cache` ✅

2. **Cache Table:**
   - Entry exists for current month
   - `last_updated` is within last 2-3 hours
   - `cache_data` contains real data (not zeros)

3. **Dashboard:**
   - Shows current month data
   - Updates every 2-3 hours
   - No manual refresh needed

---

## 🎯 **MOST LIKELY SOLUTION**

**Based on the code, the #1 issue is `api_status`:**

```typescript
// Line 70 in refresh-all-caches/route.ts
.eq('api_status', 'valid')
```

**If Havet's `api_status` is anything other than `'valid'`, the cron job will skip it entirely.**

**Quick fix:**
```sql
UPDATE clients 
SET api_status = 'valid'
WHERE name ILIKE '%havet%';
```

**Then wait 2 hours and check if cache updates automatically.**

---

## 📋 **CHECKLIST**

Run through this checklist:

- [ ] Run `DIAGNOSE_GOOGLE_ADS_AUTO_STORAGE.sql`
- [ ] Check `api_status` = `'valid'`
- [ ] Check `google_ads_customer_id` exists
- [ ] Check `google_ads_refresh_token` exists
- [ ] Check cron job is configured in `vercel.json`
- [ ] Check cron job is running (Vercel dashboard)
- [ ] Check cron job logs for errors
- [ ] Manually trigger refresh to test
- [ ] Check cache table for recent updates

---

## 🔍 **NEXT STEPS**

1. **Run the diagnostic SQL** (`DIAGNOSE_GOOGLE_ADS_AUTO_STORAGE.sql`)
2. **Share the results** - especially:
   - `api_status` value
   - Cache last_updated timestamp
   - Any errors from cron logs
3. **Apply the fix** based on findings
4. **Verify** cache updates automatically

---

## 💡 **SUMMARY**

**The issue is likely one of these:**

1. **`api_status` not 'valid'** ← Most likely
2. **Cron job not running**
3. **Cron job skipping Havet** (missing customer_id or token)
4. **Storage error** (database/RLS issue)

**Start with checking `api_status` - that's the #1 cause!**

