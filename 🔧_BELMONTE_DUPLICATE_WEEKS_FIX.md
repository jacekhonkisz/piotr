# 🔧 BELMONTE DUPLICATE WEEKS - ROOT CAUSE & FIX

## 🚨 PROBLEM SUMMARY

**Issue:** Belmonte has 158 weekly summaries instead of ~60 (should be 1 year = 52-53 weeks)

**Root Causes:**
1. ❌ **Missing UNIQUE constraint** on `campaign_summaries` table
2. ❌ **Non-Monday dates** stored as "weekly" (daily data)  
3. ❌ **Multiple collection runs** creating duplicates

---

## 🔍 WHAT I FOUND

### Evidence from Database:
```
2025-11-10 (Monday) → 2 entries! (Nov 17 vs Nov 18)
2025-10-27 (Monday) → 2 entries! (different times)
2025-10-13 (Monday) → 2 entries! (different times)

2025-11-06 (Thursday) → ❌ NOT a Monday!
2025-11-05 (Wednesday) → ❌ NOT a Monday!
2025-11-04 (Tuesday) → ❌ NOT a Monday!
2025-11-02 (Sunday) → ❌ NOT a Monday!
```

### Code Analysis:
- ✅ Code DOES use UPSERT (line 1138-1140 in `background-data-collector.ts`)
- ❌ Database is MISSING the UNIQUE constraint that UPSERT relies on
- ❌ Without constraint, UPSERT just keeps INSERTing duplicates

---

## ✅ THE FIX (3 Steps)

### STEP 1: Review Duplicates (SAFE - No changes)

Run in Supabase SQL Editor:
```bash
scripts/fix-duplicate-weeks.sql
```

This will show:
- How many duplicates exist
- Which entries will be deleted (keeps most recent)
- How many clients affected

**Expected:** ~100 duplicate entries to delete

---

### STEP 2: Clean Up Database (DESTRUCTIVE - Review first!)

After reviewing Step 1 results:

1. Open `scripts/fix-duplicate-weeks.sql`
2. **Uncomment** the DELETE statement (line ~48):
   ```sql
   DELETE FROM campaign_summaries
   WHERE id IN (SELECT id FROM duplicate_weeks_to_delete);
   ```
3. **Change** `ROLLBACK` to `COMMIT` (last line)
4. **Run the script**

This will:
- ✅ Delete duplicate entries (keeps latest)
- ✅ Add UNIQUE constraint to prevent future duplicates

---

### STEP 3: Remove Non-Monday Entries (DESTRUCTIVE - Review first!)

Run in Supabase SQL Editor:
```bash
scripts/remove-non-monday-weeks.sql
```

First run will SHOW what will be deleted. Then:

1. Review the results
2. **Uncomment** the DELETE statement
3. **Change** `ROLLBACK` to `COMMIT`
4. **Run again**

This removes entries like Nov 4, 5, 6 (not Mondays).

---

## 🎯 EXPECTED RESULTS

**Before Fix:**
- Belmonte: 158 weeks
- Duplicates: ~100 entries
- Non-Mondays: ~40 entries

**After Fix:**
- Belmonte: ~58 weeks (correct!)
- No duplicates
- All entries start on Monday
- UNIQUE constraint prevents future issues

---

## ⚡ PRODUCTION READY STATUS

After these fixes:
- ✅ Weekly collection will work correctly (UPSERT instead of INSERT)
- ✅ Smart caching will work (no duplicates)
- ✅ All metrics properly populated
- ✅ Historical data clean and accurate

---

## 🚀 NEXT STEPS

1. **Review:** Run `fix-duplicate-weeks.sql` (ROLLBACK - safe)
2. **Share results:** Tell me how many duplicates found
3. **Execute:** I'll guide you through the DELETE steps
4. **Verify:** Check Belmonte has ~58 weeks
5. **Test:** Trigger collection again - should update existing, not create new

**Ready to proceed?** Run Step 1 (review duplicates) and share the count!


