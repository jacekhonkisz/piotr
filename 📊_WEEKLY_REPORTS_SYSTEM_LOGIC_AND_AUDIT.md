# 📊 WEEKLY REPORTS SYSTEM - LOGIC & AUDIT REPORT

**Report Date:** November 18, 2025  
**Status:** 🟡 SYSTEM FUNCTIONAL WITH KNOWN ISSUES  
**Purpose:** Explain weekly reports system logic and identify duplicates/conflicts

---

## 🎯 EXECUTIVE SUMMARY

The weekly reports system has been through significant evolution and fixes. Here's what you need to know:

### Current State:
- ✅ **Core system functional** - Weekly data collection works
- ⚠️ **Multiple collection endpoints** - 4 different ways to collect weekly data
- ⚠️ **Known duplicate issues** - Database may contain duplicate weekly records
- ⚠️ **Performance concerns** - Full collection can timeout (180s limit)
- ✅ **Incremental collection working** - Smart system collects only missing weeks

---

## 📋 SYSTEM LOGIC OVERVIEW

### 1. **What Are Weekly Reports?**

Weekly reports aggregate campaign data into 7-day periods (Monday-Sunday) for easier analysis and trend tracking.

```
Weekly Report = Aggregated data for one ISO week (Monday → Sunday)

Example Week 46 (Nov 11-17, 2025):
├── Start Date: Monday, Nov 11
├── End Date: Sunday, Nov 17
├── Data Sources:
│   ├── Meta Ads API (4 endpoints per week)
│   ├── Google Ads API (if enabled)
│   └── daily_kpi_data (conversion metrics)
└── Storage: campaign_summaries table
```

### 2. **Data Flow Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    WEEKLY DATA COLLECTION                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┴─────────────────────┐
        ↓                                           ↓
   📅 HISTORICAL WEEKS                      🔄 CURRENT WEEK
   (Completed weeks)                        (In-progress week)
        ↓                                           ↓
   Data Source:                             Data Source:
   - campaign_summaries                     - smart_cache (3-6h TTL)
   - Stored permanently                     - Live Meta API
   - Updated via cron jobs                  - Updated frequently
        ↓                                           ↓
   Access Pattern:                          Access Pattern:
   - Direct DB query                        - Cache-first
   - Fast retrieval                         - Falls back to API
   - No API calls                           - Archived on week end
```

---

## 🗄️ DATABASE SCHEMA

### Storage Table: `campaign_summaries`

```sql
CREATE TABLE campaign_summaries (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  
  -- TYPE IDENTIFIER (Critical!)
  summary_type TEXT CHECK (summary_type IN ('weekly', 'monthly')),
  summary_date DATE NOT NULL,  -- Week start (Monday) for weekly
  platform TEXT DEFAULT 'meta', -- 'meta' | 'google'
  
  -- AGGREGATED METRICS
  total_spend DECIMAL(12,2),
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_conversions BIGINT,
  average_ctr DECIMAL(5,2),
  average_cpc DECIMAL(8,2),
  
  -- CONVERSION FUNNEL METRICS
  click_to_call BIGINT,
  email_contacts BIGINT,
  booking_step_1 BIGINT,
  booking_step_2 BIGINT,
  booking_step_3 BIGINT,
  reservations BIGINT,
  reservation_value DECIMAL(12,2),
  
  -- CALCULATED METRICS
  roas DECIMAL(10,2),
  cost_per_reservation DECIMAL(10,2),
  
  -- RICH DATA
  campaign_data JSONB,  -- Array of campaign details
  meta_tables JSONB,    -- Placement, demographic data
  google_ads_tables JSONB,  -- Google Ads specific data
  
  -- METADATA
  data_source TEXT,  -- 'meta_api' | 'smart_cache_archive' | 'daily_kpi_data'
  active_campaigns INTEGER,
  total_campaigns INTEGER,
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  
  -- UNIQUE CONSTRAINT (Prevents duplicates... in theory)
  UNIQUE(client_id, summary_type, summary_date, platform)
);
```

### 🔑 Key Points:

1. **`summary_type`** - Distinguishes weekly from monthly reports (CRITICAL!)
2. **`summary_date`** - For weekly: MUST be a Monday (ISO week start)
3. **`platform`** - Separates Meta and Google Ads data
4. **UNIQUE constraint** - Should prevent duplicates, but doesn't always work

---

## 🔄 COLLECTION MECHANISMS

### 🎯 PRIMARY SYSTEM (Recommended): Incremental Collection

**Endpoint:** `/api/automated/incremental-weekly-collection`  
**Schedule:** Every Monday at 2:00 AM  
**Mechanism:** Smart gap-filling

```typescript
// How It Works:
1. Query database for last 12 weeks
2. Identify MISSING weeks
3. Collect ONLY missing weeks
4. Skip weeks that already exist

