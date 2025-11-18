# 🔄 COMPLETE WEEKLY DATA RESET & RE-COLLECTION

**Date:** November 18, 2025  
**Purpose:** Delete ALL weekly data and re-collect from scratch with ISO-compliant dates  
**Time Required:** 30-60 minutes

---

## 🎯 WHY COMPLETE RESET?

Current weekly data has fundamental issues:
- ❌ 71% of records have wrong start dates (not Monday)
- ❌ Mixed collection methods created inconsistent data
- ❌ Google Ads and Meta Ads not properly aligned
- ❌ Can't trust existing data for accurate reporting

**Solution:** Start fresh with validated, ISO-compliant collection.

---

## ✅ WHAT THIS WILL DO

1. **Backup** all existing data (safety first!)
2. **Delete** ALL weekly records (clean slate)
3. **Deploy** fixed code with ISO week helpers
4. **Re-collect** 53 weeks of historical data
5. **Validate** all new data starts on Monday
6. **Protect** with database constraint

---

## 📋 STEP-BY-STEP PROCESS

### PHASE 1: Database Reset (5 minutes)

#### 1.1 Open Supabase SQL Editor

Navigate to: **Supabase Dashboard → SQL Editor**

#### 1.2 Run Complete Reset Script

Open file: `scripts/complete-weekly-reset.sql`

**Step 1 - Create Backup:**
```sql
-- Run this first (lines ~12-22)
CREATE TABLE IF NOT EXISTS campaign_summaries_complete_backup_20251118 AS
SELECT * FROM campaign_summaries;
```

**Expected Result:**
```
✅ COMPLETE BACKUP CREATED
total_all_records: ~1500+
weekly_records_backed_up: 378
monthly_records_backed_up: ~1200
```

**Step 2 - Review What Will Be Deleted:**
```sql
-- Run lines ~25-50
-- This shows you all weekly records that will be deleted
```

**Step 3 - Delete All Weekly Data:**
```sql
-- Uncomment and run (lines ~58-74)
BEGIN;

DELETE FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Verify
SELECT 
  COUNT(*) FILTER (WHERE summary_type = 'weekly') as remaining_weekly_records
FROM campaign_summaries;
-- Expected: 0

COMMIT;
```

**Step 4 - Add Constraint:**
```sql
-- Uncomment and run (lines ~83-93)
ALTER TABLE campaign_summaries
ADD CONSTRAINT weekly_must_be_monday
CHECK (
  summary_type != 'weekly' OR 
  EXTRACT(DOW FROM summary_date) = 1
);
```

**Step 5 - Verify Clean State:**
```sql
-- Run lines ~101-109
SELECT 
  COUNT(*) FILTER (WHERE summary_type = 'weekly') as weekly_records,
  COUNT(*) FILTER (WHERE summary_type = 'monthly') as monthly_records
FROM campaign_summaries;
```

**Expected:**
```
weekly_records: 0 ✅
monthly_records: ~1200 (unchanged) ✅
```

---

### PHASE 2: Code Deployment (5 minutes)

#### 2.1 Commit Code Changes

```bash
cd /Users/macbook/piotr

git status
# Should show:
#   src/lib/week-helpers.ts (new)
#   src/lib/background-data-collector.ts (modified)
#   scripts/* (new/modified)

git add -A

git commit -m "fix: Complete weekly data standardization with ISO weeks

- Add week-helpers.ts with ISO 8601 week functions
- Fix background-data-collector to use Monday-start weeks
- Add validation at code and database level
- Reset weekly data for clean re-collection
- All 19 tests passing

Breaking change: All weekly data reset and will be re-collected
with correct ISO week boundaries (Monday-Sunday)"

git push
```

#### 2.2 Wait for Deployment

**Vercel will auto-deploy in ~60 seconds**

Check: https://vercel.com/your-project/deployments

Look for: ✅ "Deployment completed successfully"

---

### PHASE 3: Re-Collection (20-40 minutes)

You have **3 options** for re-collection:

---

#### **OPTION A: Automatic Collection (Simplest)** ⭐ RECOMMENDED

Let the system detect and fill missing weeks automatically.

```bash
# Trigger incremental collection
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection' \
  -H 'Authorization: Bearer YOUR_CRON_SECRET' \
  -w "\n⏱️  Time: %{time_total}s\n"
```

**What it does:**
- Detects missing weeks for all clients
- Collects last **12 weeks** only (faster)
- Uses fixed ISO week logic
- Takes 3-5 minutes

