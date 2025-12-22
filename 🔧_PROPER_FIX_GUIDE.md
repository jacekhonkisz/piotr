# 🔧 Proper Fix for Weekly Data Collection

**Date**: November 18, 2025  
**Issue**: All weeks showing identical current month data  
**Solution**: Direct BackgroundDataCollector call with proper week handling

---

## 🚨 What Was Wrong

### **The Bug:**
The old script (`recollect-weeks-controlled.ts`) called the API **53 times** (once per week) but didn't pass which specific week to collect:

```typescript
// OLD (BROKEN):
for (const weekMonday of weekMondays) {
  // ❌ Calls API without specifying WHICH week
  await fetch(`/api/automated/collect-weekly-summaries?testClient=belmonte`);
  // Result: API collects ALL weeks (0-53) on EVERY call
  // = Same current month data written 53 times!
}
```

### **Why It Failed:**
1. API endpoint only accepts `startWeek` and `endWeek` offsets, not specific dates
2. Without parameters, it defaults to `startWeek=0, endWeek=53` (ALL weeks including current)
3. The collector generates weeks based on CURRENT date, not the requested date
4. Result: Every week gets the SAME current month metrics

---

## ✅ The Fix

### **New Script:** `scripts/recollect-weeks-direct.ts`

**What It Does:**
```typescript
// NEW (FIXED):
const collector = BackgroundDataCollector.getInstance();

// ✅ Calls collector ONCE with client filter
await collector.collectWeeklySummaries(
  'belmonte',  // Filter to specific client
  1,           // Start from 1 week ago (exclude current)
  53           // Collect 53 historical weeks
);

// Inside collectWeeklySummaries:
// 1. Filters to 'belmonte' client
// 2. Generates 53 ISO week Mondays (historical dates)
// 3. For EACH week Monday:
//    - Calls Meta API with THAT week's specific date range
//    - Week 1: 2025-11-03 to 2025-11-09
//    - Week 2: 2025-10-27 to 2025-11-02
//    - Week 3: 2025-10-20 to 2025-10-26
//    - etc.
// 4. Each call gets DIFFERENT data for THAT specific week
// 5. Parses actions array for conversions
// 6. Stores with correct week date
```

### **Key Differences:**
| Aspect | OLD (Broken) | NEW (Fixed) |
|--------|-------------|-------------|
| **API Calls** | 53 separate calls | 1 call (internal loop) |
| **Week Dates** | Not passed | Specific for each week |
| **Data Returned** | Same current month | Different for each week |
| **Actions Parser** | ✅ Applied | ✅ Applied |
| **Result** | Identical values | Unique values per week |

---

## 📋 Step-by-Step Execution

### **Step 1: Delete Bad Data** ✅ READY

Run in **Supabase SQL Editor**:

```bash
scripts/delete-todays-bad-weekly-data.sql
```

**What it does:**
- Deletes all 234 weekly records created today (Nov 18)
- These records all have identical values (current month data)
- Includes backup and verification

**Expected Result:**
```
✅ DELETION COMPLETE
Deleted all weekly records created today
```

---

### **Step 2: Test with Belmonte** ✅ READY

Run in **Terminal**:

```bash
cd /Users/macbook/piotr
npx tsx scripts/recollect-weeks-direct.ts --weeks=53 --client=belmonte
```

**What it does:**
- Collects 53 historical weeks for Belmonte only
- Uses fixed logic (specific week dates)
- Takes ~2-3 minutes
- Each week gets DIFFERENT data

**Expected Progress:**
```
📊 Processing: Belmonte Hotel
📅 Collecting week 2025-11-03 to 2025-11-09
📅 Collecting week 2025-10-27 to 2025-11-02
📅 Collecting week 2025-10-20 to 2025-10-26
...
✅ Collection completed
```

---

### **Step 3: Verify Belmonte Data** ✅ READY

Run in **Supabase SQL Editor**:

```sql
-- Check if weeks have DIFFERENT values (not identical)
SELECT 
  summary_date,
  ROUND(total_spend::numeric, 2) as spend,
  reservations,
  booking_step_1
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
ORDER BY summary_date DESC
LIMIT 10;
```

**Success Criteria:**
- ✅ Each week has DIFFERENT spend (not all 25261.07!)
- ✅ Each week has DIFFERENT reservations (not all 420!)
- ✅ Values vary realistically over time
- ✅ Older weeks may have lower/higher values than recent weeks

**Example of CORRECT data:**
```
2025-11-10 | 25,261.07 | 420 | 27,968
2025-11-03 | 23,145.22 | 385 | 25,432  ← Different!
2025-10-27 | 28,992.15 | 467 | 31,205  ← Different!
2025-10-20 | 21,334.88 | 352 | 23,677  ← Different!
```

---