// Example:
Weeks in DB: [Week 44, Week 45, Week 47]
Missing: [Week 46]
Action: Collect ONLY Week 46 → Fast! (~15 seconds)

// Performance:
- Typical: 1-2 missing weeks = 15-30 seconds ✅
- Empty DB: 12 weeks = ~3 minutes ⚠️
- Full collection: 53 weeks = TIMEOUT ❌
```

**Why It's Best:**
- ✅ Fast (< 2 minutes typical)
- ✅ Efficient (only collects what's needed)
- ✅ Reliable (won't timeout)
- ✅ Self-healing (detects and fixes gaps)

### ⚠️ LEGACY SYSTEM: Full Collection

**Endpoint:** `/api/automated/collect-weekly-summaries`  
**Schedule:** Sunday at 11:00 PM (DEPRECATED)  
**Mechanism:** Brute-force full collection

```typescript
// How It Works:
1. Calculate last 53 completed weeks
2. Add current week (54 total)
3. Loop through ALL 54 weeks
4. Fetch data for EACH week (even if exists)
5. UPSERT to database

// Performance:
- API calls: 216 (4 per week × 54 weeks)
- Duration: 208+ seconds
- Result: TIMEOUT ❌

// Why It's Bad:
- Collects data that already exists
- Wastes API calls
- Always times out on Vercel (180s limit)
```

**Status:** Should be deprecated or removed

---

## 🚨 DUPLICATE ISSUES IDENTIFIED

### Issue #1: Multiple Collection Endpoints

You have **4 DIFFERENT ENDPOINTS** that can collect weekly data:

| Endpoint | Status | Problem |
|----------|--------|---------|
| `/api/automated/incremental-weekly-collection` | ✅ ACTIVE | Primary (good) |
| `/api/automated/collect-weekly-summaries` | ⚠️ SCHEDULED | Legacy, causes timeouts |
| `/api/background/collect-weekly` | ⚠️ MANUAL | Duplicate of #2 |
| `/api/optimized/weekly-collection` | ❓ UNUSED | Google Ads only, unclear purpose |

**CONFLICT:** If multiple endpoints run, they may:
- Create duplicate records
- Overwrite each other's data
- Waste API quota

**RECOMMENDATION:** 
```bash
# Disable legacy endpoints in vercel.json
# Keep ONLY incremental-weekly-collection active
```

### Issue #2: Database Duplicates

Based on your audit scripts, the database likely contains duplicate weekly records:

**Cause:** UNIQUE constraint not enforced properly due to:
1. Multiple concurrent collection jobs
2. Legacy migrations without constraint
3. Manual data imports
4. Race conditions during week transitions

**Evidence from Audit Scripts:**

```sql
-- Script: check-belmonte-duplicates-detail.sql
-- This script checks for duplicate weeks

SELECT 
  summary_date,
  COUNT(*) as duplicate_count
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
GROUP BY summary_date
HAVING COUNT(*) > 1;

