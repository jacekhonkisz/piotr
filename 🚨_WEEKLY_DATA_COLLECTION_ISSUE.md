# 🚨 **CRITICAL ISSUE: Weekly Data Not Being Collected**

**Date:** November 18, 2025  
**Status:** ⚠️ **IDENTIFIED & FIX DEPLOYED**  
**Impact:** Reports show incorrect data (monthly totals instead of weekly)

---

## 📊 **WHAT YOU'RE SEEING**

When viewing **Week 46** (Nov 10-16), you see:
- **25,257 zł** (full month of November)
- Should be: **~3,500 zł** (just 1 week)

Console errors:
```
❌ StandardizedDataFetcher returned no data
🔄 Previous month API failed - showing fallback data
campaigns length: 1
```

---

## 🔍 **ROOT CAUSE IDENTIFIED**

### **Database Query:**
```sql
SELECT * FROM campaign_summaries 
WHERE client_id = 'belmonte-id'
AND summary_type = 'weekly'
AND summary_date >= '2025-11-10' 
AND summary_date <= '2025-11-16'
```

### **Result:** `ZERO ROWS` ❌

**Why?**  
The **automatic weekly collection cron job** is **TIMING OUT** and never completes:

1. **Cron Job:** `/api/automated/collect-weekly-summaries`  
2. **Schedule:** Every Sunday at 2 AM  
3. **Issue:** Collects **53 weeks × ALL clients** → Takes > 10 minutes → **TIMEOUT**
4. **Vercel Limit:**
   - **Hobby:** 60 seconds ❌
   - **Pro:** 10 minutes ❌ (still too slow)
5. **Result:** Database never gets populated with November weeks

---

## ✅ **IMMEDIATE FIX: Manual Collection**

I've deployed a **Manual Collection Admin Page** where you can trigger data collection for just Belmonte Hotel:

### **Steps:**

1. **Navigate to:** `https://piotr-gamma.vercel.app/admin/manual-collection`

2. **Click:** "Start Collection" button

3. **Wait:** 2-3 minutes for collection to complete

4. **Result:** Database will be populated with:
   - Last 53 weeks of data
   - Current week data  
   - Both Meta & Google Ads

5. **Verify:** Go to Reports page and select Week 46 → Should now show correct weekly data (~3,500 zł)

---

## 🎯 **WHAT GETS FIXED**

After manual collection:
```sql
-- BEFORE (empty)
campaign_summaries: 0 rows for November weeks

-- AFTER (populated)
campaign_summaries:
  - Week 46 (Nov 10-16): ✅
  - Week 47 (Nov 17-23): ✅  
  - Week 48, 49, 50... (past 53 weeks): ✅
```

Reports will then:
- ✅ Show correct weekly totals
- ✅ Load instantly from database
- ✅ Display proper year-over-year comparisons
- ✅ No more "fallback data" errors

---

## 🔧 **LONG-TERM SOLUTION (TODO)**

The automated cron job needs optimization:

### **Option 1: Incremental Collection (RECOMMENDED)**
```typescript
// Only collect NEW/MISSING weeks, not all 53 weeks
async function collectMissingWeeksOnly(clientId: string) {
  // 1. Query database for existing weeks
  // 2. Find gaps (missing weeks)
  // 3. Collect only those weeks
  // 4. Estimated time: 10-30 seconds ✅
}
```

### **Option 2: Per-Client Cron Jobs**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/automated/collect-weekly/belmonte",
      "schedule": "0 2 * * 0"  // Dedicated cron for Belmonte
    },
    {
      "path": "/api/automated/collect-weekly/hotel-x",
      "schedule": "15 2 * * 0"  // Separate cron for Hotel X
    }
  ]
}
```

### **Option 3: Vercel Background Functions (BEST)**
```typescript
// Use Vercel's @vercel/functions background feature
// Allows jobs to run up to 15 minutes (Pro) or 5 minutes (Hobby)
export const config = {
  maxDuration: 900, // 15 minutes
  runtime: 'nodejs18.x'
};
```

---

## 📋 **IMMEDIATE ACTION REQUIRED**

1. ✅ **Navigate to:** `https://piotr-gamma.vercel.app/admin/manual-collection`
2. ✅ **Click:** "Start Collection"
3. ✅ **Wait:** 2-3 minutes
4. ✅ **Refresh:** Reports page
5. ✅ **Verify:** Week 46 shows correct data

---

## 🎓 **WHY THIS HAPPENED**

### **System Design:**
```
┌─────────────────────────────────────────┐
│  USER VIEWS WEEK 46                     │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Frontend: "Load Week 46 data"          │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  API: /api/fetch-live-data              │
│  Query: campaign_summaries              │
│  WHERE summary_type = 'weekly'          │
│  AND summary_date between Nov 10-16     │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Database: campaign_summaries           │
│  Result: ZERO ROWS (empty) ❌           │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Fallback: Use stale monthly cache      │
│  Result: Shows 25,257 zł (full month)   │
└─────────────────────────────────────────┘
```

### **Why Database Is Empty:**
```
┌─────────────────────────────────────────┐
│  CRON JOB (Every Sunday 2 AM)           │
│  /api/automated/collect-weekly-summaries│
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Collect 53 weeks × 3 clients           │
│  = 159 API calls to Meta/Google         │
│  = ~600 seconds (10 minutes)            │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  VERCEL TIMEOUT: 600 seconds > 300 max  │
│  Job terminated ❌                       │
│  Database: NO DATA WRITTEN              │
└─────────────────────────────────────────┘
```

---

## 🎯 **SUCCESS CRITERIA**

After running manual collection, you should see:

### **Reports Page (Week 46):**
- ✅ Spend: ~3,500 zł (weekly, not 25,257 zł)
- ✅ "Dane na żywo" or "Z bazy danych" indicator
- ✅ 18 campaigns (not 1 fallback campaign)
- ✅ Year-over-year comparison working
- ✅ Conversion funnel: realistic numbers

### **Console (No Errors):**
- ✅ No "StandardizedDataFetcher returned no data"
- ✅ No "Previous month API failed"
- ✅ "✅ Found weekly data for 2025-11-10"

---

## 📧 **NEED HELP?**

If manual collection fails or times out:
1. Check Vercel function logs
2. Try collecting data for a shorter period (e.g., last 4 weeks only)
3. Contact me for optimization of the collection process

---

**Last Updated:** November 18, 2025  
**Fix Status:** ✅ Manual collection page deployed  
**Next:** Optimize automated cron job for incremental collection