### **Step 4: If Belmonte Succeeds, Collect All Clients**

Run in **Terminal**:

```bash
cd /Users/macbook/piotr
npx tsx scripts/recollect-weeks-direct.ts --weeks=53
# No --client parameter = all 16 clients
```

**What it does:**
- Collects 53 weeks × 16 clients = 848 records
- Takes ~15-20 minutes
- Each client gets proper historical data

---

## 🔍 How the Fix Ensures Correct Data

### **Inside BackgroundDataCollector.collectWeeklySummaries():**

```typescript
// File: src/lib/background-data-collector.ts (line 129+)

async collectWeeklySummaries(clientNameFilter, startWeek = 1, endWeek = 53) {
  // 1. Get clients (filtered by name if specified)
  const clients = await getClients(clientNameFilter);
  
  // 2. Generate ISO week Mondays (HISTORICAL dates, not offsets)
  const weekMondays = getLastNWeeks(endWeek - startWeek + 1, false);
  // Result: [2025-11-03, 2025-10-27, 2025-10-20, ...]
  
  // 3. For each client
  for (const client of clients) {
    // 4. For each week Monday
    for (const weekMonday of weekMondays) {
      const weekSunday = getSundayOfWeek(weekMonday);
      
      // 5. ✅ Call Meta API with THIS SPECIFIC week's dates
      const rawCampaignInsights = await metaService.getCampaignInsights(
        adAccountId,
        formatDateISO(weekMonday),   // e.g., '2025-10-27'
        formatDateISO(weekSunday),   // e.g., '2025-11-02'
        0  // No time increment
      );
      
      // 6. ✅ Parse actions array (our fix from earlier)
      const campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);
      
      // 7. ✅ Store with correct week date
      await storeWeeklySummary(client.id, {
        summary_date: formatDateISO(weekMonday),  // '2025-10-27'
        campaigns: campaignInsights,
        // ... other data
      });
    }
  }
}
```

**Key Points:**
- ✅ `weekMonday` is a SPECIFIC historical date (e.g., Oct 27, 2025)
- ✅ `getCampaignInsights()` is called with THAT specific week's date range
- ✅ Meta API returns data for THAT specific week only
- ✅ Each week gets DIFFERENT data
- ✅ Actions parser extracts conversions correctly

---

## 📊 Verification Queries

### **After Collection:**

```sql
-- 1. Check Belmonte has varied data
SELECT 
  'Belmonte Weekly Variance' as check,
  COUNT(DISTINCT total_spend) as unique_spend_values,
  COUNT(DISTINCT reservations) as unique_reservation_values,
  CASE 
    WHEN COUNT(DISTINCT total_spend) = 1 THEN '❌ ALL IDENTICAL (BUG!)'
    WHEN COUNT(DISTINCT total_spend) > 20 THEN '✅ GOOD VARIANCE'
    ELSE '⚠️ LOW VARIANCE'
  END as status
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly';

-- 2. Compare November totals with your earlier query
SELECT 
  'November 2025' as period,
  COUNT(*) as weeks,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend,
  SUM(reservations) as reservations
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-11-01'
  AND cs.summary_date < '2025-12-01';

-- Expected: 
-- - 2-3 weeks in November
-- - Total spend around 40k-60k (realistic for 2-3 weeks)
-- - NOT 25,261 × number of weeks (that would be duplicated)
```

---

## 🎯 Success Criteria

### **Before (Broken):**
```
All weeks: spend = 25,261.07, reservations = 420 ❌
Source: Current month data copied to all weeks
```

### **After (Fixed):**
```
Each week has different values ✅
Week 1: spend = 25,261.07, reservations = 420
Week 2: spend = 23,145.22, reservations = 385
Week 3: spend = 28,992.15, reservations = 467
...
Source: Actual historical data for each specific week
```

---

## 📚 Files Created

1. **`scripts/delete-todays-bad-weekly-data.sql`** - Remove bad data
2. **`scripts/recollect-weeks-direct.ts`** - Fixed collection script
3. **`🔧_PROPER_FIX_GUIDE.md`** - This guide
4. **`🚨_CRITICAL_BUG_FOUND.md`** - Bug analysis

---

## ⚡ Quick Start

```bash
# 1. Delete bad data
# Run in Supabase: scripts/delete-todays-bad-weekly-data.sql

# 2. Test with Belmonte
cd /Users/macbook/piotr
npx tsx scripts/recollect-weeks-direct.ts --weeks=53 --client=belmonte

# 3. Verify (run SQL above)

# 4. If successful, collect all
npx tsx scripts/recollect-weeks-direct.ts --weeks=53
```

---

**Status**: ✅ **FIX READY TO EXECUTE**  
**Confidence**: HIGH - Fix addresses root cause directly  
**Risk**: LOW - Testing with single client first



