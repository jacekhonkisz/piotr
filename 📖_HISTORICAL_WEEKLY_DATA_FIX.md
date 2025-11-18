# 📖 HISTORICAL WEEKLY DATA - COMPLETE FIX GUIDE

**Focus:** Historical weekly reports (completed weeks)  
**Ignore:** Current week (has its own cache system)  
**Goal:** Clean historical data and re-collect with ISO weeks

---

## 🎯 UNDERSTANDING THE SYSTEM

### Two Separate Systems:

```
1. CURRENT WEEK DATA (Live/In-Progress)
   Source: current_week_cache table
   Updates: Real-time, multiple times per day
   Purpose: Dashboard showing THIS week's performance
   Status: ✅ Leave this alone - it works correctly

2. HISTORICAL WEEKLY DATA (Completed Weeks)
   Source: campaign_summaries table (summary_type='weekly')
   Updates: Once per week, via batch collection
   Purpose: Reports showing PAST weeks (like "10.11 - 16.11.2025")
   Status: ❌ This is what we're fixing
```

---

## 🔍 STEP 1: CHECK CURRENT STATE

Run in Supabase SQL Editor: `scripts/check-historical-weekly-data.sql`

This will show:
1. How many historical weekly records exist
2. Sample of the data
3. When it was created (to see if auto-collection ran)
4. Monday vs non-Monday breakdown

**Look for:**
- Created dates: If TODAY → auto-collection ran after your deletion
- Record count: If > 0 → data still exists
- Non-Monday count: If > 0 → bad data still there

---

## 🗑️ STEP 2: DELETE HISTORICAL WEEKLY DATA

Run in Supabase SQL Editor: `scripts/delete-historical-weekly-only.sql`

**Execute in order:**

### 2.1 Create Backup
```sql
-- Run Step 1 in the script
CREATE TABLE IF NOT EXISTS historical_weekly_backup AS
SELECT * FROM campaign_summaries
WHERE summary_type = 'weekly';
```

### 2.2 Preview Deletion
```sql
-- Run Step 2 in the script
-- Review what will be deleted
```

### 2.3 Execute Deletion
```sql
-- Uncomment and run Step 3
BEGIN;

DELETE FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Verify
SELECT COUNT(*) FROM campaign_summaries WHERE summary_type = 'weekly';
-- Should show: 0

COMMIT;
```

### 2.4 Add Protection
```sql
-- Uncomment and run Step 5
ALTER TABLE campaign_summaries
ADD CONSTRAINT weekly_must_be_monday
CHECK (
  summary_type != 'weekly' OR 
  EXTRACT(DOW FROM summary_date) = 1
);
```

---

## 🚀 STEP 3: DEPLOY FIXED CODE

```bash
cd /Users/macbook/piotr

# Check status
git status

# Add all changes
git add -A

# Commit
git commit -m "fix: ISO week standardization for historical weekly data

- Add week-helpers.ts with ISO 8601 week functions
- Fix background-data-collector to use Monday-start weeks
- Add validation at code and database level
- Historical weekly data cleaned and ready for re-collection"

# Push
git push

# Wait ~60 seconds for Vercel deployment
```

---

## 🔄 STEP 4: RE-COLLECT HISTORICAL DATA

After code is deployed, choose ONE option:

### Option A: Last 12 Weeks (Fast - Recommended)

```bash
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection' \
  -H 'Authorization: Bearer YOUR_CRON_SECRET'
```

**Time:** 3-5 minutes  
**Coverage:** Last 12 weeks for all clients  
**Good for:** Quick fix, recent history

---

### Option B: Full 53 Weeks (Complete)

```bash
npx tsx scripts/recollect-weeks-controlled.ts --weeks=53
```

**Time:** 20-40 minutes  
**Coverage:** Full year of history  
**Good for:** Complete historical data

---

## ✅ STEP 5: VERIFY

### 5.1 Check Database

```sql
-- In Supabase SQL Editor
SELECT 
  COUNT(*) as total_weekly,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM summary_date) = 1) as monday_weeks,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM summary_date) != 1) as non_monday
FROM campaign_summaries
WHERE summary_type = 'weekly';
```

**Expected:**
- `monday_weeks` = 100% of total ✅
- `non_monday` = 0 ✅

