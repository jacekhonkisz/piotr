# 🔍 DETAILED QUERY TRACE - Why Data Isn't Being Found

**Status:** Platform is correct (1008 meta records exist)  
**Issue:** Query still not finding data

---

## 📊 CURRENT STATUS

✅ **Total records:** 1178  
✅ **NULL platforms:** 0 (no NULL issue)  
✅ **Meta records:** 1008 (sufficient data exists)  
❌ **Query result:** Still returning "no data"

---

## 🎯 NEXT DIAGNOSTIC STEPS

### **Step 1: Check summary_type format**

Run this to see what summary_types exist:

```sql
SELECT 
  summary_type,
  COUNT(*) as count
FROM campaign_summaries
WHERE platform = 'meta'
GROUP BY summary_type;
```

**Expected:**
- `monthly` (not `month` or `MONTHLY`)
- `weekly` (not `week` or `WEEKLY`)

**If different:** Case sensitivity or naming mismatch

---

### **Step 2: Check date format precision**

Run this to see actual dates stored:

```sql
SELECT 
  summary_date,
  TO_CHAR(summary_date, 'YYYY-MM-DD') as formatted_date,
  summary_type,
  client_id,
  total_spend
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly'
ORDER BY summary_date DESC
LIMIT 10;
```

**Critical Check:**
- Are monthly dates EXACTLY the 1st of month? (e.g., `2024-10-01`)
- Any dates like `2024-10-15` or `2024-10-31`?

---

### **Step 3: Test with a SPECIFIC client**

You need to test with the actual client ID being queried. In browser console, when you try to load a past period, look for:

```
📅 Searching for monthly data in campaign_summaries for 2024-10-01
```

And note the `clientId` from earlier log. Then run:

```sql
-- Replace CLIENT_ID_HERE with actual UUID from console
SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  campaign_data IS NOT NULL as has_campaigns
FROM campaign_summaries
WHERE client_id = 'CLIENT_ID_HERE'
  AND platform = 'meta'
  AND summary_type = 'monthly'
ORDER BY summary_date DESC
LIMIT 10;
```

**If 0 results:** This specific client has no data  
**If > 0 results:** Query logic or validation issue

---

### **Step 4: Check the validation logic**

The query might return data but validation rejects it:

```typescript:src/lib/standardized-data-fetcher.ts:266-306
const cachedResult = await this.fetchFromCachedSummaries(clientId, dateRange, platform);
if (cachedResult.success) {
  // ✅ FIXED: Return data if we have ANY metrics
  const hasAnyData = cachedResult.data!.stats && 
    (cachedResult.data!.stats.totalSpend > 0 || 
     cachedResult.data!.stats.totalImpressions > 0 ||
     cachedResult.data!.stats.totalClicks > 0 ||
     cachedResult.data!.stats.totalConversions > 0 ||
     (cachedResult.data!.campaigns && cachedResult.data!.campaigns.length > 0));
  
  if (hasAnyData) {
    return { success: true, data: cachedResult.data! };
  } else {
    console.log('⚠️ campaign_summaries has no metrics data, trying next source...');
  }
}
```

**Issue:** Data is found BUT all metrics are 0, so validation rejects it.

Check if records have actual data:

```sql
SELECT 
  summary_date,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly'
  AND (total_spend = 0 AND total_impressions = 0 AND total_clicks = 0 AND total_conversions = 0)
ORDER BY summary_date DESC
LIMIT 10;
```

**If many records:** Data exists but all values are 0 (validation rejects these)

---

### **Step 5: Check RLS (Row Level Security)**

Server-side queries might be blocked by RLS policies:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'campaign_summaries';

-- Check policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'campaign_summaries';
```

**Critical:** API routes use `SUPABASE_SERVICE_ROLE_KEY` which should bypass RLS. But if the client ID in the query doesn't match the user's permissions, RLS might block it.

---

## 🔍 BROWSER CONSOLE DEBUGGING

When loading a past period, you should see these logs. Copy the EXACT parameters:

```
📡 🔧 STANDARDIZED DATA FETCH (REPORTS): {
  dateRange: { start: '2024-10-01', end: '2024-10-31' },
  clientId: 'xxx-xxx-xxx',
  platform: 'meta',
  forceFresh: false,
  reason: 'period-2024-10-standardized'
}

📊 Loading from campaign_summaries for xxx-xxx-xxx (2024-10-01 to 2024-10-31) - Platform: meta

📅 Searching for monthly data in campaign_summaries for 2024-10-01

⚠️ No monthly summary found for 2024-10-01 (requested period) {
  clientId: 'xxx...',
  platform: 'meta',
  summaryType: 'monthly',
  requestedDate: '2024-10-01'
}
```

Take these EXACT values and run:

```sql
SELECT 
  *
FROM campaign_summaries
WHERE client_id = '[exact clientId from console]'
  AND summary_type = 'monthly'
  AND platform = 'meta'
  AND summary_date = '[exact date from console]'
