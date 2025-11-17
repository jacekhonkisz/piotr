# Debug Guide - Previous Month Showing 0

## ✅ Fixes Applied

### 1. Fixed "6 wrz" Issue
**Changed:** Line 1457 in `src/app/dashboard/page.tsx`
- **Before:** `{clientData.stats.totalImpressions > 0 ? '6 wrz' : 'Brak danych'}`
- **After:** `Bieżący miesiąc`

This was hardcoded and is now fixed to show "Bieżący miesiąc" (Current month).

### 2. Added Enhanced Debugging for Previous Month Data
Added comprehensive logging to understand why previous month shows 0.

## 🔍 How to Debug the "vs 0" Issue

### Step 1: Check Browser Console
After refreshing the dashboard, open the browser console (F12) and look for these logs:

```
📊 FETCHING PREVIOUS MONTH CONVERSION METRICS:
  clientId: "xxx-xxx-xxx"
  clientName: "Hotel Belmonte"
  platform: "meta"
  previousMonth: "2025-10-01"  // This is what we're searching for
```

### Step 2: Check What Data Exists
The console will show:

```
📊 ALL MONTHLY SUMMARIES FOR CLIENT:
  count: X
  summaries: [
    {
      date: "2025-11-01",
      platform: "meta",
      booking_step_1: 205,
      reservations: 51,
      reservation_value: 17850
    }
  ]
```

**What to check:**
1. **Is there data for the previous month?** 
   - Current month is November 2025
   - Previous month should be October 2025 (2025-10-01)
   - If you only see November data, that's why it shows 0

2. **Does the platform match?**
   - If you're viewing Meta Ads tab, the data should have `platform: "meta"`
   - If you're viewing Google Ads tab, the data should have `platform: "google"`

### Step 3: Check Query Result
```
📊 PREVIOUS MONTH QUERY RESULT:
  found: false
  error: "PGRST116: The result contains 0 rows"
  data: null
```

**Possible reasons for found: false:**

1. **No data for October 2025** - Campaign summaries only exist for November
2. **Platform mismatch** - You're on Meta tab but data is marked as "google" 
3. **Date format mismatch** - The date doesn't match exactly

## 🛠️ How to Fix

### If No October Data Exists:

You need to populate `campaign_summaries` for October. This can happen if:
- The system only started collecting data in November
- October summary was never generated
- October summary was deleted

**Solution:** Run the summary generation script for October, or wait for it to be auto-generated.

### If Platform Mismatch:

Check the `campaign_summaries` table in Supabase:

```sql
SELECT 
  summary_date, 
  platform, 
  booking_step_1, 
  reservations, 
  reservation_value
FROM campaign_summaries
WHERE client_id = 'YOUR_CLIENT_ID'
  AND summary_type = 'monthly'
ORDER BY summary_date DESC
LIMIT 10;
```

Look for October 2025 data and verify the `platform` column matches what you're viewing.

### If Date Format Issue:

The code searches for the first day of the previous month (e.g., "2025-10-01" for October).
Check if your data uses a different date format.

## 📊 Expected Data Flow

### When Dashboard Loads:
1. **handleClientChange** is called with selected client
2. **loadMainDashboardData** fetches current month data
3. **setClientData** stores current month: `{ booking_step_1: 205, reservations: 51, ... }`
4. **fetchPreviousMonthConversionMetrics** is called
5. Query looks for October 2025 data in `campaign_summaries`
6. If found: `{ booking_step_1: 180, reservations: 45, ... }` → Display shows "vs 180"
7. If not found: `{ booking_step_1: 0, reservations: 0, ... }` → Display shows "vs 0"

## 🔧 Quick Test SQL Query

Run this in Supabase SQL Editor to see what data exists:

```sql
-- Check current month data
SELECT 
  'Current Month' as period,
  summary_date, 
  platform, 
  booking_step_1, 
  reservations, 
  reservation_value
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name = 'Hotel Belmonte' LIMIT 1)
  AND summary_type = 'monthly'
  AND summary_date >= date_trunc('month', CURRENT_DATE)
  
UNION ALL

-- Check previous month data
SELECT 
  'Previous Month' as period,
  summary_date, 
  platform, 
  booking_step_1, 
  reservations, 
  reservation_value
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name = 'Hotel Belmonte' LIMIT 1)
  AND summary_type = 'monthly'
  AND summary_date >= date_trunc('month', CURRENT_DATE - interval '1 month')
  AND summary_date < date_trunc('month', CURRENT_DATE)
  
ORDER BY period DESC, summary_date DESC;
```

## 📝 What the Console Logs Will Tell You

### Scenario 1: No October Data
```
📊 ALL MONTHLY SUMMARIES FOR CLIENT:
  count: 1
  summaries: [
    { date: "2025-11-01", platform: "meta", ... }
  ]

📊 PREVIOUS MONTH QUERY RESULT:
  found: false
  error: "PGRST116: The result contains 0 rows"
```
**Action:** Create October summary in campaign_summaries table

### Scenario 2: October Data Exists
```
📊 ALL MONTHLY SUMMARIES FOR CLIENT:
  count: 2
  summaries: [
    { date: "2025-11-01", platform: "meta", booking_step_1: 205, ... },
    { date: "2025-10-01", platform: "meta", booking_step_1: 180, ... }
  ]

📊 PREVIOUS MONTH QUERY RESULT:
  found: true
  data: { booking_step_1: 180, reservations: 45, ... }
```
**Result:** Should display "vs 180 poprzedni miesiąc"

### Scenario 3: Platform Mismatch
```
📊 ALL MONTHLY SUMMARIES FOR CLIENT:
  count: 2
  summaries: [
    { date: "2025-11-01", platform: "google", ... },
    { date: "2025-10-01", platform: "google", ... }
  ]

📊 PREVIOUS MONTH QUERY RESULT:
  found: false  (because searching for platform: "meta")
```
**Action:** Check if data was saved with wrong platform value

## 🎯 Next Steps

1. **Refresh the dashboard** and open browser console (F12)
2. **Copy all the logs** starting with "📊"
3. **Share the logs** so we can see exactly what data exists
4. Based on the logs, we'll either:
   - Create the missing October data
   - Fix the platform value
   - Adjust the date query

The enhanced logging will tell us exactly what the issue is!