### 5.2 Check Reports Page

1. Open `/reports` in your browser
2. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R)
3. Select a historical week (like "10.11 - 16.11.2025")
4. Verify:
   - Shows correct data for that specific week
   - Week label shows Monday date
   - Data is different from other weeks

### 5.3 Run Audit Script

```bash
npx tsx scripts/check-weekly-duplicates.ts
```

**Expected:**
```
✅ No duplicates
✅ All weeks start on Monday
✅ Data complete
```

---

## 🔍 WHY ARE YOU SEEING OLD DATA?

If you still see old data after deletion, it's likely:

### Cause 1: Auto-Collection Ran Immediately

**What happened:**
1. You deleted historical weekly data at 18:00
2. Cron job ran at 18:00:30 (scheduled Monday 2 AM, but runs more often)
3. System detected missing weeks
4. Re-collected with OLD code (before your fixes)
5. Created new records with wrong dates

**Solution:**
1. Delete again
2. FIRST push fixed code
3. THEN re-collect with new code

---

### Cause 2: Transaction Not Committed

**What happened:**
- You ran DELETE but didn't COMMIT
- Or ran in a transaction that was rolled back

**Solution:**
- Wrap in BEGIN/COMMIT:
```sql
BEGIN;
DELETE FROM campaign_summaries WHERE summary_type = 'weekly';
COMMIT;
```

---

### Cause 3: Browser Cache

**What happened:**
- Reports page cached old API responses
- Browser showing stale data

**Solution:**
- Hard refresh: Ctrl+Shift+R
- Or clear browser cache completely

---

## 📊 EXPECTED TIMELINE

| Step | Action | Time |
|------|--------|------|
| 1 | Check current state | 2 min |
| 2 | Delete historical data | 3 min |
| 3 | Deploy fixed code | 2 min |
| 4 | Re-collect (Option A) | 5 min |
| 4 | Re-collect (Option B) | 30 min |
| 5 | Verify | 5 min |
| **Total** | **Option A** | **~15 min** |
| **Total** | **Option B** | **~45 min** |

---

## 🛡️ SAFETY

- ✅ Backup created before deletion
- ✅ Rollback procedure available
- ✅ Monthly data untouched
- ✅ Current week cache untouched
- ✅ Only historical weekly data affected

---

## 🎯 SUCCESS CRITERIA

After completion:

- [ ] Historical weekly data deleted from `campaign_summaries`
- [ ] Fixed code deployed to Vercel
- [ ] Database constraint added (`weekly_must_be_monday`)
- [ ] Historical data re-collected with ISO weeks
- [ ] All weeks start on Monday (100%)
- [ ] Reports show different data for different weeks
- [ ] No duplicates found
- [ ] Audit script passes

---

## 📞 TROUBLESHOOTING

### "I deleted but data is still there"

**Check if auto-collection ran:**
```sql
SELECT 
  DATE(created_at) as when_created,
  COUNT(*) as records
FROM campaign_summaries
WHERE summary_type = 'weekly'
GROUP BY DATE(created_at)
ORDER BY when_created DESC;
```

If you see today's date → auto-collection ran.  
**Solution:** Deploy code first, THEN delete and re-collect.

---

### "Reports still show old data"

1. Hard refresh browser: Ctrl+Shift+R
2. Check database:
   ```sql
   SELECT COUNT(*) FROM campaign_summaries WHERE summary_type = 'weekly';
   ```
3. If count > 0 → data not deleted
4. If count = 0 → browser cache issue

---

### "Re-collection failed"

Check Vercel logs for errors.  
Common issues:
- API credentials expired
- Rate limiting
- Network timeout

**Solution:** Re-run collection for specific client:
```bash
npx tsx scripts/recollect-weeks-controlled.ts --client="Belmonte" --weeks=12
```

---

## 🎉 FINAL RESULT

Once complete, you'll have:

- ✅ Clean historical weekly data (100% ISO-compliant)
- ✅ All weeks start on Monday
- ✅ Accurate historical reports
- ✅ System protected against future bad data
- ✅ Automatic collection maintains quality

---

**Ready? Start with Step 1: Check Current State** 🚀

Run: `scripts/check-historical-weekly-data.sql` in Supabase SQL Editor

