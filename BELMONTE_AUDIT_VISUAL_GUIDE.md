# 📊 BELMONTE PAST PERIOD AUDIT - VISUAL GUIDE

## 🎯 The Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│                    BELMONTE DATA AUDIT                       │
│                   (Permanent Token Client)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │
                ┌─────────────┴─────────────┐
                │                           │
         ┌──────▼──────┐           ┌───────▼────────┐
         │  PAST DATA  │           │  CURRENT DATA  │
         │  (Database) │           │   (Cache/API)  │
         └──────┬──────┘           └───────┬────────┘
                │                           │
    ┌───────────┴──────────┐       ┌───────┴────────┐
    │                      │       │                 │
┌───▼────┐          ┌─────▼─────┐ │        ┌────────▼────────┐
│ Oct    │          │ Sept      │ │        │ Nov 2025        │
│ 2024   │          │ 2025      │ │        │ (This Month)    │
│        │          │           │ │        │                 │
│ From:  │          │ From:     │ │        │ From:           │
│ DB     │          │ DB        │ │        │ Cache → API     │
│ <1 sec │          │ <1 sec    │ │        │ 1-20 sec        │
└────────┘          └───────────┘ │        └─────────────────┘
                                  │
                    AUDIT CHECKS BOTH SIDES
```

---

## 🔍 What We're Auditing

### 1️⃣ DATABASE CONTENT (campaign_summaries table)

```
┌────────────────────────────────────────────────┐
│           CAMPAIGN_SUMMARIES TABLE             │
├────────────────────────────────────────────────┤
│                                                │
│  Client: Belmonte (ab0b4c7e...)               │
│                                                │
│  ┌──────────────┬──────────┬──────────────┐   │
│  │ summary_date │ platform │ summary_type │   │
│  ├──────────────┼──────────┼──────────────┤   │
│  │ 2024-11-01   │ meta     │ monthly      │   │
│  │ 2024-11-01   │ google   │ monthly      │   │
│  │ 2024-12-01   │ meta     │ monthly      │   │
│  │ 2024-12-01   │ google   │ monthly      │   │
│  │     ...      │   ...    │    ...       │   │
│  │ 2025-10-01   │ meta     │ monthly      │   │
│  │ 2025-10-01   │ google   │ monthly      │   │
│  │ 2025-11-01   │ meta     │ monthly      │   │
│  │ 2025-11-01   │ google   │ monthly      │   │
│  └──────────────┴──────────┴──────────────┘   │
│                                                │
│  EXPECTED: 26 records (13 months × 2 platforms)│
└────────────────────────────────────────────────┘
```

**What we check:**
- ✅ Are there records for Belmonte?
- ✅ Do we have 13 months of history?
- ✅ Both Meta and Google platforms?
- ✅ Is the data complete (not zeros)?

---

### 2️⃣ DATA QUALITY

```
For each record, we check:

┌─────────────────────────────────────────┐
│  Record: 2024-10-01 (Meta, Monthly)    │
├─────────────────────────────────────────┤
│                                         │
│  total_spend:        24,640.77 PLN ✅  │
│  total_impressions:  450,000     ✅    │
│  total_clicks:       5,200       ✅    │
│  total_conversions:  196          ✅    │
│                                         │
│  reservations:       196          ✅    │
│  reservation_value:  118,431 PLN  ✅    │
│                                         │
│  campaign_data:      [15 campaigns] ✅  │
│  meta_tables:        {demographic}  ✅  │
│                                         │
│  last_updated:       2 hours ago    ✅  │
└─────────────────────────────────────────┘

🟢 ALL GOOD = Complete, ready to use
🟡 PARTIAL = Some fields missing
🔴 PROBLEM = Zeros, NULL, or empty
```

---

### 3️⃣ YEAR-OVER-YEAR COVERAGE

```
For YoY comparisons to work, we need matching periods:

┌──────────────────────────────────────────┐
│        2024            2025              │
├──────────────────────────────────────────┤
│                                          │
│  Jan 2024 ───────→ Jan 2025              │
│  Feb 2024 ───────→ Feb 2025              │
│  Mar 2024 ───────→ Mar 2025              │
│  ...                   ...               │
│  Nov 2024 ───────→ Nov 2025              │
│                                          │
│  ✅ Can compare: Spend, Conversions     │
│  ✅ Calculate: % change                  │
│  ✅ Show trends: Up/down                 │
└──────────────────────────────────────────┘

