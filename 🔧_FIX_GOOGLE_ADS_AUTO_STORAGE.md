# 🔧 Fix Google Ads Auto-Storage Issue

**Client:** Havet Hotel  
**Status:** ✅ `api_status` is valid  
**Issue:** Data fetching works but not storing automatically  
**Cron Job:** Configured (runs every 2 hours)

---

## 🎯 **NEXT STEPS**

### **Step 1: Check Current Cache Status**

Run `CHECK_CACHE_UPDATE_STATUS.sql` to see:
- When was cache last updated?
- Does cache exist for current month?
- Does cache have data or zeros?
- How stale is the cache?

**This will tell us if:**
- ❌ Cache doesn't exist → Cron job not creating entries
- ⚠️ Cache is stale (>6 hours) → Cron job not running or failing
- ⚠️ Cache has zeros → Fetching failing silently

---

### **Step 2: Manually Test the Refresh**

Test if the refresh endpoint works manually:

**Option A: Using curl (if you have access):**
```bash
curl -X POST https://your-domain.com/api/automated/refresh-all-caches \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Option B: Using the admin endpoint (no auth needed):**
```bash
curl -X POST https://your-domain.com/api/admin/cache-monitoring/refresh-all \
  -H "Content-Type: application/json"
```

**Option C: Check Vercel Cron Logs:**
1. Go to Vercel Dashboard
2. Your Project → Cron Jobs
3. Find `/api/automated/refresh-all-caches`
4. Check recent executions
5. Look for:
   - ✅ Did it run?
   - ✅ Did it process Google Ads?
   - ✅ Did it include Havet?
   - ❌ Any errors?

---

### **Step 3: Check What the Code Does**

Looking at `refresh-all-caches/route.ts`, here's what happens for Google Ads:

```typescript
// Line 227-259: Google Ads Monthly Cache Refresh
for (const client of clients) {
  // 1. Check if client has google_ads_customer_id
  if (!client.google_ads_customer_id) {
    googleMonthlySkipped++;
    continue;  // ← Skips if missing
  }
  
  // 2. Check if we have refresh token (client OR manager)
  const hasRefreshToken = hasManagerToken || !!client.google_ads_refresh_token;
  if (!hasRefreshToken) {
    logger.info(`⏭️ Skipping ${client.name} - no Google Ads refresh token available`);
    googleMonthlySkipped++;
    continue;  // ← Skips if no token
  }
  
  // 3. Try to refresh cache
  try {
    const result = await getGoogleAdsSmartCacheData(client.id, true);
    if (result.success) {
      googleMonthlySuccess++;
      logger.info(`✅ Google Ads monthly cache refreshed for ${client.name}`);
    } else {
      googleMonthlySkipped++;
      logger.warn(`⚠️ Google Ads monthly cache returned success=false for ${client.name}`);
    }
  } catch (e) {
    googleMonthlyError++;
    logger.error(`❌ Google monthly error for ${client.name}:`, e);
  }
}
```

**What could go wrong:**
1. ❌ Missing `google_ads_customer_id` (but you have it)
2. ❌ No refresh token (but you said it exists)
3. ⚠️ `getGoogleAdsSmartCacheData()` returns `success: false`
4. ⚠️ Exception thrown during refresh
5. ⚠️ Storage fails silently

---

### **Step 4: Check Refresh Token**

Even though you said the token exists, let's verify:

```sql
SELECT 
  id,
  name,
  google_ads_customer_id,
  CASE 
    WHEN google_ads_refresh_token IS NOT NULL THEN '✅ Has token'
    ELSE '❌ No token'
  END as token_status,
  LENGTH(google_ads_refresh_token) as token_length
FROM clients
WHERE id = '93d46876-addc-4b99-b1e1-437428dd54f1';
```

**Also check for manager token:**
```sql
SELECT 
  key,
  CASE 
    WHEN value IS NOT NULL THEN '✅ Manager token exists'
    ELSE '❌ No manager token'
  END as status
FROM system_settings
WHERE key = 'google_ads_manager_refresh_token';
```

The code checks for EITHER client token OR manager token, so one must exist.

---

### **Step 5: Check Logs for Errors**

The cron job logs should show:
- Which clients were processed
- Which were skipped and why
- Any errors that occurred

**Look for these log messages:**
- `🔄 Refreshing Google Ads monthly cache for Havet...`
- `✅ Google Ads monthly cache refreshed for Havet`
- `⚠️ Google Ads monthly cache returned success=false for Havet`
- `❌ Google monthly error for Havet:`
- `⏭️ Skipping Havet - no Google Ads refresh token available`

---

## 🔍 **MOST LIKELY ISSUES**

### **Issue 1: Refresh Token Not Actually in Database** ⚠️

**Check:**
```sql
SELECT google_ads_refresh_token IS NOT NULL as has_token
FROM clients
WHERE id = '93d46876-addc-4b99-b1e1-437428dd54f1';
```

**If false:** Token needs to be added to database

---

### **Issue 2: `getGoogleAdsSmartCacheData()` Failing Silently** ⚠️

**The function might:**
- Return `success: false` without error
- Throw an exception that's caught
- Fail to store in cache table

**Check:** Look for errors in cron logs

---

### **Issue 3: Cache Table Write Failing** ⚠️

**Possible causes:**
- RLS policy blocking writes
- Database connection issue
- Table permissions issue

**Check:** Try manually inserting into cache table

---

### **Issue 4: Cron Job Not Actually Running** ⚠️

**Check:**
- Vercel cron job execution history
- Are there any errors in Vercel logs?
- Is the cron job enabled?

---

## 🛠️ **IMMEDIATE ACTIONS**

1. **Run `CHECK_CACHE_UPDATE_STATUS.sql`** ← Do this first!
   - This will show us the current state
   - Will tell us if cache exists, when it was updated, etc.

2. **Check Vercel Cron Logs**
   - See if the job is running
   - See if it's processing Havet
   - See if there are errors

3. **Manually Trigger Refresh**
   - Test if the endpoint works
   - See the response
   - Check if cache updates

4. **Verify Refresh Token in Database**
   - Make sure it's actually stored
   - Check if it's valid

---

## 📊 **EXPECTED RESULTS**

**If everything is working:**
- Cache entry exists for current month
- `last_updated` is within last 2-3 hours
- `cache_data` contains real data (not zeros)
- Cron logs show successful refresh for Havet

**If not working:**
- Cache doesn't exist OR
- Cache is stale (>6 hours) OR
- Cache has zeros OR
- Cron logs show errors/skips

---

## 🎯 **SHARE RESULTS**

After running the diagnostic SQL, please share:

1. **Cache status:**
   - Does cache exist?
   - When was it last updated?
   - Does it have data or zeros?

2. **Cron job logs:**
   - Is the job running?
   - Does it process Havet?
   - Any errors?

3. **Refresh token:**
   - Is it in the database?
   - Is it valid?

This will help us pinpoint the exact issue!

