# 🔍 DATABASE QUERY MISMATCH DIAGNOSTIC

**Status:** 🚨 **DATA EXISTS BUT QUERY NOT FINDING IT**  
**Records in database:** 1178  
**Issue:** StandardizedDataFetcher returns "no data" for past periods

---

## 📊 DATA FLOW ANALYSIS

### **Current Flow:**
```
Reports Page (Client-Side)
    ↓
fetchReportDataUnified()
    ↓
StandardizedDataFetcher.fetchData({
  clientId: 'xxx',
  dateRange: { start: '2024-10-01', end: '2024-10-31' },
  platform: 'meta',
  reason: 'period-2024-10-standardized'
})
    ↓
[Client-side] → Redirects to /api/fetch-live-data (HTTP POST)
    ↓
[Server-side] → StandardizedDataFetcher._fetchDataInternal()
    ↓
Detects: Historical Period (not current month/week)
    ↓
fetchFromCachedSummaries(clientId, dateRange, 'meta')
    ↓
Queries campaign_summaries table
    ↓
❌ Returns { success: false } - No data found
```

---

## 🔍 DIAGNOSTIC QUERIES TO RUN

### **Step 1: Check what platforms exist**

```sql
SELECT 
  platform,
  COUNT(*) as count
FROM campaign_summaries
GROUP BY platform
ORDER BY count DESC;
```

**Expected:** Should see 'meta' as a platform  
**If NULL:** Migration 042 didn't run or data was inserted before platform column existed

---

### **Step 2: Check summary_types**

```sql
SELECT 
  summary_type,
  COUNT(*) as count
FROM campaign_summaries
GROUP BY summary_type
ORDER BY count DESC;
```

**Expected:** Should see 'monthly' and 'weekly'  
**If different:** Data structure mismatch

---

### **Step 3: Check date format**

```sql
SELECT 
  summary_date,
  TO_CHAR(summary_date, 'YYYY-MM-DD') as formatted_date,
  summary_type,
  platform
FROM campaign_summaries
ORDER BY summary_date DESC
LIMIT 10;
```

**Critical:** Does `summary_date` match the format '2024-10-01' (first day of month)?  
**If different:** Query is looking for wrong date format

---

### **Step 4: Find records for a specific month**

```sql
-- For October 2024
SELECT 
  client_id,
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions
FROM campaign_summaries
WHERE summary_date >= '2024-10-01'
  AND summary_date < '2024-11-01'
  AND summary_type = 'monthly'
ORDER BY summary_date DESC;
```

**Expected:** Should find records  
**If 0 results:** Problem with date range or summary_type

---

### **Step 5: Check for NULL platforms**

```sql
SELECT 
  COUNT(*) as records_with_null_platform
FROM campaign_summaries
WHERE platform IS NULL;
```

**Critical:** If > 0, these records won't match queries with `.eq('platform', 'meta')`

---

### **Step 6: Test the EXACT query that the app uses**

```sql
-- This mimics fetchFromCachedSummaries for monthly data
SELECT *
FROM campaign_summaries
WHERE client_id = 'YOUR-CLIENT-ID-HERE'  -- Replace with actual client ID
  AND summary_type = 'monthly'
  AND platform = 'meta'
  AND summary_date = '2024-10-01'  -- Replace with requested date
LIMIT 1;
```

**Expected:** Should return 1 row  
**If 0 results:** One of the conditions doesn't match

---

## 🚨 COMMON ISSUES & FIXES

### **Issue #1: NULL Platform Column**

**Problem:** Old data was inserted before `platform` column existed (migration 042)

**Check:**
```sql
SELECT COUNT(*) FROM campaign_summaries WHERE platform IS NULL;
```

**Fix:**
```sql
-- Update NULL platforms to 'meta' (default)
UPDATE campaign_summaries 
SET platform = 'meta' 
WHERE platform IS NULL;
```

---

### **Issue #2: Wrong Date Format**

**Problem:** `summary_date` is not the first day of the month

**Check:**
```sql
SELECT 
  summary_date,
  EXTRACT(DAY FROM summary_date) as day_of_month,
  COUNT(*) as count
FROM campaign_summaries
WHERE summary_type = 'monthly'
GROUP BY summary_date, EXTRACT(DAY FROM summary_date)
HAVING EXTRACT(DAY FROM summary_date) != 1;
```

**Expected:** Should be 0 records (all monthly dates should be day 1)

**Fix:** Data needs to be re-collected with correct date format

---

### **Issue #3: Client-Side vs Server-Side Mismatch**

**Problem:** Client-side calls go through HTTP which may lose context

**Evidence in code:**
```typescript:src/lib/standardized-data-fetcher.ts:142-183
// ✅ CRITICAL FIX: ALL client-side requests MUST go through API routes
if (typeof window !== 'undefined') {
  console.log('🌐 Client-side request detected, redirecting to server-side API...');
  
  // Make API call to server-side endpoint
  const response = await fetch('/api/fetch-live-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`
    },
    body: JSON.stringify({
      clientId: params.clientId,
      dateRange: params.dateRange,
      platform: params.platform || 'meta',
      reason: params.reason || 'standardized-fetch'
    })
  });
}
```

**Check:** Look at browser Network tab to see what parameters are actually sent

---

### **Issue #4: Missing Conversion Metrics Columns**

**Problem:** Query returns data but validation rejects it

**Check:**
```sql
-- Check if conversion metric columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'campaign_summaries'
  AND column_name IN ('click_to_call', 'email_contacts', 'booking_step_1', 'reservations');