-- Expected: 0 rows (no duplicates)
-- Likely: Multiple rows (duplicates exist)
```

**Impact:**
- Reports may show incorrect totals (summing duplicates)
- Dashboard performance degraded (more records to query)
- Storage waste
- Confusion about which record is "correct"

### Issue #3: Non-Monday Week Starts

**Problem:** Some weekly records have `summary_date` that's NOT a Monday

**Why It Matters:** ISO weeks MUST start on Monday. Non-Monday dates indicate:
- Data corruption
- Incorrect week calculation
- Legacy code bugs

**Detection Script:**

```sql
-- Script: remove-non-monday-weeks.sql
SELECT 
  summary_date,
  EXTRACT(DOW FROM summary_date) as day_of_week,
  TO_CHAR(summary_date, 'Dy') as day_name
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1  -- NOT Monday
;
```

### Issue #4: Empty or Incomplete Data

**Problem:** Some weekly records exist but have:
- `campaign_data` = NULL or empty array
- `total_spend` = 0 when there should be spend
- Conversion metrics = 0 when there should be conversions

**Causes:**
1. API call failed but record created
2. Data source priority bug
3. Timeout during data fetch
4. Incomplete migration

**Detection:** 

```sql
-- Check for weeks with missing data
SELECT 
  summary_date,
  total_spend,
  CASE 
    WHEN campaign_data IS NULL THEN '❌ No campaign data'
    WHEN jsonb_array_length(campaign_data::jsonb) = 0 THEN '❌ Empty campaigns'
    ELSE '✅ Has data'
  END as data_status
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%')
ORDER BY summary_date DESC;
```

---

## 🔍 DATA SOURCE PRIORITY SYSTEM

Weekly data can come from multiple sources. Here's the priority:

### Priority 1: `daily_kpi_data` (Highest Priority)

```
Source: Manual CSV uploads or daily collection
Contains: Conversion funnel metrics (booking_step_1, reservations, etc.)
Why Priority 1: Most accurate, ground truth data
Used For: Conversion metrics ONLY
```

### Priority 2: Meta/Google API (Real-time)

```
Source: Direct API calls to Meta/Google Ads
Contains: Campaign data, spend, clicks, impressions
Why Priority 2: Official platform data, but may have delays
Used For: All advertising metrics
```

### Priority 3: `smart_cache` (Current Week Only)

```
Source: Cached API responses (3-6 hour TTL)
Contains: Current week's live data
Why Priority 3: Fast but stale
Used For: Current week dashboard display
```

### Priority 4: `campaign_summaries` (Historical)

```
Source: Pre-aggregated database records
Contains: Complete historical weeks
Why Priority 4: Fast retrieval, no API calls
Used For: Completed weeks in reports
```

### 🔧 How Priority Works (CODE):

```typescript
// File: src/lib/background-data-collector.ts:1047-1087

async function getConversionMetrics(clientId, weekStart, weekEnd) {
  // PRIORITY 1: Check daily_kpi_data first
  const { data: dailyKpis } = await supabase
    .from('daily_kpi_data')
    .select('*')
    .eq('client_id', clientId)
    .gte('date', weekStart)
    .lte('date', weekEnd);
  
  if (dailyKpis && dailyKpis.length > 0) {
    // Aggregate daily data
    return {
      booking_step_1: sum(dailyKpis, 'booking_step_1'),
      reservations: sum(dailyKpis, 'reservations'),
      // ... etc
      source: 'daily_kpi_data'  // ✅ PRIORITY 1
    };
  }
  
  // PRIORITY 2: Fall back to Meta API actions array
  const metaActions = parseMetaActionsArray(campaignData);
  if (metaActions.hasConversions) {
    return {
      booking_step_1: metaActions.booking_step_1,
      reservations: metaActions.reservations,
      source: 'meta_api'  // ⚠️ PRIORITY 2 (may be inaccurate)
    };
  }
  
  // PRIORITY 3: Return zeros
  return {
    booking_step_1: 0,
    reservations: 0,
    source: 'none'  // ❌ PRIORITY 3 (no data)
  };
}
```

---

## 🛠️ CLEANUP & FIX SCRIPTS

You have several scripts to fix the duplicate/conflict issues:

### 1. Remove Duplicate Weeks

**Script:** `scripts/fix-duplicate-weeks.sql`

```sql
-- Keeps ONLY the latest record for each unique (client, date, platform) combination
-- Deletes older duplicates

-- HOW TO USE:
-- 1. Review what will be deleted (script shows preview)
-- 2. Uncomment DELETE statement
-- 3. Run in Supabase SQL Editor
-- 4. Commit transaction
```

**What it does:**
- Identifies duplicate weeks (same client + date + platform)
- Keeps the most recent record (by `created_at`)
- Deletes older duplicates
- Shows preview before deleting

### 2. Remove Non-Monday Weeks

**Script:** `scripts/remove-non-monday-weeks.sql`

```sql
-- Deletes weekly records where summary_date is NOT a Monday

-- WHY: ISO weeks MUST start on Monday
-- Removes data corruption from old bugs
```

### 3. Audit Weekly Quality

**Script:** `scripts/audit-belmonte-weekly-quality.sql`

```sql
-- Comprehensive audit that checks:
-- 1. Duplicate weeks
-- 2. Missing conversion metrics
-- 3. Empty campaign_data
-- 4. Date distribution
-- 5. Current week status

