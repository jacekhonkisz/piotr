# 🔍 PAST DATA FETCH ISSUE - DIAGNOSTIC AUDIT

**Date:** January 2025  
**Issue:** "StandardizedDataFetcher returned no data. Showing fallback data."  
**Status:** 🚨 **CRITICAL ISSUE IDENTIFIED**

---

## 🚨 PROBLEM SUMMARY

When viewing past periods in reports, users are seeing:
```
Error Loading Data
API Error: StandardizedDataFetcher returned no data. Showing fallback data.
```

This indicates that historical data is NOT being retrieved from the database properly.

---

## 🔍 ROOT CAUSE ANALYSIS

### **Issue #1: Database Query Mismatch**

The `campaign_summaries` table has a unique constraint that changed:

**Original constraint (from migration 013):**
```sql
UNIQUE(client_id, summary_type, summary_date)
```

**Updated constraint (from migration 043):**
```sql
UNIQUE(client_id, summary_type, summary_date, platform)
```

**Problem:** The query in `fetchFromCachedSummaries` may not be matching the constraint properly.

### **Issue #2: Missing Platform Column in Query**

Looking at the query logic:

```typescript:src/lib/standardized-data-fetcher.ts:983-1101
private static async fetchFromCachedSummaries(
  clientId: string,
  dateRange: { start: string; end: string },
  platform: string
): Promise<Partial<StandardizedDataResult>> {
  
  // Determine if this is a weekly or monthly request
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const summaryType = daysDiff <= 7 ? 'weekly' : 'monthly';
  
  if (summaryType === 'weekly') {
    const { data: weeklyResults, error: weeklyError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'weekly')
      .eq('platform', platform)  // ✅ Platform is included
      .gte('summary_date', dateRange.start)
      .lte('summary_date', dateRange.end)
      .order('summary_date', { ascending: false })
      .limit(1);
  } else {
    const { data: monthlyResults, error: monthlyError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly')
      .eq('platform', platform)  // ✅ Platform is included
      .eq('summary_date', dateRange.start)
      .limit(1);
  }
}
```

✅ **Query looks correct** - platform is included in the query.

### **Issue #3: No Data in Database**

**Most likely cause:** The `campaign_summaries` table is EMPTY or missing data for past periods.

This could happen if:
1. ❌ Background data collection hasn't run yet
2. ❌ Archival process hasn't executed
3. ❌ Cron jobs are not running
4. ❌ Data was never collected for past periods

---

## 📊 DIAGNOSTIC QUERIES

Run these queries in Supabase SQL Editor to diagnose:

### **1. Check if table has any data:**
```sql
SELECT 
  COUNT(*) as total_records,
  MIN(summary_date) as oldest_date,
  MAX(summary_date) as newest_date
FROM campaign_summaries;
```

**Expected:** Should have records from the past 14 months.  
**If 0:** Data collection/archival has never run.

### **2. Check records by platform:**
```sql
SELECT 
  platform,
  summary_type,
  COUNT(*) as count,
  MIN(summary_date) as oldest_date,
  MAX(summary_date) as newest_date
FROM campaign_summaries
GROUP BY platform, summary_type
ORDER BY platform, summary_type;
```

**Expected:** Should see both 'meta' and 'google' platforms with 'monthly' and 'weekly' types.

### **3. Check for specific client:**
```sql
SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  total_clicks
FROM campaign_summaries
WHERE client_id = 'YOUR-CLIENT-ID-HERE'
ORDER BY summary_date DESC
LIMIT 20;
```

**Expected:** Should show recent months/weeks for that client.

### **4. Check current cache tables:**
```sql
-- Check current month cache
SELECT 
  client_id,
  period_id,
  last_updated
FROM current_month_cache
ORDER BY last_updated DESC;

-- Check current week cache  
SELECT 
  client_id,
  period_id,
  last_updated
FROM current_week_cache
ORDER BY last_updated DESC;
```

**Expected:** Should have entries for current month/week.

---

## 🔧 POTENTIAL FIXES

### **Fix #1: Verify Data Collection is Running**

Check if background data collection cron is executing:

**Cron job configuration (from vercel.json):**
```json
{
  "path": "/api/background/collect-monthly",
  "schedule": "0 23 * * 0"  // Every Sunday at 23:00
}
```

**Action:**
1. Check Vercel logs to see if this endpoint is being called
2. Manually trigger: `curl https://your-domain/api/background/collect-monthly`
3. Check database after trigger to see if data appears

### **Fix #2: Manually Trigger Archival**

If current period data exists but hasn't been archived:

```bash
# Archive completed months
curl -X GET https://your-domain/api/automated/archive-completed-months

# Archive completed weeks
curl -X GET https://your-domain/api/automated/archive-completed-weeks
```

### **Fix #3: Backfill Historical Data**

If the system was recently deployed and no historical data exists, you need to backfill:

**Create backfill endpoint:**
```typescript
// src/app/api/admin/backfill-historical-data/route.ts
import { BackgroundDataCollector } from '@/lib/background-data-collector';

export async function POST() {
  const collector = BackgroundDataCollector.getInstance();
  
  // Collect last 12 months for all clients
  await collector.collectMonthlySummaries();
  await collector.collectWeeklySummaries();
  
  return Response.json({ success: true });
}
```