```

**Expected:** All 4 columns should exist

---

## 📋 STEP-BY-STEP DEBUGGING PLAN

### **Step 1: Check Browser Console**

When you try to load a past period, look for these log messages:

```
📡 🔧 STANDARDIZED DATA FETCH (REPORTS):
📊 Loading from campaign_summaries for [clientId]...
📅 Searching for monthly data in campaign_summaries for 2024-10-01
```

Then look for either:
- ✅ `Found monthly summary for 2024-10-01`
- ⚠️ `No monthly summary found for 2024-10-01`

If you see "No monthly summary found", note the exact parameters being used.

---

### **Step 2: Run SQL Diagnostic**

Take the parameters from Step 1 and run this query in Supabase:

```sql
SELECT 
  *
FROM campaign_summaries
WHERE client_id = '[clientId from console]'
  AND summary_type = 'monthly'
  AND platform = 'meta'
  AND summary_date = '[date from console]';
```

---

### **Step 3: Compare Results**

**If SQL returns data but console says "not found":**
- Problem is with query logic or parameter passing
- Check authorization (RLS policies may be blocking)

**If SQL returns no data:**
- Run broader query to see what dates ARE available:
```sql
SELECT summary_date, summary_type, platform
FROM campaign_summaries
WHERE client_id = '[clientId]'
ORDER BY summary_date DESC
LIMIT 20;
```

---

### **Step 4: Check RLS Policies**

Row Level Security might be blocking the query:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'campaign_summaries';

-- Check existing policies
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'campaign_summaries';
```

**Common RLS issue:** Server-side queries need service role key, not user token

---

## 🎯 MOST LIKELY ISSUES (in order)

### **#1: NULL Platform (90% probability)**

Most likely cause. Run this first:

```sql
-- Check for NULL platforms
SELECT COUNT(*) FROM campaign_summaries WHERE platform IS NULL;

-- If > 0, fix it:
UPDATE campaign_summaries SET platform = 'meta' WHERE platform IS NULL;
```

### **#2: Wrong Date Format (60% probability)**

Check if dates are stored correctly:

```sql
SELECT summary_date, summary_type 
FROM campaign_summaries 
WHERE summary_type = 'monthly'
LIMIT 10;
```

All monthly dates should be the 1st day of the month (e.g., '2024-10-01')

### **#3: RLS Blocking Server-Side Query (40% probability)**

The query might be blocked by Row Level Security policies. Check if the API route is using service role key:

```typescript
// Should be using service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ← Must use service role
);
```

---

## 🔧 QUICK FIX SCRIPT

If the issue is NULL platforms, run this in Supabase SQL Editor:

```sql
-- Fix NULL platforms
UPDATE campaign_summaries 
SET platform = 'meta' 
WHERE platform IS NULL;

-- Verify fix
SELECT 
  platform,
  COUNT(*) as count
FROM campaign_summaries
GROUP BY platform;

-- Expected: Should only see 'meta' and 'google', no NULLs
```

---

## 📊 DIAGNOSTIC SQL SCRIPT

Save and run this complete diagnostic:

```sql
-- ============================================================================
-- COMPLETE DIAGNOSTIC SCRIPT
-- ============================================================================

-- 1. Total records and date range
SELECT 
  'Total Records' as metric,
  COUNT(*) as value,
  MIN(summary_date)::text as oldest,
  MAX(summary_date)::text as newest
FROM campaign_summaries
UNION ALL
SELECT 
  'NULL Platforms',
  COUNT(*),
  NULL,
  NULL
FROM campaign_summaries WHERE platform IS NULL
UNION ALL
SELECT 
  'Meta Platform',
  COUNT(*),
  NULL,
  NULL
FROM campaign_summaries WHERE platform = 'meta'
UNION ALL
SELECT 
  'Monthly Type',
  COUNT(*),
  NULL,
  NULL
FROM campaign_summaries WHERE summary_type = 'monthly';

-- 2. Recent months available
SELECT 
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  summary_type,
  COALESCE(platform, 'NULL') as platform,
  COUNT(*) as records
FROM campaign_summaries
WHERE summary_date >= NOW() - INTERVAL '6 months'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM'), summary_type, platform
ORDER BY month DESC, summary_type, platform;

-- 3. Sample of recent data
SELECT 
  summary_date,
  summary_type,
  COALESCE(platform, 'NULL') as platform,
  total_spend,
  total_impressions
FROM campaign_summaries
ORDER BY summary_date DESC
LIMIT 10;
```

---

## ✅ RESOLUTION CHECKLIST

After identifying the issue:

- [ ] NULL platforms fixed (UPDATE platform = 'meta')
- [ ] Dates are in correct format (YYYY-MM-DD, day 1 for monthly)
- [ ] Query parameters match database format
- [ ] RLS policies allow server-side access
- [ ] Service role key is used in API routes
- [ ] Browser console shows successful data retrieval
- [ ] Reports page displays past period data

---

## 📝 NEXT STEPS

1. **Run diagnostic SQL** (provided above)
2. **Check browser console** when loading past period
3. **Compare** SQL results with console parameters
4. **Fix** any mismatches found
5. **Test** past period loading again