-- RUN THIS FIRST to understand the scope of issues
```

---

## 🔧 HOW TO FIX DUPLICATES (STEP-BY-STEP)

### Step 1: Audit Current State

```bash
# 1. Go to Supabase Dashboard
# 2. Open SQL Editor
# 3. Run the audit script

-- Copy contents of: scripts/audit-belmonte-weekly-quality.sql
-- Paste in SQL Editor
-- Click "Run"
-- Review results
```

### Step 2: Identify Issues

Check for:
- ✅ Duplicate weeks (COUNT > 1 for same date)
- ✅ Non-Monday dates (day_of_week != 1)
- ✅ Empty campaign_data (NULL or [])
- ✅ Missing conversion metrics (booking_step_1 = 0)

### Step 3: Fix Duplicates

```sql
-- Option A: Automatic fix (keeps latest)
-- Run: scripts/fix-duplicate-weeks.sql

-- Option B: Manual cleanup
DELETE FROM campaign_summaries
WHERE id IN (
  -- IDs of records to delete (review first!)
  SELECT id 
  FROM campaign_summaries
  WHERE ...
);
```

### Step 4: Remove Non-Monday Weeks

```sql
-- Run: scripts/remove-non-monday-weeks.sql

DELETE FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1;
```

### Step 5: Add UNIQUE Constraint (If Missing)

```sql
-- Ensure UNIQUE constraint exists
ALTER TABLE campaign_summaries
ADD CONSTRAINT unique_weekly_summary 
UNIQUE (client_id, summary_type, summary_date, platform);

-- This prevents future duplicates
```

### Step 6: Re-collect Missing Data

```bash
# Trigger incremental collection to fill gaps
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection' \
  -H 'Authorization: Bearer YOUR_CRON_SECRET'

# This will detect and fill any gaps created by cleanup
```

---

## 🎯 BEST PRACTICES GOING FORWARD

### 1. Use ONLY Incremental Collection

```json
// vercel.json - Keep ONLY this cron job
{
  "crons": [
    {
      "path": "/api/automated/incremental-weekly-collection",
      "schedule": "0 2 * * 1"  // Monday 2 AM
    }
  ]
}
```

### 2. Monitor for Duplicates

```sql
-- Add this to your monitoring dashboard
SELECT 
  COUNT(*) as total_weeks,
  COUNT(DISTINCT (client_id, summary_date, platform)) as unique_weeks,
  COUNT(*) - COUNT(DISTINCT (client_id, summary_date, platform)) as duplicate_count
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Expected: duplicate_count = 0
```

### 3. Enforce Data Quality

```typescript
// Before inserting weekly data, validate:
function validateWeeklyData(data) {
  // ✅ summary_date is a Monday
  if (dayOfWeek(data.summary_date) !== 1) {
    throw new Error('Week must start on Monday');
  }
  
  // ✅ Has campaign data
  if (!data.campaign_data || data.campaign_data.length === 0) {
    throw new Error('Missing campaign data');
  }
  
  // ✅ Has metrics
  if (data.total_spend === 0 && data.total_clicks === 0) {
    throw new Error('No metrics found');
  }
}
```

### 4. Use UPSERT Properly

```typescript
// Always use UPSERT with correct conflict resolution
const { error } = await supabase
  .from('campaign_summaries')
  .upsert(summary, {
    onConflict: 'client_id,summary_type,summary_date,platform'
  });