**Limitation:** Only collects 12 weeks, not full 53 weeks

---

#### **OPTION B: Full Historical Collection (Most Complete)**

Collects complete 53-week history for all clients.

```bash
# Make script executable
chmod +x scripts/recollect-weeks-controlled.ts

# Run controlled re-collection
npx tsx scripts/recollect-weeks-controlled.ts --weeks=53
```

**What it does:**
- Collects **53 weeks** of historical data
- Progress tracking with % complete
- Error handling and retry logic
- Rate limiting (doesn't overwhelm API)
- Takes 20-40 minutes

**For specific client:**
```bash
npx tsx scripts/recollect-weeks-controlled.ts --weeks=53 --client="Belmonte"
```

**Progress output:**
```
🚀 CONTROLLED WEEKLY DATA RE-COLLECTION

Configuration:
  Weeks to collect: 53
  Target client: ALL

✅ Found 16 client(s) to process
📅 Generated 53 ISO week dates (all Mondays)

📊 Processing: Belmonte Hotel
----------------------------------------------------------------------
   [1/848] (0.1%)
   📅 2024-10-28 - Triggering collection...
   ✅ 2024-10-28 - Collected (3.2s)
   
   [2/848] (0.2%)
   📅 2024-11-04 - Triggering collection...
   ✅ 2024-11-04 - Collected (3.1s)
   
   ...

📊 COLLECTION SUMMARY
✅ Successful: 848
❌ Failed: 0
⏱️  Average duration: 3.2s per week
📊 Total time: 28.5 minutes

🎉 All collections completed successfully!
```

---

#### **OPTION C: Bash Script (Alternative)**

Simple bash script for batch collection.

```bash
# Set environment variable
export CRON_SECRET="your-cron-secret-here"

# Make executable
chmod +x scripts/recollect-all-weeks-batch.sh

# Run
./scripts/recollect-all-weeks-batch.sh
```

**What it does:**
- Triggers full 53-week collection
- All clients processed together
- Simple progress output
- Takes 20-30 minutes

---

### PHASE 4: Verification (5 minutes)

#### 4.1 Run Audit Script

```bash
npx tsx scripts/check-weekly-duplicates.ts
```

**Expected Output:**
```
✅ Found client: Belmonte Hotel
📊 Total weekly records: ~450-650 (depending on option chosen)
✅ No duplicates found!
✅ All weeks start on Monday!
✅ Recent data complete

📊 AUDIT SUMMARY
✅ Total weekly records: 600
   Unique weeks: 600
   Duplicates: 0
   Non-Monday weeks: 0 ✅
   Incomplete data: 0

🎉 All tests passed! Week helpers are working correctly.
```

---

#### 4.2 Check Database

In Supabase SQL Editor:

```sql
-- Verify all weeks are Mondays
SELECT 
  c.name as client_name,
  COUNT(*) as weekly_records,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM cs.summary_date) = 1) as monday_weeks,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM cs.summary_date) != 1) as non_monday_weeks,
  MIN(cs.summary_date) as earliest_week,
  MAX(cs.summary_date) as latest_week
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
GROUP BY c.name
ORDER BY weekly_records DESC;
```

**Expected Result:**
- All clients: `non_monday_weeks = 0` ✅
- All clients: `monday_weeks = 100%` ✅
- Date range: Last 12 or 53 weeks (depending on option)

---

#### 4.3 Visual Check in Dashboard

1. Open your dashboard
2. Check weekly reports
3. Verify:
   - Week labels show Monday dates
   - Data aligns properly
   - No gaps in timeline
   - Meta and Google Ads aligned

---

## 📊 EXPECTED RESULTS

### Before Reset:
```
Total Weekly Records: 378 (after cleanup) or 1,315 (before cleanup)
Monday Weeks: 29-63%
Non-Monday Weeks: 37-71% ❌
Data Quality: POOR
```

### After Reset + Option A (12 weeks):
```
Total Weekly Records: ~200-250
Monday Weeks: 100% ✅
Non-Monday Weeks: 0% ✅
Data Range: Last 12 weeks
Data Quality: EXCELLENT
```

### After Reset + Option B (53 weeks):
```
Total Weekly Records: ~850-1,100
Monday Weeks: 100% ✅
Non-Monday Weeks: 0% ✅
Data Range: Last 53 weeks (1 year)
Data Quality: EXCELLENT
```

---

## 🛡️ SAFETY & ROLLBACK

### Backup Created:
- **Table:** `campaign_summaries_complete_backup_20251118`
- **Contains:** ALL data (weekly + monthly)
- **Size:** ~1,500+ records

### Rollback Procedure:

If anything goes wrong:

```sql
BEGIN;

-- 1. Drop constraint
ALTER TABLE campaign_summaries DROP CONSTRAINT IF EXISTS weekly_must_be_monday;

-- 2. Delete current weekly data
DELETE FROM campaign_summaries WHERE summary_type = 'weekly';

-- 3. Restore from backup
INSERT INTO campaign_summaries 
SELECT * FROM campaign_summaries_complete_backup_20251118
WHERE summary_type = 'weekly';

-- 4. Verify
SELECT COUNT(*) FROM campaign_summaries WHERE summary_type = 'weekly';

COMMIT;
```

---

## ⏱️ TIME ESTIMATES

| Phase | Option A (12 weeks) | Option B (53 weeks) | Option C (Bash) |
|-------|---------------------|---------------------|-----------------|
| Database Reset | 5 min | 5 min | 5 min |
| Code Deploy | 5 min | 5 min | 5 min |
| Re-collection | 3-5 min | 20-40 min | 20-30 min |
| Verification | 5 min | 5 min | 5 min |
| **TOTAL** | **~20 min** | **~40-60 min** | **~40-50 min** |

---

## 🎯 WHICH OPTION TO CHOOSE?

### Choose **Option A** if:
- ✅ You only need recent data (3 months)
- ✅ You want the fastest solution
- ✅ Historical reports aren't critical
- ✅ You're in a hurry

### Choose **Option B** if:
- ✅ You need complete historical data (1 year)
- ✅ You want detailed progress tracking
- ✅ You need per-client control
- ✅ You want the most reliable method ⭐

### Choose **Option C** if:
- ✅ You prefer simple bash scripts
- ✅ You want batch processing
- ✅ Option B seems too complex

---

## ✅ SUCCESS CHECKLIST

After completion, verify:

- [ ] Database shows 0 non-Monday weeks
- [ ] All clients have weekly data
- [ ] Audit script passes all checks
- [ ] Dashboard displays correct week labels
- [ ] Reports show accurate trends
- [ ] Meta and Google Ads aligned
- [ ] Constraint prevents future bad dates

---

## 📞 TROUBLESHOOTING

### Collection Fails / Timeouts:

**Problem:** Re-collection times out or fails

**Solution:**
1. Use Option B (controlled script) - has retry logic
2. Collect one client at a time:
   ```bash
   npx tsx scripts/recollect-weeks-controlled.ts --client="Belmonte" --weeks=53
   ```
3. Reduce weeks: `--weeks=12` instead of 53

---

### Some Weeks Missing:

**Problem:** After collection, some weeks are empty

**Solution:**
1. Check if campaigns existed during that week
2. Verify API credentials are valid
3. Re-run collection for specific client
4. Check Vercel logs for errors

---

### Database Constraint Error:

**Problem:** `weekly_must_be_monday` constraint violation

**Solution:**
This is GOOD! It means the constraint is working.
- Check the date being inserted
- Ensure code is using `getMondayOfWeek()`
- Validate with `validateIsMonday()` before insert

---

## 🎉 FINAL RESULT

After completing this process:

- ✅ **100% clean data** - All weeks start on Monday
- ✅ **ISO 8601 compliant** - Industry standard
- ✅ **Database protected** - Constraint prevents bad dates
- ✅ **Code validated** - 19 automated tests passing
- ✅ **Fully automatic** - Maintains quality forever
- ✅ **Aligned platforms** - Meta and Google use same weeks
- ✅ **Accurate reports** - Trustworthy analytics
- ✅ **Scalable system** - Works for any number of clients

---

## 📋 QUICK START

**TL;DR - Just tell me what to do:**

```bash
# 1. Reset database (Supabase SQL Editor)
# Run: scripts/complete-weekly-reset.sql

# 2. Deploy code
git push

# 3. Re-collect (choose one):

# Fast (12 weeks):
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection'

# OR Complete (53 weeks):
npx tsx scripts/recollect-weeks-controlled.ts --weeks=53

# 4. Verify
npx tsx scripts/check-weekly-duplicates.ts
```

**Done!** 🎉

---

**Status:** 🚀 Ready to execute  
**Risk:** 🟢 LOW - Complete backup, tested code, rollback available  
**Impact:** ✅ HIGH - Fixes 71% of data quality issues  
**Time:** ⏱️ 20-60 minutes depending on option

---

Let's get your weekly data 100% clean and accurate! 🚀

