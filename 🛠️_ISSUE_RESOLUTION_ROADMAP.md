# 🛠️ Issue Resolution Roadmap
## Complete Guide to Fixing All Audit Findings

**Created:** November 20, 2025  
**Purpose:** Step-by-step guide to resolve all 4 critical issues and understand verification results  
**Time Required:** 2-3 hours total

---

## 📋 Table of Contents

1. [Understanding Your Verification Script](#understanding-verification)
2. [Issue #1: Cron Job Timing Conflicts](#issue-1)
3. [Issue #2: Duplicate Cleanup Endpoints](#issue-2)
4. [Issue #3: Historical Duplicate Weeks](#issue-3)
5. [Issue #4: Metric Name Inconsistencies](#issue-4)
6. [Complete Roadmap](#complete-roadmap)

---

## 🔍 Understanding Your Verification Script {#understanding-verification}

### What `verify-data-consistency.sql` Checks

Your verification script has **6 checks**. Here's what each one does:

---

### ✅ Check #1: October 2025 Data Comparison (Lines 8-64)

**What it checks:**
- Compares 3 data sources for October 2025 (Belmonte client)
- Weekly summaries aggregated
- Monthly summary
- Daily KPI data aggregated

**Expected Result:**
```
check_name                        | source                           | total_spend | reservations
----------------------------------|----------------------------------|-------------|-------------
1. October 2025 - Belmonte        | campaign_summaries (weekly agg)  | 50,735.18   | 392
1. October 2025 - Belmonte        | campaign_summaries (monthly)     | 50,735.18   | 392
1. October 2025 - Belmonte        | daily_kpi_data (aggregated)      | 50,735.18   | 392
```

**✅ GOOD Result:** All three match (within 0.01)  
**⚠️ WARNING Result:** Monthly is 0, but weekly has data  
**❌ BAD Result:** All three have different values

**What each result means:**

| Result | Meaning | Action Required |
|--------|---------|-----------------|
| All three match | ✅ Perfect consistency | None |
| Monthly = 0, Weekly > 0 | ⚠️ Monthly not aggregated yet | Run `scripts/fix-october-monthly-from-weekly.sql` |
| Daily < Weekly/Monthly | ⚠️ Missing daily data | Check daily-kpi-collection cron job |
| All different | ❌ Data integrity issue | Review collection logic |

---

### ✅ Check #2: Missing Days Check (Lines 67-84)

**What it checks:**
- October 2025 should have 31 days (Oct 1-31)
- Checks if daily_kpi_data has ALL days

**Expected Result:**
```
check_name           | client_name | expected_date | status      | total_spend
---------------------|-------------|---------------|-------------|-------------
2. Missing Days Check| Belmonte    | 2025-10-01    | ✅ Present  | 1,234.56
2. Missing Days Check| Belmonte    | 2025-10-02    | ✅ Present  | 1,456.78
...
2. Missing Days Check| Belmonte    | 2025-10-31    | ✅ Present  | 1,678.90
```

**✅ GOOD Result:** All 31 days show "✅ Present"  
**❌ BAD Result:** Some days show "❌ MISSING"

**If you see missing days:**
```
2025-10-15    | ❌ MISSING  | NULL
2025-10-16    | ❌ MISSING  | NULL
2025-10-17    | ❌ MISSING  | NULL
```

**Root Causes:**
1. Daily KPI collection cron job failed on those days
2. Meta API was down
3. Client token expired
4. Data never collected

**Fix:**
```bash
# Option 1: Trigger manual collection for missing dates
# (You'll need to create an endpoint for historical date collection)

# Option 2: Accept the gap (data can't be recovered if Meta doesn't have it)

# Option 3: Use weekly/monthly summaries (more reliable)
```

---

### ✅ Check #3: Data Completeness by Month (Lines 87-128)

**What it checks:**
- For ALL clients, compare monthly summary vs daily aggregation
- Checks recent months (Sept+)

**Expected Result:**
```
check_name                    | client_name | month   | summary_spend | daily_aggregated_spend | consistency_status
------------------------------|-------------|---------|---------------|------------------------|-------------------
3. Data Completeness by Month | Belmonte    | 2025-11 | 12,345.67     | 12,345.67              | ✅ Match
3. Data Completeness by Month | Belmonte    | 2025-10 | 50,735.18     | 50,735.18              | ✅ Match
3. Data Completeness by Month | Belmonte    | 2025-09 | 45,123.45     | 45,123.45              | ✅ Match
```

**Possible Results:**

| Status | Meaning | Fix |
|--------|---------|-----|
| ✅ Match | Perfect consistency | None needed |
| ⚠️ No Data | No data for that month | Normal if before client onboarding |
| ❌ Mismatch | Daily != Monthly | Investigation needed |

**If you see mismatches:**
```
Belmonte    | 2025-10 | 50,735.18     | 35,241.23              | ❌ Mismatch
```

**Diagnosis:**
- Monthly summary: 50,735.18 (correct from Meta API)
- Daily aggregated: 35,241.23 (missing ~10 days of data)
- **Root cause:** Daily collection incomplete

**Fix:** Accept monthly summary as source of truth (it's more reliable)

---

### ✅ Check #4: Weekly vs Daily Consistency (Lines 131-161)

**What it checks:**
- For each week in October, compare weekly summary vs daily aggregation

**Expected Result:**
```
check_name                    | client_name | week_start | weekly_summary_spend | daily_aggregated_spend | consistency_status
------------------------------|-------------|------------|----------------------|------------------------|-------------------
4. Weekly vs Daily Consistency| Belmonte    | 2025-10-07 | 12,345.67            | 12,345.67              | ✅ Match
4. Weekly vs Daily Consistency| Belmonte    | 2025-10-14 | 13,456.78            | 13,456.78              | ✅ Match
```

**If you see mismatches:**
```
Belmonte    | 2025-10-07 | 12,345.67            | 10,234.56              | ⚠️ Mismatch
```

**This is NORMAL and EXPECTED!**

**Why?** Weekly summaries are collected from Meta API (reliable), daily collection may miss some days.

**Action:** No fix needed - weekly summaries are your source of truth.

---

### ✅ Check #5: Non-Monday Weekly Dates (Lines 164-180)

**What it checks:**
- Weekly summaries should ALWAYS start on Monday
- Checks if any weekly records have non-Monday dates

**Expected Result:**
```
5. Non-Monday Weekly Dates
(0 rows returned)
```

**✅ GOOD:** No rows = All weekly dates are Mondays  
**❌ BAD:** Rows returned = Some weeks start on wrong days

**If you see results:**
```
check_name               | client_name | summary_date | day_of_week | validation_status
-------------------------|-------------|--------------|-------------|------------------
5. Non-Monday Weekly Dates| Belmonte   | 2025-11-06   | Wednesday   | ❌ NOT Monday!
5. Non-Monday Weekly Dates| Belmonte   | 2025-11-05   | Tuesday     | ❌ NOT Monday!
```

**Root Cause:**
- Legacy data from before proper weekly date validation
- Daily data mistakenly stored as "weekly"
- Bug in date calculation

**Fix:**
```bash
# Run cleanup script:
scripts/remove-non-monday-weeks.sql
```

---

### ✅ Check #6: Overall System Health (Lines 183-213)

**What it checks:**
- NULL platforms count
- Duplicate records count
- Non-Monday weekly dates count
- Overall health status

**Expected Result:**
```
summary                  | status        | null_platforms | duplicates_found | non_monday_weeks
-------------------------|---------------|----------------|------------------|------------------
6. Overall System Health | ✅ HEALTHY    | 0              | 0                | 0
```

**✅ PERFECT:** All zeros, status = HEALTHY  
**⚠️ NEEDS WORK:** Any non-zero values

**If you see issues:**
```
6. Overall System Health | ⚠️ ISSUES FOUND | 0              | 47               | 23
```

**What this means:**
- `null_platforms: 0` ✅ Platform column working
- `duplicates_found: 47` ❌ 47 duplicate weekly records
- `non_monday_weeks: 23` ❌ 23 weeks with wrong dates

**Fix:** Apply cleanup scripts (detailed below)

---

## 🚨 Issue #1: Cron Job Timing Conflicts {#issue-1}

### The Problem

**Location:** `vercel.json` lines 44-49

Two related jobs run on Sunday with only 2-hour gap:
```json
{
  "path": "/api/automated/collect-monthly-summaries",
  "schedule": "0 1 * * 0"  // Sunday 1:00 AM
},
{
  "path": "/api/automated/collect-weekly-summaries",
  "schedule": "0 3 * * 0"  // Sunday 3:00 AM (only 2 hours later!)
}
```

### Why This Is Bad

1. **Monthly collection** (1:00 AM) may take 30-60 minutes for all clients
2. **Weekly collection** (3:00 AM) starts while monthly still running
3. Both access same database tables
4. **Potential race condition:** Both try to update same records

### Real-World Impact

**Scenario:**
```
1:00 AM → Monthly collection starts (Belmonte, client 1 of 10)
1:30 AM → Monthly still processing (client 5 of 10)
3:00 AM → Weekly collection starts
3:05 AM → Both jobs trying to write to campaign_summaries
3:05 AM → Race condition: which data wins?
```

### The Fix

**File:** `vercel.json`

**BEFORE:**
```json
{
  "path": "/api/automated/collect-monthly-summaries",
  "schedule": "0 1 * * 0"
},
{
  "path": "/api/automated/collect-weekly-summaries",
  "schedule": "0 3 * * 0"
}
```

**AFTER:**
```json
{
  "path": "/api/automated/collect-monthly-summaries",
  "schedule": "0 1 * * 0"
},
{
  "path": "/api/automated/collect-weekly-summaries",
  "schedule": "0 4 * * 0"  // ← Changed from 3:00 to 4:00 AM
}
```

### Step-by-Step

1. **Open file:** `vercel.json`
2. **Find line 48-49** (collect-weekly-summaries)
3. **Change:** `"schedule": "0 3 * * 0"` → `"schedule": "0 4 * * 0"`
4. **Save file**
5. **Commit & push:**
   ```bash
   git add vercel.json
   git commit -m "fix: Add 1-hour gap between Sunday collection jobs"
   git push
   ```
6. **Deploy:** Vercel will auto-deploy

**Time Required:** 5 minutes  
**Risk Level:** ✅ LOW (just schedule change)

---

## 🚨 Issue #2: Duplicate Cleanup Endpoints {#issue-2}

### The Problem

**Location:** `vercel.json` lines 52-54 and 60-62

Two different cleanup jobs scheduled:
```json
{
  "path": "/api/background/cleanup-old-data",
  "schedule": "0 2 * * 6"  // Saturday 2:00 AM (weekly)
},
...
{
  "path": "/api/automated/cleanup-old-data",
  "schedule": "0 4 1 * *"  // 1st of month 4:00 AM (monthly)
}
```

### Why This Is Bad

1. Both endpoints likely clean same data
2. One runs weekly, other monthly = redundant
3. May cause conflicts if both triggered close together
4. Confusing which one is "active"

### Investigation Needed

**Check what each endpoint does:**

```typescript
// File 1: src/app/api/background/cleanup-old-data/route.ts
// File 2: src/app/api/automated/cleanup-old-data/route.ts
```

**Likely scenario:**
- Both delete campaign_summaries older than 12 months
- Both do same cleanup
- One is legacy, one is new

### The Fix

**Recommendation:** Keep the monthly one, remove the weekly one

**File:** `vercel.json`

**DELETE lines 52-54:**
```json
// ❌ DELETE THESE LINES:
{
  "path": "/api/background/cleanup-old-data",
  "schedule": "0 2 * * 6"
},
```

**KEEP lines 60-62:**
```json
// ✅ KEEP THESE LINES:
{
  "path": "/api/automated/cleanup-old-data",
  "schedule": "0 4 1 * *"
}
```

### Step-by-Step

1. **Open file:** `vercel.json`
2. **Find lines 52-54**
3. **Delete entire object** (including comma)
4. **Save file**
5. **Commit & push:**
   ```bash
   git add vercel.json
   git commit -m "fix: Remove duplicate cleanup-old-data cron job"
   git push
   ```

**Time Required:** 2 minutes  
**Risk Level:** ✅ LOW (removing duplicate, not main functionality)

---

## 🚨 Issue #3: Historical Duplicate Weeks {#issue-3}

### The Problem

**What the audit found:**
- Belmonte has 158 weekly summaries
- Expected: ~52 weeks (1 year of data)
- **106 extra records!**

### Root Cause

**Before Migration 043:**
- No UNIQUE constraint on `campaign_summaries`
- Weekly collection ran multiple times
- Each run created NEW record instead of updating

**Example:**
```sql
-- Same week collected multiple times:
2025-10-07 (Monday) → Created at 2025-10-08 03:00:00
2025-10-07 (Monday) → Created at 2025-10-15 03:00:00  (Duplicate!)
2025-10-07 (Monday) → Created at 2025-10-22 03:00:00  (Duplicate!)
```

### Investigation

**Run this query to see duplicates:**

```sql
SELECT 
  c.name,
  cs.summary_date,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(cs.created_at ORDER BY cs.created_at) as when_created,
  ARRAY_AGG(cs.total_spend) as spend_values
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
GROUP BY c.name, cs.summary_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
```

**Expected output:**
```
name      | summary_date | duplicate_count | when_created                           | spend_values
----------|--------------|-----------------|----------------------------------------|-------------------
Belmonte  | 2025-10-07   | 3               | {2025-10-08, 2025-10-15, 2025-10-22}  | {12345, 12345, 12567}
Belmonte  | 2025-10-14   | 2               | {2025-10-15, 2025-10-22}              | {13456, 13456}
```

### The Fix - Script Overview

**File:** `scripts/fix-duplicate-weeks.sql`

**What it does:**
1. Finds all duplicate weekly summaries
2. Keeps ONLY the **most recent** one (latest `created_at`)
3. Deletes older duplicates
4. Adds UNIQUE constraint (if not exists)

### Step-by-Step Fix

#### Step 1: DRY RUN (Preview)

```bash
# In Supabase SQL Editor, run:
scripts/fix-duplicate-weeks.sql
```

**This shows WHAT WILL BE DELETED without actually deleting.**

**Review the output:**
```
total_duplicates_to_delete | affected_clients
---------------------------|------------------
47                         | 3
```

**And see which records:**
```
client_name | summary_date | total_spend | created_at
------------|--------------|-------------|--------------------
Belmonte    | 2025-10-07   | 12,345.67   | 2025-10-08 03:00:00  ← Will DELETE (older)
Belmonte    | 2025-10-14   | 13,456.78   | 2025-10-15 03:00:00  ← Will DELETE (older)
```

#### Step 2: Review & Verify

**Check that:**
- ✅ It's keeping the most recent version
- ✅ Spend values make sense
- ✅ Not deleting current week data

#### Step 3: Execute DELETE

**Open:** `scripts/fix-duplicate-weeks.sql`

**Find line 45-46:**
```sql
-- ⚠️ UNCOMMENT THE FOLLOWING LINES TO ACTUALLY DELETE DUPLICATES:
-- DELETE FROM campaign_summaries
-- WHERE id IN (SELECT id FROM duplicate_weeks_to_delete);
```

**Uncomment (remove `--`):**
```sql
-- ⚠️ UNCOMMENT THE FOLLOWING LINES TO ACTUALLY DELETE DUPLICATES:
DELETE FROM campaign_summaries
WHERE id IN (SELECT id FROM duplicate_weeks_to_delete);
```

**Find line 49-52:**
```sql
-- ⚠️ UNCOMMENT THE FOLLOWING LINE AFTER DELETING DUPLICATES:
-- ALTER TABLE campaign_summaries
-- ADD CONSTRAINT unique_weekly_summary 
-- UNIQUE (client_id, summary_type, summary_date, platform);
```

**Uncomment:**
```sql
-- ⚠️ UNCOMMENT THE FOLLOWING LINE AFTER DELETING DUPLICATES:
ALTER TABLE campaign_summaries
ADD CONSTRAINT unique_weekly_summary 
UNIQUE (client_id, summary_type, summary_date, platform);
```

**Find last line:**
```sql
ROLLBACK; -- Change to COMMIT after reviewing and uncommenting DELETE/ALTER
```

**Change to:**
```sql
COMMIT; -- Changed from ROLLBACK - actually execute the changes
```

#### Step 4: Run Final Script

**In Supabase SQL Editor:**
```sql
\i scripts/fix-duplicate-weeks.sql
```

**Expected output:**
```
DELETE 47
ALTER TABLE
COMMIT
```

#### Step 5: Verify

**Run verification:**
```sql
-- Should return 0 rows:
SELECT 
  client_id,
  summary_date,
  COUNT(*) as count
FROM campaign_summaries
WHERE summary_type = 'weekly'
GROUP BY client_id, summary_date, platform
HAVING COUNT(*) > 1;
```

**Expected:** `(0 rows)`

**Time Required:** 10 minutes  
**Risk Level:** ⚠️ MEDIUM (deleting data - but keeping most recent)

---

## 🚨 Issue #4: Metric Name Inconsistencies {#issue-4}

### The Problem

**Same metric has 3 different names:**

| Database Column | Meta API Field | UI/Frontend | TypeScript Type |
|----------------|----------------|-------------|-----------------|
| `total_spend` | `spend` | `totalSpend` | `totalSpend` |
| `total_impressions` | `impressions` | `totalImpressions` | `totalImpressions` |
| `total_clicks` | `clicks` | `totalClicks` | `totalClicks` |
| `reservations` | `onsite_conversion.book_hotel` | `conversions` | `conversions` |
| `reservation_value` | `action_values.book_hotel` | `conversionValue` | `conversionValue` |

### Why This Is Bad

**Requires constant mapping:**
```typescript
// In code, you see this everywhere:
const apiData = {
  spend: 1000,
  impressions: 50000,
  clicks: 1000
};

// Convert to database format:
const dbRecord = {
  total_spend: apiData.spend,  // Manual mapping
  total_impressions: apiData.impressions,
  total_clicks: apiData.clicks
};

// Convert to UI format:
const uiData = {
  totalSpend: dbRecord.total_spend,  // More manual mapping
  totalImpressions: dbRecord.total_impressions,
  totalClicks: dbRecord.total_clicks
};
```

**Error-prone** - Easy to forget mapping, use wrong field name

### The Fix (Long-term)

**Option A: Standardize on API names** (Recommended)

**Pros:**
- API is the source of truth
- Shorter names (`spend` vs `total_spend`)
- Matches Meta documentation

**Cons:**
- Requires database migration
- Need to update all queries

**Implementation:**
```sql
-- Migration: Rename columns to match API
ALTER TABLE campaign_summaries 
  RENAME COLUMN total_spend TO spend;

ALTER TABLE campaign_summaries 
  RENAME COLUMN total_impressions TO impressions;

ALTER TABLE campaign_summaries 
  RENAME COLUMN total_clicks TO clicks;

-- etc...
```

**Option B: Create TypeScript mapping layer** (Quick fix)

**Pros:**
- No database changes needed
- Can implement immediately

**Cons:**
- Still have multiple names
- Adds abstraction layer

**Implementation:**
```typescript
// Create: src/lib/metric-mapper.ts

interface DatabaseMetrics {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  reservations: number;
  reservation_value: number;
}

interface StandardMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

export function mapDbToStandard(db: DatabaseMetrics): StandardMetrics {
  return {
    spend: db.total_spend,
    impressions: db.total_impressions,
    clicks: db.total_clicks,
    conversions: db.reservations,
    conversionValue: db.reservation_value
  };
}

export function mapStandardToDb(std: StandardMetrics): DatabaseMetrics {
  return {
    total_spend: std.spend,
    total_impressions: std.impressions,
    total_clicks: std.clicks,
    reservations: std.conversions,
    reservation_value: std.conversionValue
  };
}
```

### Recommendation

**For now:** Option B (mapping layer) - quick and safe  
**Long-term:** Option A (rename columns) - cleaner architecture

**Time Required:** 
- Option B: 2 hours
- Option A: 8 hours (migration + testing)

**Risk Level:** 
- Option B: ✅ LOW
- Option A: ⚠️ MEDIUM

---

## 🗺️ Complete Roadmap {#complete-roadmap}

### Week 1: Critical Fixes (Priority: 🚨 CRITICAL)

**Monday (2-3 hours):**

1. **Morning: Run All Verifications**
   ```bash
   # In Supabase SQL Editor:
   \i scripts/verify-no-duplicates.sql
   \i scripts/verify-platform-separation.sql
   \i scripts/verify-cron-job-status.sql
   \i scripts/verify-data-consistency.sql
   ```
   - Document results
   - Take screenshots
   - **Time: 30 minutes**

2. **Late Morning: Fix Cron Timing**
   - Edit `vercel.json`
   - Change weekly collection to 4:00 AM
   - Commit & deploy
   - **Time: 10 minutes**

3. **Afternoon: Fix Duplicate Cleanup**
   - Edit `vercel.json`
   - Remove duplicate cleanup endpoint
   - Commit & deploy
   - **Time: 5 minutes**

4. **End of Day: Duplicate Weeks Cleanup**
   - Run dry run of fix script
   - Review results
   - Execute if looks good
   - Verify with query
   - **Time: 1 hour**

**Tuesday (1 hour):**

5. **Re-run Verifications**
   - Run all 4 verification scripts again
   - Compare with Monday results
   - Document improvements
   - **Time: 30 minutes**

6. **Monitor Cron Jobs**
   - Check Vercel logs
   - Verify no timing conflicts
   - **Time: 30 minutes**

**Deliverables:**
- ✅ Cron jobs properly spaced
- ✅ No duplicate endpoints
- ✅ No duplicate weekly records
- ✅ All verifications passing

---

### Week 2-3: High Priority (Priority: ⚠️ HIGH)

**Goals:**
1. Create metric mapping layer
2. Add monitoring/alerting
3. Document attribution windows

**Task 1: Metric Mapping Layer (4 hours)**

```bash
# Create files:
src/lib/types/standard-metrics.ts  # Type definitions
src/lib/metric-mapper.ts          # Mapping functions
src/lib/metric-validator.ts       # Validation

# Update files:
src/lib/standardized-data-fetcher.ts  # Use mapper
src/app/api/fetch-live-data/route.ts  # Use mapper
src/app/reports/page.tsx              # Use standard types
```

**Task 2: Add Monitoring (3 hours)**

Options:
- **Sentry** (recommended) - Error tracking
- **Datadog** - Full monitoring
- **LogRocket** - Session replay

**Implementation:**
```typescript
// Install:
npm install @sentry/nextjs

// Configure:
sentry.server.config.ts
sentry.client.config.ts
sentry.edge.config.ts

// Add to cron jobs:
await Sentry.captureMessage('Daily KPI collection started');
```

**Task 3: Document Attribution (1 hour)**

```sql
-- Add column:
ALTER TABLE campaign_summaries
ADD COLUMN attribution_window TEXT DEFAULT '7d_click,1d_view';

-- Update existing:
UPDATE campaign_summaries
SET attribution_window = '7d_click,1d_view'
WHERE attribution_window IS NULL;
```

**Deliverables:**
- ✅ Consistent metric names across codebase
- ✅ Error monitoring active
- ✅ Attribution windows documented

---

### Week 4: Medium Priority (Priority: 📋 MEDIUM)

**Goals:**
1. Clean up config files
2. Set up backups
3. Improve documentation

**Task 1: Config Cleanup (30 minutes)**

```bash
# Delete unused files:
rm vercel-unified.json
rm vercel-hobby.json
rm vercel-pro.json

# Add comment to vercel.json:
# This is the PRODUCTION configuration
```

**Task 2: Backup Strategy (2 hours)**

**Supabase Backups:**
- Daily automatic backups (enable in dashboard)
- Point-in-time recovery
- Download backup script

**Create backup script:**
```bash
#!/bin/bash
# backup-database.sh

# Export tables
pg_dump -h db.xxx.supabase.co \
  -U postgres \
  -d postgres \
  -t campaign_summaries \
  -t daily_kpi_data \
  -t clients \
  > backup_$(date +%Y%m%d).sql
```

**Task 3: Documentation (2 hours)**

Create:
- `docs/ARCHITECTURE.md` - System overview
- `docs/CRON_JOBS.md` - Job schedules
- `docs/DATA_FLOW.md` - Data flow diagrams
- `docs/TROUBLESHOOTING.md` - Common issues

**Deliverables:**
- ✅ Clean config files
- ✅ Automated backups
- ✅ Complete documentation

---

## 📊 Progress Tracking

### Checklist

**Week 1: Critical Fixes**
- [ ] Run initial verifications
- [ ] Fix cron timing conflicts
- [ ] Remove duplicate cleanup endpoint
- [ ] Clean up duplicate weeks
- [ ] Re-run verifications
- [ ] Monitor for 48 hours

**Week 2-3: High Priority**
- [ ] Create metric mapping layer
- [ ] Add Sentry monitoring
- [ ] Document attribution windows
- [ ] Test end-to-end
- [ ] Deploy to production

**Week 4: Medium Priority**
- [ ] Delete unused config files
- [ ] Enable Supabase backups
- [ ] Create backup script
- [ ] Write documentation
- [ ] Final system audit

---

## 🎯 Success Metrics

### After Week 1:
```sql
-- All should return 0:
SELECT COUNT(*) as duplicates 
FROM campaign_summaries cs1
WHERE EXISTS (
  SELECT 1 FROM campaign_summaries cs2
  WHERE cs2.client_id = cs1.client_id
    AND cs2.summary_date = cs1.summary_date
    AND cs2.summary_type = cs1.summary_type
    AND cs2.platform = cs1.platform
    AND cs2.id != cs1.id
);
-- Expected: 0

SELECT COUNT(*) as non_monday_weeks
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1;
-- Expected: 0
```

### After Week 2-3:
- ✅ Error monitoring shows 0 critical errors
- ✅ All cron jobs run successfully for 7 days straight
- ✅ Metric names consistent across codebase

### After Week 4:
- ✅ Only 1 vercel.json file exists
- ✅ Daily backups running
- ✅ Complete documentation in place
- ✅ System audit score: 95%+

---

## 🆘 Troubleshooting

### "Verification script shows mismatches"
→ This is often NORMAL - see individual check explanations above

### "Delete failed: foreign key constraint"
→ Check if records are referenced elsewhere, may need CASCADE delete

### "Cron jobs still conflicting"
→ Check Vercel logs for actual execution times, may need bigger gap

### "Can't add UNIQUE constraint"
→ Duplicates still exist, re-run duplicate detection query

---

## 📞 Support Resources

- **Full Audit:** `🔍_COMPREHENSIVE_PRODUCTION_AUDIT_REPORT.md`
- **Quick Start:** `🎯_AUDIT_QUICK_START_GUIDE.md`
- **Executive Summary:** `📊_EXECUTIVE_AUDIT_SUMMARY.md`
- **This Roadmap:** `🛠️_ISSUE_RESOLUTION_ROADMAP.md`

---

**Created:** November 20, 2025  
**Total Time Investment:** 15-20 hours over 4 weeks  
**Expected Outcome:** 95%+ production-ready system