Then call it manually to populate historical data.

### **Fix #4: Add Better Error Handling**

Update `fetchFromCachedSummaries` to log why it's failing:

```typescript
private static async fetchFromCachedSummaries(
  clientId: string,
  dateRange: { start: string; end: string },
  platform: string
): Promise<Partial<StandardizedDataResult>> {
  
  console.log(`🔍 DIAGNOSTIC: Fetching from campaign_summaries`, {
    clientId,
    dateRange,
    platform
  });
  
  // ... existing query code ...
  
  if (error || !storedSummary) {
    console.error(`❌ DIAGNOSTIC: No data found in campaign_summaries`, {
      clientId,
      dateRange,
      platform,
      error: error?.message,
      query: {
        table: 'campaign_summaries',
        filters: {
          client_id: clientId,
          summary_type: summaryType,
          summary_date: dateRange.start,
          platform: platform
        }
      }
    });
    return { success: false };
  }
  
  console.log(`✅ DIAGNOSTIC: Found data in campaign_summaries`, {
    summaryDate: storedSummary.summary_date,
    totalSpend: storedSummary.total_spend,
    campaignCount: storedSummary.campaign_data?.length || 0
  });
  
  return { success: true, data: transformedData };
}
```

---

## 📋 VERIFICATION CHECKLIST

Run through this checklist to identify the issue:

### **Database Structure:**
- [ ] `campaign_summaries` table exists
- [ ] Table has correct unique constraint (with platform)
- [ ] Table has all required columns (including conversion metrics)

### **Data Availability:**
- [ ] Table has records (COUNT(*) > 0)
- [ ] Records exist for past months (not just current)
- [ ] Records exist for the specific client being queried
- [ ] Platform column is set correctly ('meta' or 'google')

### **Cron Jobs:**
- [ ] Background collection cron is configured
- [ ] Archival crons are configured
- [ ] Crons are actually executing (check Vercel logs)
- [ ] No errors in cron execution logs

### **Query Logic:**
- [ ] Platform parameter is being passed correctly
- [ ] Date range is formatted correctly (YYYY-MM-DD)
- [ ] Query includes all necessary filters
- [ ] Error handling is proper

---

## 🚀 IMMEDIATE ACTION ITEMS

### **Priority 1: Check if data exists**
```sql
-- Run this in Supabase SQL Editor
SELECT COUNT(*) as total_records FROM campaign_summaries;
```

If result is **0**: Data collection has never run → Go to Priority 2  
If result is **> 0**: Query logic issue → Go to Priority 3

### **Priority 2: Trigger data collection**
```bash
# If table is empty, manually trigger data collection
curl -X POST https://your-domain/api/background/collect-monthly
```

Wait 1-2 minutes, then re-check the count.

### **Priority 3: Add diagnostic logging**

Add console.log statements to `fetchFromCachedSummaries` to see:
- What query is being executed
- What error (if any) is being returned
- Whether data is found but being rejected

### **Priority 4: Check browser console**

Open browser DevTools and check:
- Network tab: See the actual API response
- Console tab: See the logged diagnostic information
- Look for the "StandardizedDataFetcher" logs

---

## 🎯 EXPECTED BEHAVIOR vs ACTUAL

### **Expected:**
```
1. User requests October 2024 data
2. System detects it's a past period
3. Query campaign_summaries table:
   - client_id = xxx
   - summary_type = 'monthly'
   - summary_date = '2024-10-01'
   - platform = 'meta'
4. Return stored data instantly
```

### **Actual:**
```
1. User requests October 2024 data
2. System detects it's a past period
3. Query campaign_summaries table
4. ❌ No data found (returns { success: false })
5. System tries fallback (daily_kpi_data)
6. ❌ No data there either
7. Error: "StandardizedDataFetcher returned no data"
```

---

## 📝 DIAGNOSTIC SCRIPT

Save the diagnostic queries to a file and run them:

**File: PAST_DATA_FETCH_DIAGNOSTIC.sql**

```sql
-- ============================================================================
-- DIAGNOSTIC: Check if past data actually exists in database
-- ============================================================================

-- 1. Check if campaign_summaries table has any data
SELECT 
  'Total records' as check_type,
  COUNT(*) as count,
  MIN(summary_date) as oldest_date,
  MAX(summary_date) as newest_date
FROM campaign_summaries;

-- 2. Check records by platform
SELECT 
  platform,
  summary_type,
  COUNT(*) as count,
  MIN(summary_date) as oldest_date,
  MAX(summary_date) as newest_date
FROM campaign_summaries
GROUP BY platform, summary_type
ORDER BY platform, summary_type;

-- 3. Check table structure (verify columns exist)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'campaign_summaries'
ORDER BY ordinal_position;

-- 4. Check unique constraint (verify it includes platform)
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'campaign_summaries'::regclass;
```

---

## ✅ RESOLUTION

Once you identify the issue, the fix will likely be one of:

1. **Empty table** → Trigger background data collection
2. **Query mismatch** → Fix the query logic
3. **Cron not running** → Verify Vercel cron configuration
4. **Platform mismatch** → Ensure 'meta' platform is used consistently

The most likely cause is **empty table** due to cron jobs not executing or system recently deployed without historical data backfill.




