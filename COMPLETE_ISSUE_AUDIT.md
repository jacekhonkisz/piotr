# 🔍 Complete Issue Audit - Why 0 Campaigns Still Showing

**Date:** October 2, 2025  
**Problem:** Reports page shows 0 campaigns, 7,118 PLN (from daily_kpi_data)  
**Expected:** Should show 22 campaigns, 12,735 PLN (from campaign_summaries)

---

## 🎯 Issue Summary

The API query:
```sql
SELECT * FROM campaign_summaries
WHERE client_id = '...'
  AND summary_date = '2025-09-01'
  AND summary_type = 'monthly'
  AND platform = 'meta'
```

Returns: **0 rows**

But we KNOW the data exists with 22 campaigns!

---

## 🔍 Possible Causes

### **1. Platform Column is NULL** (Most Likely)

**Problem:** Old records were created before `platform` column existed.

**Check:**
```sql
SELECT platform, COUNT(*)
FROM campaign_summaries
WHERE summary_date = '2025-09-01'
  AND summary_type = 'monthly'
GROUP BY platform;
```

**If shows:** `NULL | 1` → This is the problem!

**Fix:**
```sql
UPDATE campaign_summaries 
SET platform = 'meta' 
WHERE platform IS NULL;
```

---

### **2. Data is in Different Table**

**Problem:** Data might be in `reports` or `campaigns` table, not `campaign_summaries`.

**Check:**
```sql
-- Check reports table
SELECT COUNT(*) FROM reports
WHERE date_range_start = '2025-09-01';

-- Check campaigns table
SELECT COUNT(*) FROM campaigns
WHERE date_range_start = '2025-09-01';
```

---

### **3. Client ID Mismatch**

**Problem:** The client_id in database doesn't match what's being queried.

**Check:**
```sql
-- What client IDs exist for September?
SELECT DISTINCT client_id, COUNT(*)
FROM campaign_summaries
WHERE summary_date = '2025-09-01'
  AND summary_type = 'monthly'
GROUP BY client_id;
```

**Compare with:** `8657100a-6e87-422c-97f4-b733754a9ff8`

---

### **4. Summary Type Mismatch**

**Problem:** Data stored as 'weekly' instead of 'monthly'.

**Check:**
```sql
SELECT summary_type, COUNT(*)
FROM campaign_summaries
WHERE summary_date = '2025-09-01'
GROUP BY summary_type;
```

---

### **5. Date Format Issue**

**Problem:** Date stored in different format.

**Check:**
```sql
SELECT summary_date, COUNT(*)
FROM campaign_summaries
WHERE summary_date >= '2025-09-01'
  AND summary_date < '2025-10-01'
GROUP BY summary_date;
```

---

### **6. JSONB Column Type Issue**

**Problem:** `campaign_data` is stored as text, not JSONB.

**Check:**
```sql
SELECT 
  pg_typeof(campaign_data) as data_type,
  campaign_data::text as sample
FROM campaign_summaries
WHERE summary_date = '2025-09-01'
LIMIT 1;
```

---

## 🔧 Diagnostic Queries

### **Query 1: Find September Data (No Filters)**

```sql
SELECT 
  client_id,
  summary_date,
  summary_type,
  platform,
  CASE 
    WHEN campaign_data IS NULL THEN 'NULL'
    WHEN jsonb_typeof(campaign_data) = 'array' THEN jsonb_array_length(campaign_data) || ' campaigns'
    ELSE 'Not an array: ' || jsonb_typeof(campaign_data)
  END as campaign_data_status,
  total_spend,
  data_source
FROM campaign_summaries
WHERE summary_date = '2025-09-01'
ORDER BY total_spend DESC;
```

**This shows ALL September records regardless of filters.**

---

### **Query 2: Check Platform Distribution**

```sql
SELECT 
  platform,
  COUNT(*) as records,
  SUM(total_spend) as total_spend,
  STRING_AGG(DISTINCT client_id::text, ', ') as client_ids
FROM campaign_summaries
WHERE summary_date >= '2025-09-01'
  AND summary_date < '2025-10-01'
GROUP BY platform;
```