AUDIT CHECKS:
✅ Do we have Nov 2024 data?
✅ Do we have Nov 2025 data?
✅ Both have same metrics?
```

---

## 🚀 How Data Fetching Works

### Scenario A: User Requests PAST DATA (October 2024)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  USER: "Show me October 2024 data"                  │
│                                                      │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  System Classification  │
        │                        │
        │  Is Oct 2024 current?  │
        │  No → HISTORICAL       │
        └────────┬───────────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │  Strategy Selection  │
      │                      │
      │  DATABASE_FIRST ✅   │
      └──────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │  Query campaign_summaries  │
    │                            │
    │  WHERE date = '2024-10-01' │
    │  AND type = 'monthly'      │
    │  AND platform = 'meta'     │
    └────────────┬───────────────┘
                 │
                 ▼
         ┌───────────────┐
         │  Found data?  │
         └───┬───────┬───┘
             │       │
          YES│       │NO
             │       │
             ▼       ▼
    ┌────────────┐  ┌──────────────┐
    │ Return DB  │  │ Try API call │
    │ data       │  │ (fallback)   │
    │ <1 second  │  │ 10-20 sec    │
    └────────────┘  └──────────────┘
```

**EXPECTED:** Fast return from database ✅  
**PROBLEM IF:** Slow API call or no data ❌

---

### Scenario B: User Requests CURRENT DATA (November 2025)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  USER: "Show me November 2025 data"                 │
│                                                      │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  System Classification  │
        │                        │
        │  Is Nov 2025 current?  │
        │  Yes → CURRENT         │
        └────────┬───────────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │  Strategy Selection  │
      │                      │
      │  SMART_CACHE ✅      │
      └──────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │  Check current_month_cache │
    └────────────┬───────────────┘
                 │
                 ▼
         ┌───────────────┐
         │  Cache fresh? │
         │  (<3 hours)   │
         └───┬───────┬───┘
             │       │
          YES│       │NO
             │       │
             ▼       ▼
    ┌────────────┐  ┌──────────────┐
    │ Return     │  │ Fetch Meta   │
    │ cache      │  │ API          │
    │ 1-2 sec    │  │ 10-20 sec    │
    └────────────┘  └──────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │ Update cache  │
                   │ for next time │
                   └───────────────┘
```

**EXPECTED:** Cache hit (fast) or API fetch (slower) ✅  
**PROBLEM IF:** Always hitting API or errors ❌

---

## 🔴 COMMON PROBLEMS - VISUAL DIAGNOSIS

### Problem #1: Empty Database

```
USER REQUEST: October 2024
       ↓
SYSTEM: Check database
       ↓
DATABASE: ❌ NO DATA FOUND
       ↓
FALLBACK: Try API
       ↓
API: ⚠️ Too old (beyond 90 days)
       ↓
RESULT: ❌ All zeros shown

ROOT CAUSE: campaign_summaries table empty
FIX: Run background data collector
```

---

### Problem #2: Wrong Strategy Used

```
USER REQUEST: October 2024 (PAST)
       ↓
SYSTEM: ❌ Classifies as CURRENT
       ↓
STRATEGY: ❌ Uses SMART_CACHE
       ↓
CACHE: No cache for Oct 2024
       ↓
API: Calls Meta API (slow)
       ↓
RESULT: ⚠️ Works but slow (10-20 sec)

ROOT CAUSE: Period detection logic broken
FIX: Fix date classification in code
```

---

### Problem #3: Data Incomplete

```
DATABASE HAS:
┌────────────────────────┐
│ Oct 2024              │
│ total_spend: 24,640 ✅│
│ conversions: 196    ✅│
│ campaign_data: []   ❌│ ← EMPTY!
└────────────────────────┘

REPORTS SHOW:
✅ Aggregate metrics: OK
❌ Top campaigns: Empty
❌ Campaign details: Missing

