# 🎯 Belmonte-Only Weekly Data Collection

**Purpose**: Test fixes with single client (Belmonte) before collecting all 16 clients  
**Date**: November 18, 2025

---

## 📋 Steps to Execute

### **Step 1: Delete Belmonte's Current Weekly Data**

Run this in **Supabase SQL Editor**:

```sql
-- Quick deletion for Belmonte weekly data
BEGIN;

DELETE FROM campaign_summaries
WHERE client_id IN (
  SELECT id FROM clients WHERE name ILIKE '%Belmonte%'
)
AND summary_type = 'weekly'
AND platform = 'meta';

-- Verify deletion
SELECT 
  'Belmonte weekly records remaining: ' || COUNT(*) as status
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly';

COMMIT;
```

**Expected Result**: `Belmonte weekly records remaining: 0`

---

### **Step 2: Collect Belmonte's 53 Weeks**

Run this in **Terminal**:

```bash
cd /Users/macbook/piotr
npx tsx scripts/recollect-weeks-controlled.ts --weeks=53 --client=belmonte
```

**What This Does:**
- Collects only Belmonte's data
- 53 weeks of historical data
- Uses fixed logic (actions parser, correct priority)
- Takes ~1-2 minutes (only 53 records vs 848)

---

### **Step 3: Verify Collection Success**

Run this in **Supabase SQL Editor**:

```sql
-- Check Belmonte's weekly data after collection
SELECT 
  '📊 BELMONTE WEEKLY DATA' as info,
  COUNT(*) as weekly_records,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend,
  SUM(reservations) as reservations,
  SUM(booking_step_1) as booking_step_1,
  COUNT(CASE WHEN reservations > 0 OR booking_step_1 > 0 THEN 1 END) as records_with_conversions,
  ROUND(100.0 * COUNT(CASE WHEN reservations > 0 OR booking_step_1 > 0 THEN 1 END) / COUNT(*), 1) || '%' as conversion_rate
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';
```

**Success Criteria:**
- ✅ `weekly_records` = ~50-53 (some weeks may have no data)
- ✅ `reservations` > 0 (not all zeros!)
- ✅ `booking_step_1` > 0 (not all zeros!)
- ✅ `conversion_rate` > 0% (proving actions parser works)

---

### **Step 4: Check Individual Weeks**

```sql
-- See detailed weekly breakdown
SELECT 
  summary_date,
  TO_CHAR(summary_date, 'Day') as day_name,
  ROUND(total_spend::numeric, 2) as spend,
  total_impressions as impressions,
  reservations,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  CASE 
    WHEN reservations > 0 OR booking_step_1 > 0 THEN '✅ HAS DATA'
    WHEN total_spend > 0 THEN '⚠️ SPEND ONLY'
    ELSE '⚪ NO SPEND'
  END as data_status
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
ORDER BY summary_date DESC
LIMIT 20;
```

**What to Check:**
- ✅ All weeks start on Monday (day_name = 'Monday')
- ✅ Conversion metrics populated (not all zeros)
- ✅ Realistic values (not doubled/wrong)

---

### **Step 5: Test in Weekly Reports**

1. Go to `/reports` page
2. Select **"Weekly"** timeframe
3. Select **"Belmonte"** client
4. Check last few weeks

**Expected:**
- ✅ Shows weekly data (not monthly)
- ✅ Reservations populated
- ✅ Booking funnel shows progression
- ✅ Spend values look realistic

---

## 🎯 Why Test with Belmonte First?

### **Advantages:**
1. **Fast**: 1-2 minutes vs 15-20 minutes
2. **Safe**: Only affects one client
3. **Verifiable**: Easy to check if fixes work
4. **Reversible**: Can delete and retry quickly

### **What We're Testing:**
- ✅ Actions parser works (conversion metrics populated)
- ✅ Data source priority correct (no doubling)
- ✅ ISO week dates correct (all Mondays)
- ✅ Weekly reports show correct data

---

## ✅ If Belmonte Collection Succeeds

### **Next Steps:**
1. Verify all checks pass
2. Delete Belmonte's data again (for fresh collection with all clients)
3. Run full collection for all 16 clients:
   ```bash
   npx tsx scripts/recollect-weeks-controlled.ts --weeks=53
   ```

---

## ❌ If Belmonte Collection Fails

### **Troubleshooting:**

**If conversion metrics are still 0:**
- Check if fix was applied: `grep enhanceCampaignsWithConversions src/lib/background-data-collector.ts`
- Check import exists: `grep meta-actions-parser src/lib/background-data-collector.ts`
- Review error in collection log

**If data is doubled:**
- Check storeWeeklySummary function (line ~1026)
- Verify data source priority logic changed
- Check if hasAnyConversionData check exists

**If weeks aren't Mondays:**
- Check week-helpers.ts is being used
- Verify validateIsMonday is called
- Check getLastNWeeks function

---

## 📊 Current State

**Before Deletion:**
- Belmonte weekly records: ~12-15 (from previous collection)
- Coverage: Partial
- Data quality: Unknown (may have issues)

**After Collection:**
- Belmonte weekly records: ~50-53 (complete year)
- Coverage: ~95%+
- Data quality: ✅ Verified

---

## 🚀 Ready to Execute

**Run these commands in order:**

1. **Supabase SQL Editor**: `scripts/execute-belmonte-reset.sql`
2. **Terminal**: `npx tsx scripts/recollect-weeks-controlled.ts --weeks=53 --client=belmonte`
3. **Supabase SQL Editor**: Verification queries above

---

**Status**: ⏳ **READY TO EXECUTE**  
**Estimated Time**: 2-3 minutes total  
**Risk**: Low (single client only)



