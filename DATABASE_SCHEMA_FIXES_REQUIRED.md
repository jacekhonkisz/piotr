# 🔧 DATABASE SCHEMA FIXES REQUIRED

**Date:** November 7, 2025  
**Status:** 2 critical schema issues found and fixes ready

---

## 📊 CURRENT SITUATION

**Collection Status:**
- ✅ Completed all 16 clients
- ⚠️ Only 1,332 / 1,950 records saved (68.3%)
- ❌ 618 records lost due to database errors
- ❌ 64 collection errors logged

**Why Collection Stopped at 1,332:**
Database schema has **2 critical issues** preventing data from being saved.

---

## 🚨 ISSUE #1: Missing Column (FIXED ✅)

### Problem:
Missing `google_ads_tables` column

### Error:
```
Could not find the 'google_ads_tables' column of 'campaign_summaries' in the schema cache
```

### Fix Applied:
```sql
ALTER TABLE campaign_summaries
ADD COLUMN IF NOT EXISTS google_ads_tables JSONB;
```

**Status:** ✅ **FIXED** - Column added and working

---

## 🚨 ISSUE #2: Wrong Column Data Types (NEEDS FIX ❌)

### Problem:
7 columns are defined as `BIGINT` (integers) but need to store **decimal values**

### Error:
```
invalid input syntax for type bigint: "33.973622"
invalid input syntax for type bigint: "84.026378"
invalid input syntax for type bigint: "515.995236"
```

### Affected Columns:
1. `total_spend` - Should store $33.97, not 33
2. `average_ctr` - Should store 2.45%, not 2
3. `average_cpc` - Should store $1.23, not 1
4. `average_cpa` - Should store $45.99, not 45
5. `roas` - Should store 3.25, not 3
6. `cost_per_reservation` - Should store $89.50, not 89
7. `reservation_value` - Should store $150.75, not 150

### Impact:
- Google Ads data fails to save when values have decimals
- ~618 records could not be saved
- Collection appears complete but data is missing

### Fix Required:
Run SQL script: `FIX_COLUMN_TYPES_TO_NUMERIC.sql`

```sql
-- Convert all 7 columns from BIGINT to NUMERIC
ALTER TABLE campaign_summaries ALTER COLUMN total_spend TYPE NUMERIC USING total_spend::NUMERIC;
ALTER TABLE campaign_summaries ALTER COLUMN average_ctr TYPE NUMERIC USING average_ctr::NUMERIC;
ALTER TABLE campaign_summaries ALTER COLUMN average_cpc TYPE NUMERIC USING average_cpc::NUMERIC;
ALTER TABLE campaign_summaries ALTER COLUMN average_cpa TYPE NUMERIC USING average_cpa::NUMERIC;
ALTER TABLE campaign_summaries ALTER COLUMN roas TYPE NUMERIC USING roas::NUMERIC;
ALTER TABLE campaign_summaries ALTER COLUMN cost_per_reservation TYPE NUMERIC USING cost_per_reservation::NUMERIC;
ALTER TABLE campaign_summaries ALTER COLUMN reservation_value TYPE NUMERIC USING reservation_value::NUMERIC;
```

**Status:** ❌ **NEEDS TO BE RUN**

---

## 🎯 ACTION PLAN

### Step 1: Run SQL Fix (1 minute) ⚠️ CRITICAL

**File:** `FIX_COLUMN_TYPES_TO_NUMERIC.sql`

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy entire content from `FIX_COLUMN_TYPES_TO_NUMERIC.sql`
4. Execute
5. Verify all 7 columns show `data_type = 'numeric'`

**Time:** < 1 minute

### Step 2: Restart Server (30 seconds)

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

**Why:** Server needs to reload schema cache

### Step 3: Re-trigger Collection (60 minutes)

```bash
curl -X POST http://localhost:3000/api/automated/collect-weekly-summaries \
  -H "Content-Type: application/json"
```

**Expected:** Will collect the missing 618 records

### Step 4: Monitor Progress

```bash
node scripts/check-collection-status.js
```

Check every 10 minutes to see progress

### Step 5: Verify 100% Coverage

After ~60 minutes:
```bash
node scripts/audit-4-categories.js
```

**Expected Result:** 1,950 / 1,950 records (100%)

---

## 📈 EXPECTED OUTCOMES

### After Fix #2:

**Before:**
- Total: 1,332 / 1,950 (68.3%)
- Errors: 64 failed collections
- Status: Incomplete

**After:**
- Total: 1,950 / 1,950 (100%) ✅
- Errors: 0 failed collections ✅
- Status: Complete ✅

### Breakdown by Category:
- Meta Weekly: 848 records ✅
- Meta Monthly: 192 records ✅
- Google Weekly: 742 records ✅
- Google Monthly: 168 records ✅

**All 16 clients:** 100% coverage

---

## 🔍 WHY THIS HAPPENED

### Root Causes:

1. **Schema Evolution:**
   - Database created with basic integer types
   - Google Ads integration added later
   - Decimal precision needed for accurate financial data
   - Database migrations not run for new requirements

2. **Error Handling:**
   - Errors caught silently by try/catch
   - Collection continued despite failures
   - No alerts for high error rates
   - Appeared successful but data was lost

3. **Testing Gaps:**
   - Initial testing used round numbers
   - Decimal values not tested end-to-end
   - Schema validation not in CI/CD
   - Production issues not caught before deployment

---

## ✅ VERIFICATION CHECKLIST

### After Running Fix:

- [ ] Run `FIX_COLUMN_TYPES_TO_NUMERIC.sql` in Supabase
- [ ] Verify 7 columns changed to NUMERIC
- [ ] Restart dev server
- [ ] Trigger collection
- [ ] Wait 60 minutes
- [ ] Check total: 1,950 records
- [ ] Verify no new errors in logs
- [ ] Test with decimal values (e.g., $33.97)
- [ ] Confirm all 4 categories at 100%

---

## 📝 LESSONS LEARNED

### Database Design:
1. Use NUMERIC for all monetary values
2. Use NUMERIC for all percentage values
3. Test with realistic decimal values
4. Run schema validation before deployment

### Error Handling:
5. Log all database errors prominently
6. Alert on collection error rates
7. Track success vs. failure metrics
8. Don't silently continue on data loss

### Testing:
9. Test with production-like data
10. Verify decimal precision
11. Test entire data pipeline end-to-end
12. Include database schema in tests

---

## 🚀 PRIORITY

**CRITICAL:** Run `FIX_COLUMN_TYPES_TO_NUMERIC.sql` NOW

Without this fix:
- ❌ 68% of data will remain missing
- ❌ Monday's automated job will fail the same way
- ❌ All future collections will lose data

With this fix:
- ✅ 100% coverage achievable
- ✅ Automated jobs will work
- ✅ Production-ready system

**Time to fix:** 1 minute SQL + 60 minutes collection = **61 minutes total**

---

**Created:** November 7, 2025, 2:00 PM  
**Status:** FIX #1 applied ✅, FIX #2 ready to apply ❌  
**Next Action:** Run `FIX_COLUMN_TYPES_TO_NUMERIC.sql`