**Shows how many records have NULL vs 'meta' vs 'google'.**

---

### **Query 3: Find the "Rich" September Record**

```sql
SELECT *
FROM campaign_summaries
WHERE summary_date = '2025-09-01'
  AND jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) > 0
ORDER BY jsonb_array_length(campaign_data) DESC
LIMIT 1;
```

**This finds the record with campaigns, regardless of other filters.**

---

### **Query 4: Check What API Query Returns**

```sql
-- This is EXACTLY what the API queries
SELECT 
  'API Query Result' as test_name,
  COUNT(*) as rows_returned,
  SUM(jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb))) as total_campaigns,
  SUM(total_spend) as total_spend
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_date = '2025-09-01'
  AND summary_type = 'monthly'
  AND platform = 'meta';
```

**Expected:** `rows_returned: 1, total_campaigns: 22, total_spend: 12735.18`  
**If shows 0:** One of the filters is wrong!

---

## 🎯 Step-by-Step Diagnosis

### **Step 1:** Run Query 1 (Find September Data - No Filters)

This will show you ALL September data that exists.

**Expected output:**
```
client_id: 8657100a-6e87-422c-97f4-b733754a9ff8
summary_date: 2025-09-01
summary_type: monthly
platform: NULL  ← If this is NULL, that's the problem!
campaign_data_status: 22 campaigns
total_spend: 12735.18
```

---

### **Step 2:** If platform is NULL, run the fix:

```sql
UPDATE campaign_summaries 
SET platform = 'meta' 
WHERE platform IS NULL;
```

---

### **Step 3:** Run Query 4 (Check API Query)

This simulates exactly what the API does.

**If returns 0 rows BEFORE fix:** Platform was NULL  
**If returns 1 row AFTER fix:** Platform is now 'meta' ✅

---

### **Step 4:** Test API Again

```bash
curl -s 'http://localhost:3000/api/fetch-live-data' -X POST \
  -H "Content-Type: application/json" \
  -d '{"clientId": "8657100a-6e87-422c-97f4-b733754a9ff8", "dateRange": {"start": "2025-09-01", "end": "2025-09-30"}, "platform": "meta"}' \
  | jq '{campaigns: (.data.campaigns | length), spend: .data.stats.totalSpend}'
```

**Expected after fix:**
```json
{
  "campaigns": 22,
  "spend": 12735.18
}
```

---

## 📊 Quick Diagnostic Script

Run this one query to get a complete picture:

```sql
WITH september_data AS (
  SELECT *
  FROM campaign_summaries
  WHERE summary_date = '2025-09-01'
),
api_query AS (
  SELECT *
  FROM campaign_summaries
  WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
    AND summary_date = '2025-09-01'
    AND summary_type = 'monthly'
    AND platform = 'meta'
)
SELECT 
  'Total September Records' as metric,
  COUNT(*) as value
FROM september_data
UNION ALL
SELECT 
  'Records with NULL platform',
  COUNT(*)
FROM september_data
WHERE platform IS NULL
UNION ALL
SELECT 
  'Records with meta platform',
  COUNT(*)
FROM september_data
WHERE platform = 'meta'
UNION ALL
SELECT 
  'What API Query Returns',
  COUNT(*)
FROM api_query
UNION ALL
SELECT 
  'Records with campaigns',
  COUNT(*)
FROM september_data
WHERE jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) > 0;
```

**This shows everything in one query!**

---

## ✅ Expected Results After Fix

| Metric | Before Fix | After Fix |
|--------|------------|-----------|
| Total September Records | 1 | 1 |
| Records with NULL platform | 1 | 0 |
| Records with meta platform | 0 | 1 |
| What API Query Returns | 0 | 1 |
| Records with campaigns | 1 | 1 |

---

## 🚀 Action Plan

1. ✅ Run Query 1 to find September data
2. ✅ Check if `platform` is NULL
3. ✅ If NULL, run UPDATE query
4. ✅ Run Query 4 to verify API query now works
5. ✅ Test API endpoint
6. ✅ Refresh reports page
7. ✅ See 22 campaigns! 🎉

---

**Please run Query 1 and tell me what `platform` value shows!**