// This ensures:
// - New weeks are inserted
// - Existing weeks are updated
// - No duplicates created
```

---

## 📊 CURRENT SYSTEM STATUS

### ✅ What's Working:

1. **Incremental collection** - Fast, efficient, reliable
2. **Data storage** - campaign_summaries schema is solid
3. **Priority system** - Conversion metrics from daily_kpi_data
4. **Platform separation** - Meta and Google Ads stored separately
5. **Smart caching** - Current week uses cache for speed

### ⚠️ Known Issues:

1. **Legacy endpoints** - Multiple collection endpoints causing confusion
2. **Database duplicates** - Some duplicate weeks exist (need cleanup)
3. **Non-Monday dates** - Some weeks don't start on Monday (data corruption)
4. **Empty records** - Some weeks have no campaign_data (incomplete collection)
5. **No monitoring** - No alerts for duplicates or missing data

### 🔴 Critical Issues:

1. **Timeout risk** - Full collection endpoint still scheduled (will timeout)
2. **Duplicate cron jobs** - Multiple jobs may run simultaneously
3. **No UNIQUE enforcement** - Constraint may be missing or not enforced

---

## 🚀 ACTION ITEMS

### Immediate (Do Now):

1. **Run audit script** - Understand current duplicate situation
   ```bash
   # scripts/audit-belmonte-weekly-quality.sql
   ```

2. **Fix duplicates** - Clean up database
   ```bash
   # scripts/fix-duplicate-weeks.sql
   ```

3. **Remove bad data** - Delete non-Monday weeks
   ```bash
   # scripts/remove-non-monday-weeks.sql
   ```

4. **Disable legacy cron** - Stop full collection job
   ```json
   // Remove from vercel.json:
   // - /api/automated/collect-weekly-summaries
   ```

### Short-term (This Week):

1. **Add monitoring** - Alert on duplicates
2. **Enforce UNIQUE constraint** - Prevent future duplicates
3. **Add data validation** - Check before insert
4. **Document endpoints** - Which to use when

### Long-term (This Month):

1. **Consolidate endpoints** - Remove duplicates
2. **Add progress tracking** - UI for collection status
3. **Implement retry logic** - Handle API failures better
4. **Add data quality tests** - Automated checks

---

## 📁 RELATED FILES

### Documentation:
- `📘_AUTOMATED_DATA_COLLECTION.md` - System overview
- `📊_WEEKLY_MONTHLY_AUDIT_REPORT.md` - Detailed audit
- `📋_AUDIT_SUMMARY_READ_THIS_FIRST.md` - Timeout issue summary
- `🚨_FUNDAMENTAL_TIMEOUT_ISSUES_AUDIT.md` - Technical deep-dive

### Scripts:
- `scripts/audit-belmonte-weekly-quality.sql` - Quality audit
- `scripts/check-belmonte-duplicates-detail.sql` - Duplicate check
- `scripts/fix-duplicate-weeks.sql` - Remove duplicates
- `scripts/remove-non-monday-weeks.sql` - Fix date issues
- `scripts/check-belmonte-collection-status.sql` - Collection status

### Code:
- `src/lib/background-data-collector.ts` - Main collection logic
- `src/app/api/automated/incremental-weekly-collection/route.ts` - Primary endpoint
- `src/lib/data-lifecycle-manager.ts` - Cache archiving

---

## ❓ FAQ

**Q: Why do I have duplicates if there's a UNIQUE constraint?**  
A: The constraint may have been added after data was inserted, or concurrent transactions bypassed it.

**Q: Which collection endpoint should I use?**  
A: Use ONLY `/api/automated/incremental-weekly-collection` - it's the fastest and most reliable.

**Q: How do I know if I have duplicates?**  
A: Run `scripts/audit-belmonte-weekly-quality.sql` - it will show all duplicate weeks.

**Q: Will fixing duplicates break my reports?**  
A: No, the fix keeps the most recent (accurate) data and removes older duplicates.

**Q: Why are some weeks missing data?**  
A: Likely due to API timeouts, rate limits, or collection failures. Re-run incremental collection to fill gaps.

**Q: Should I delete the legacy collection endpoint?**  
A: Not yet - disable it in `vercel.json` first, monitor for a week, then delete the code.

---

## ✅ SUMMARY

The weekly reports system:

1. **Collects data** from Meta/Google APIs every Monday (incremental)
2. **Stores weekly aggregates** in campaign_summaries table
3. **Uses priority system** for conversion metrics (daily_kpi_data first)
4. **Has duplicate issues** that need cleanup (scripts provided)
5. **Has multiple endpoints** that should be consolidated
6. **Works reliably** when using incremental collection only

**Next Steps:**
1. Run audit script to assess duplicates
2. Run cleanup scripts to fix database
3. Disable legacy collection endpoints
4. Monitor for new duplicates
5. Consider adding data quality checks

---

**Status:** 📊 System documented, issues identified, fixes available  
**Priority:** 🟡 MEDIUM - System works but needs cleanup  
**Confidence:** ✅ HIGH - All issues have known solutions

---

Need help with any of these steps? The audit and cleanup scripts are ready to use! 🚀

