# 🔧 CLEAR WEEKLY CACHE - Instructions

**Issue:** Getting "Failed to fetch (api.supabase.com)" when trying to clear cache

---

## ✅ SOLUTION: Use API Endpoint Instead

I've created a safe API endpoint to clear the corrupted cache.

---

## 🚀 METHOD 1: Clear Current Week Cache (RECOMMENDED)

### Via curl:

```bash
# Clear current week (Week 47) for all clients
curl -X GET "https://piotr-gamma.vercel.app/api/admin/clear-weekly-cache" \
  -H "Authorization: Bearer $CRON_SECRET"

# OR clear specific week
curl -X GET "https://piotr-gamma.vercel.app/api/admin/clear-weekly-cache?week=2025-W47" \
  -H "Authorization: Bearer $CRON_SECRET"

# OR clear specific week for specific client
curl -X GET "https://piotr-gamma.vercel.app/api/admin/clear-weekly-cache?week=2025-W47&clientId=YOUR_CLIENT_ID" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Via Browser (if you're admin):

```
https://piotr-gamma.vercel.app/api/admin/clear-weekly-cache?week=2025-W47
```

You'll need to be logged in as admin for this to work.

---

## 🚀 METHOD 2: Clear All Weekly Cache

```bash
# Clear ALL weekly cache entries (use with caution)
curl -X GET "https://piotr-gamma.vercel.app/api/admin/clear-weekly-cache?all=true" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 🚀 METHOD 3: Via Supabase Dashboard (If You Have Access)

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT
2. Navigate to: **Table Editor** → **current_week_cache**
3. Find rows where `period_id = '2025-W47'`
4. Click the row → **Delete** button
5. Confirm deletion

---

## 🚀 METHOD 4: Programmatic (Via Code)

If you need to clear cache programmatically in your code:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Clear specific week
await supabaseAdmin
  .from('current_week_cache')
  .delete()
  .eq('period_id', '2025-W47');

// Clear all weeks
await supabaseAdmin
  .from('current_week_cache')
  .delete()
  .neq('id', '00000000-0000-0000-0000-000000000000');
```

---

## 📋 WHAT WAS CREATED

**New File:** `src/app/api/admin/clear-weekly-cache/route.ts`

This endpoint:
- ✅ Uses admin credentials (bypasses RLS)
- ✅ Supports clearing specific week or all weeks
- ✅ Supports filtering by client ID
- ✅ Secure (requires CRON_SECRET)
- ✅ Logged for audit trail

---

## 🔍 CHECK IF CACHE IS CLEARED

### Via API:

```bash
# Check what's in the cache
curl "https://piotr-gamma.vercel.app/api/admin/clear-weekly-cache?week=2025-W47" \
  -H "Authorization: Bearer $CRON_SECRET"

# Response should say:
# {"success": true, "message": "Cleared cache for week 2025-W47"}
```

### Via Supabase (if you want to verify):

```sql
-- Check what's left in cache
SELECT 
  period_id,
  client_id,
  last_updated,
  cache_data->>'total_spend' as spend
FROM current_week_cache
WHERE period_id LIKE '2025-W%'
ORDER BY last_updated DESC;

-- Should return empty or no rows for Week 47 after clearing
```

---

## ⚠️ WHY DIRECT SQL FAILED

The error "Failed to fetch (api.supabase.com)" likely occurred because:

1. **RLS Policies:** Row Level Security might be enabled on `current_week_cache` table
2. **Permissions:** Your user doesn't have DELETE permissions
3. **Connection:** Network/CORS issue accessing Supabase directly

**Solution:** Use the API endpoint which uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.

---

## 🚀 QUICK START

### Step 1: Deploy the new endpoint

```bash
cd /Users/macbook/piotr
git add src/app/api/admin/clear-weekly-cache/route.ts
git commit -m "Add: Admin endpoint to clear weekly cache"
git push origin main
# Wait 2-3 minutes for Vercel deployment
```

### Step 2: Clear the corrupted cache

```bash
# Get your CRON_SECRET
echo $CRON_SECRET  # or check your .env file

# Clear Week 47 cache
curl -X GET "https://piotr-gamma.vercel.app/api/admin/clear-weekly-cache?week=2025-W47" \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
```

### Step 3: Verify it's cleared

Refresh your reports page and check Week 47. It should now fetch fresh data.

---

## ✅ EXPECTED RESULTS

After clearing cache:

1. **Week 47** next request will:
   - Not find cache
   - Fetch fresh weekly data from API
   - Show ~3,000-4,000 zł (correct weekly amount)
   - Store fresh data in cache

2. **Cache will be rebuilt** with correct data

3. **Future requests** will use the new correct cache

---

## 📊 ALTERNATIVE: Wait for Cache to Expire

If you don't want to clear manually, the cache expires after 3 hours. So:

- **Current time:** Now
- **Cache expires:** 3 hours from when it was last updated
- **Next fresh fetch:** Will happen automatically

But clearing is faster and guarantees immediate fix.

---

## 🆘 IF ENDPOINT DOESN'T WORK

### Check 1: Is endpoint deployed?

```bash
curl -X GET "https://piotr-gamma.vercel.app/api/admin/clear-weekly-cache" \
  -H "Authorization: Bearer $CRON_SECRET"

# Should return JSON, not 404
```

### Check 2: Is CRON_SECRET correct?

```bash
# Check your secret
echo $CRON_SECRET

# Or check Vercel dashboard:
# https://vercel.com/your-team/piotr/settings/environment-variables
```

### Check 3: Manual deletion via Supabase Dashboard

If API still doesn't work, use Supabase Dashboard (Method 3 above).

---

## 📝 SUMMARY

**Problem:** Can't delete from Supabase directly  
**Solution:** Use new API endpoint `/api/admin/clear-weekly-cache`  
**Steps:** Deploy → Call endpoint → Cache cleared ✅

**Next:** After cache is cleared, the bug fix we deployed will ensure correct weekly data is fetched!

---

**Status:** 🔧 FIX READY  
**Time to Clear:** 2 minutes (after deployment)  
**Impact:** Immediate - next request fetches fresh data

