# 🔍 CHECK IF DATA IS REAL - Step by Step Guide

**IMPORTANT:** The fix is in the code, but you need to **clear the cache** first to force it to fetch fresh data with the new logic!

---

## Step 1: Clear Current Cache (Required!)

The old cache still has distributed data. Clear it:

```sql
-- Clear Belmonte's current month cache
DELETE FROM current_month_cache 
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- Verify it's deleted
SELECT COUNT(*) FROM current_month_cache 
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
-- Should return 0
```

---

## Step 2: Trigger Fresh Fetch

**Option A: Via Dashboard (Easiest)**
1. Log in as Belmonte user
2. Navigate to Dashboard or Reports page
3. Wait 10-15 seconds for data to load
4. System will automatically fetch and cache fresh data with the NEW CODE

**Option B: Via API (If you have access)**
```bash
# Call the smart cache API endpoint
curl -X POST https://your-domain.com/api/smart-cache \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"clientId": "BELMONTE_CLIENT_ID", "forceRefresh": true}'
```

---

## Step 3: Run Verification Queries

After clearing cache and loading dashboard, run:

```bash
# Connect to your database
psql YOUR_DATABASE_URL

# Run the verification script
\i scripts/verify-real-campaign-data.sql
```

Or copy/paste from: `scripts/verify-real-campaign-data.sql`

---

## Step 4: Interpret Results

### ✅ SUCCESS Indicators:

**Test 1: Variance Test**
```
unique_step1_values: 15 (or any number > 1)  ✅
stddev_step1: 45.23 (or any number > 0)      ✅
verdict: "✅ HAS VARIANCE (real per-campaign data - GOOD)"
```

**Test 2: Sample Campaigns**
```
campaign_name          | spend   | step1 | step2 | reservations
-----------------------|---------|-------|-------|-------------
Campaign A             | 1234.56 | 145   | 67    | 23          ✅
Campaign B             | 567.89  | 67    | 34    | 12          ✅
Campaign C             | 890.12  | 203   | 89    | 34          ✅
Campaign D             | 234.56  | 12    | 5     | 2           ✅
Campaign E             | 456.78  | 89    | 45    | 15          ✅

← Each campaign has DIFFERENT values ✅
```

**Test 3: Distribution Check**
```
step1  | count | verdict
-------|-------|------------------------------------------
145    | 1     | ✅ Natural distribution (real data - GOOD)
67     | 1     | ✅ Natural distribution (real data - GOOD)
203    | 1     | ✅ Natural distribution (real data - GOOD)
...

← Many different values, each appearing 1-2 times ✅
```

### ❌ FAILURE Indicators:

**Test 1: Variance Test**
```
unique_step1_values: 1                                      ❌
stddev_step1: 0 or NULL                                     ❌
verdict: "❌ ALL IDENTICAL (distributed averages - BAD)"    ❌
```

**Test 2: Sample Campaigns**
```
campaign_name          | spend   | step1 | step2 | reservations
-----------------------|---------|-------|-------|-------------
Campaign A             | 217.39  | 20    | 10    | 5           ❌
Campaign B             | 217.39  | 20    | 10    | 5           ❌
Campaign C             | 217.39  | 20    | 10    | 5           ❌
Campaign D             | 217.39  | 20    | 10    | 5           ❌
Campaign E             | 217.39  | 20    | 10    | 5           ❌

← All campaigns have IDENTICAL values ❌
```

**Test 3: Distribution Check**
```
step1  | count | verdict
-------|-------|------------------------------------------
20.00  | 25    | ❌ ALL CAMPAIGNS HAVE SAME VALUE (distributed - BAD)

← Single value appearing 25 times (all campaigns identical) ❌
```

---

## Quick Check (Without SQL)

### Check Browser Console:

1. Open Dashboard with DevTools open (F12)
2. Look for these logs in console:

**✅ GOOD Logs:**
```
✅ Using 25 REAL campaigns with parsed conversion data
🔍 Sample parsed campaign: {
  campaign_name: "Actual Campaign Name",
  booking_step_1: 145,  ← NOT 20.00!
  booking_step_2: 67,
  reservations: 23
}
✅ Using REAL per-campaign data (NOT distributed averages)
🔍 Sample campaign verification: {
  is_distributed: "✅ NO (GOOD)"  ← Should say NO!
}
```

**❌ BAD Logs:**
```
✅ Using 25 real campaigns from Meta API
✅ Mapped real campaigns with aggregated metrics  ← "Mapped" = distributed
🔍 Sample campaign verification: {
  booking_step_1: 20,  ← Exactly 20!
  is_distributed: "❌ YES (BAD)"  ← Says YES = bad!
}
```

---

## If Data is Still Wrong:

### Possible Issues:

1. **Cache not cleared properly**
   - Solution: Run DELETE query again, verify COUNT = 0

2. **Old code still running**
   - Solution: Verify deployment, check BUILD_ID matches

3. **Dashboard didn't trigger fetch**
   - Solution: Hard refresh (Ctrl+Shift+R), clear browser cache

4. **Meta API returned no data**
   - Solution: Check logs for API errors, verify token

---

## Current Data Status Check

To check what's in cache RIGHT NOW (without clearing):

```sql
-- Quick check of current cache
SELECT 
  period_id,
  last_updated,
  AGE(NOW(), last_updated) as cache_age,
  jsonb_array_length(cache_data->'campaigns') as campaign_count,
  (
    SELECT COUNT(DISTINCT (campaign->>'booking_step_1')::numeric)
    FROM jsonb_array_elements(cache_data->'campaigns') as campaign
    WHERE (campaign->>'booking_step_1')::numeric > 0
  ) as unique_step1_values,
  CASE 
    WHEN (
      SELECT COUNT(DISTINCT (campaign->>'booking_step_1')::numeric)
      FROM jsonb_array_elements(cache_data->'campaigns') as campaign
      WHERE (campaign->>'booking_step_1')::numeric > 0
    ) = 1
    THEN '❌ OLD CACHE (distributed data)'
    WHEN (
      SELECT COUNT(DISTINCT (campaign->>'booking_step_1')::numeric)
      FROM jsonb_array_elements(cache_data->'campaigns') as campaign
      WHERE (campaign->>'booking_step_1')::numeric > 0
    ) > 1
    THEN '✅ NEW CACHE (real data)'
    ELSE 'ℹ️  No data or all zeros'
  END as cache_status
FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
```

**If this shows:**
- `unique_step1_values: 1` → Still OLD cache with distributed data ❌
- `cache_status: "❌ OLD CACHE"` → Need to clear and refetch
- `cache_age: "2 days"` → Stale, needs refresh

**Then:**
1. Delete cache (Step 1)
2. Load dashboard (Step 2)
3. Check again

---

## Summary Checklist

- [ ] Cleared cache (DELETE query run, verified COUNT = 0)
- [ ] Loaded dashboard (waited for data to load)
- [ ] Ran verification queries
- [ ] Checked variance test (unique_step1_values > 1?)
- [ ] Checked sample campaigns (different values?)
- [ ] Checked distribution (natural spread?)
- [ ] Checked browser console logs
- [ ] Verified "is_distributed: NO"

If all checks pass → ✅ **FIX IS WORKING!**

If any fail → Report which test failed for troubleshooting

---

**Next Step:** Run Step 1 (clear cache) then Step 3 (verification queries)