LIMIT 1;
```

---

## 🚨 COMMON ISSUES

### **Issue #1: Wrong Client ID**

The reports page might be passing a different client ID than what's in the database.

**Check:**
```sql
-- What client IDs actually exist in the data?
SELECT DISTINCT client_id
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly';
```

Then compare with the client ID in browser console logs.

---

### **Issue #2: Date Mismatch**

Monthly data should be stored with summary_date = first day of month.

**Check:**
```sql
-- Are all monthly dates on day 1?
SELECT 
  summary_date,
  EXTRACT(DAY FROM summary_date) as day
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly'
  AND EXTRACT(DAY FROM summary_date) != 1
LIMIT 10;
```

**If any results:** Dates are wrong format

---

### **Issue #3: Zero Data Validation**

Records exist but all metrics are 0:

```sql
SELECT 
  COUNT(*) as zero_data_records
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly'
  AND total_spend = 0
  AND total_impressions = 0
  AND total_clicks = 0;
```

**If > 0:** Data exists but validation logic rejects it because all values are 0

---

### **Issue #4: campaign_data is NULL**

The query might reject records where campaign_data is NULL:

```sql
SELECT 
  COUNT(*) as records_with_null_campaigns
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly'
  AND campaign_data IS NULL;
```

But looking at the code, this shouldn't cause rejection since the validation checks `campaigns.length > 0` with a fallback `|| []`.

---

## 🎯 ACTION PLAN

### **Priority 1: Get browser console logs**

Load a past period and copy ALL console logs. Look for:
1. The exact clientId being queried
2. The exact date being queried  
3. The success/failure message

### **Priority 2: Run SQL with exact parameters**

Use the values from console logs:

```sql
SELECT 
  summary_date,
  total_spend,
  total_impressions,
  total_clicks,
  (campaign_data IS NOT NULL) as has_campaigns,
  JSONB_ARRAY_LENGTH(COALESCE(campaign_data, '[]'::jsonb)) as campaign_count
FROM campaign_summaries
WHERE client_id = '[FROM CONSOLE]'
  AND summary_type = 'monthly'
  AND platform = 'meta'
  AND summary_date = '[FROM CONSOLE]'
LIMIT 1;
```

### **Priority 3: Check data quality**

If SQL returns data:
- Is `total_spend` > 0?
- Is `total_impressions` > 0?
- Does `campaign_data` have actual campaigns?

If all are 0/NULL, the validation logic is working correctly by rejecting it.

---

## 🔧 TEMPORARY FIX

If the issue is validation rejecting records with 0 metrics, you can temporarily disable this check:

```typescript:src/lib/standardized-data-fetcher.ts:266-277
const cachedResult = await this.fetchFromCachedSummaries(clientId, dateRange, platform);
if (cachedResult.success) {
  // TEMPORARY: Accept data even if all metrics are 0
  console.log('✅ Found data in campaign_summaries, returning regardless of metrics');
  return {
    success: true,
    data: cachedResult.data!,
    debug: {
      source: 'campaign-summaries-database',
      cachePolicy: 'database-first-historical-instant',
      periodType: 'historical'
    }
  };
}
```

This will help determine if the issue is validation or the query itself.

---

## 📊 FULL DIAGNOSTIC SCRIPT

Run this complete script in Supabase:

```sql
-- ============================================================================
-- COMPLETE DATA STRUCTURE AUDIT
-- ============================================================================

-- 1. Summary types (should be 'monthly' and 'weekly')
SELECT 
  'Summary Types' as check,
  summary_type,
  COUNT(*) as count
FROM campaign_summaries
WHERE platform = 'meta'
GROUP BY summary_type;

-- 2. Recent monthly data with all details
SELECT 
  'Recent Monthly Data' as check,
  summary_date,
  client_id,
  total_spend,
  total_impressions,
  total_clicks,
  (campaign_data IS NOT NULL) as has_campaigns,
  CASE 
    WHEN campaign_data IS NOT NULL 
    THEN JSONB_ARRAY_LENGTH(campaign_data)
    ELSE 0
  END as campaign_count
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly'
ORDER BY summary_date DESC
LIMIT 20;

-- 3. Check for zero-data records
SELECT 
  'Zero Data Records' as check,
  COUNT(*) as count
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly'
  AND total_spend = 0
  AND total_impressions = 0
  AND total_clicks = 0;

-- 4. Check date format (day of month)
SELECT 
  'Date Day Check' as check,
  EXTRACT(DAY FROM summary_date) as day_of_month,
  COUNT(*) as count
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly'
GROUP BY EXTRACT(DAY FROM summary_date)
ORDER BY day_of_month;

-- 5. Available date range
SELECT 
  'Date Range' as check,
  MIN(summary_date) as oldest,
  MAX(summary_date) as newest,
  COUNT(DISTINCT summary_date) as unique_months
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly';
```

---

## ✅ NEXT STEPS

1. **Copy browser console logs** when loading a past period
2. **Run the full diagnostic SQL** above
3. **Test with exact parameters** from console logs
4. **Report findings** - specifically:
   - What clientId is being queried?
   - What date is being queried?
   - Does SQL find data with those exact parameters?
   - If yes, what are the metric values (spend, impressions, etc.)?

This will pinpoint the exact issue.