ROOT CAUSE: Storage logic doesn't save campaigns
FIX: Update data collector to include campaign_data
```

---

## 📋 AUDIT CHECKLIST - VISUAL

```
┌────────────────────────────────────────────┐
│         BELMONTE AUDIT CHECKLIST           │
├────────────────────────────────────────────┤
│                                            │
│  1. DATABASE CONTENT                       │
│     □ campaign_summaries table exists      │
│     □ Belmonte records found               │
│     □ 13+ months of data                   │
│     □ Both Meta & Google                   │
│                                            │
│  2. DATA QUALITY                           │
│     □ Spend values > 0                     │
│     □ campaign_data populated              │
│     □ Conversion metrics present           │
│     □ No NULL/empty fields                 │
│                                            │
│  3. YEAR-OVER-YEAR                         │
│     □ 2024 data available                  │
│     □ Matching months (Nov 24 & 25)        │
│     □ Complete metrics both years          │
│                                            │
│  4. FETCHING LOGIC                         │
│     □ Historical uses DATABASE_FIRST       │
│     □ Current uses SMART_CACHE             │
│     □ Fast responses (<2s for past)        │
│     □ Logs show correct classification     │
│                                            │
│  5. SYSTEM HEALTH                          │
│     □ Cache tables updated recently        │
│     □ No errors in logs                    │
│     □ Background collector running         │
│     □ Meta API credentials valid           │
│                                            │
└────────────────────────────────────────────┘
```

---

## 🎯 WHAT GOOD LOOKS LIKE

### Healthy System:

```
┌─────────────────────────────────────────────────────┐
│              BELMONTE DATA STATUS                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Database Records:      26 ✅                       │
│  Date Coverage:         2024-01 to 2025-11 ✅      │
│  Zero Spend Records:    0 ✅                        │
│  Empty campaign_data:   0 ✅                        │
│                                                     │
│  Latest Update:         2 hours ago ✅              │
│  Cache Status:          FRESH ✅                    │
│                                                     │
│  Historical Fetch:      0.8 seconds ✅              │
│  Current Fetch:         1.5 seconds ✅              │
│                                                     │
│  Year-over-Year:        WORKING ✅                  │
│  API Credentials:       VALID ✅                    │
│                                                     │
│        🟢 SYSTEM HEALTHY - NO ACTION NEEDED        │
└─────────────────────────────────────────────────────┘
```

---

### Problem System:

```
┌─────────────────────────────────────────────────────┐
│              BELMONTE DATA STATUS                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Database Records:      3 ❌ (need 26)             │
│  Date Coverage:         2025-09 to 2025-11 ⚠️      │
│  Zero Spend Records:    10 ❌                       │
│  Empty campaign_data:   3 ⚠️                        │
│                                                     │
│  Latest Update:         14 days ago ❌              │
│  Cache Status:          STALE ⚠️                    │
│                                                     │
│  Historical Fetch:      18 seconds ❌ (too slow)   │
│  Current Fetch:         22 seconds ❌ (too slow)   │
│                                                     │
│  Year-over-Year:        NOT WORKING ❌              │
│  API Credentials:       VALID ✅                    │
│                                                     │
│        🔴 ACTION REQUIRED - SEE FIXES BELOW        │
└─────────────────────────────────────────────────────┘

FIXES NEEDED:
1. Run background data collector (missing 23 records)
2. Backfill 2024 data for YoY
3. Fix zero spend records (API issue?)
4. Update stale cache
5. Investigate slow fetches (wrong strategy?)
```

---

## 🚀 RUNNING THE AUDIT - STEP BY STEP

### Visual Workflow:

```
START
  │
  ├─→ Step 1: Open terminal
  │
  ├─→ Step 2: Connect to database
  │     psql $DATABASE_URL
  │
  ├─→ Step 3: Run audit file
  │     \i BELMONTE_HISTORICAL_DATA_AUDIT.sql
  │
  ├─→ Step 4: Wait for results (30 seconds)
  │     [Running 10 queries...]
  │
  ├─→ Step 5: Review executive summary
  │     [Last section of output]
  │
  └─→ Step 6: Identify issues
        [Green ✅, Yellow ⚠️, or Red ❌]
```

---

## 📊 INTERPRETING RESULTS

### Result Pattern #1: All Green

```
┌──────────────────────────┐
│ Meta months:      13 ✅  │
│ Google months:    13 ✅  │
│ Earliest data:  2024 ✅  │
│ Zero spend:        0 ✅  │
│ Empty campaigns:   0 ✅  │
└──────────────────────────┘

INTERPRETATION: Perfect! ✅
ACTION: None needed
```

---

### Result Pattern #2: Some Issues

```
┌──────────────────────────┐
│ Meta months:       8 ⚠️  │
│ Google months:    13 ✅  │
│ Earliest data:  2024 ✅  │
│ Zero spend:        2 ⚠️  │
│ Empty campaigns:   3 ⚠️  │
└──────────────────────────┘

INTERPRETATION: Needs attention ⚠️
ACTION: 
  - Collect missing 5 months
  - Fix 2 zero records
  - Populate 3 empty campaigns
```

---

### Result Pattern #3: Critical

```
┌──────────────────────────┐
│ Meta months:       0 ❌  │
│ Google months:     0 ❌  │
│ Earliest data:   N/A ❌  │
│ Zero spend:      N/A ❌  │
│ Empty campaigns: N/A ❌  │
└──────────────────────────┘

INTERPRETATION: Critical failure! 🔴
ACTION: URGENT
  - Background collector broken
  - No data being saved
  - Run manual collection
  - Check system logs
```

---

## ✅ QUICK START

### One Command to Check Health:

```bash
psql $DATABASE_URL -c "
SELECT 
  '🏨 Belmonte Health Check' as status,
  COUNT(*) as records,
  COUNT(DISTINCT summary_date) as periods,
  MIN(summary_date) as from_date,
  MAX(summary_date) as to_date
FROM campaign_summaries 
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
"
```

**Good Result:**
```
status                   | records | periods | from_date  | to_date
------------------------|---------|---------|------------|------------
🏨 Belmonte Health Check |   26    |   13    | 2024-01-01 | 2025-11-01
```

---

**That's it!** 🎉

Now you understand:
- ✅ What we're auditing
- ✅ Why it matters
- ✅ How to run it
- ✅ How to interpret results
- ✅ What to do if issues found

**Ready to run the audit?**

```bash
psql $DATABASE_URL -f BELMONTE_HISTORICAL_DATA_AUDIT.sql
```



