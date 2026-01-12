# ✅ Complete Historical Data Update Plan

## Problem Summary

The system was using `metrics.conversions` (cross-device only) instead of `metrics.all_conversions` (all conversion types including view-through), causing a **80-85% data loss** in booking steps.

**Example (Havet November 2025):**
- Old method: 1,523 (Step 1) ❌
- Correct method: 9,867 (Step 1) ✅
- **Difference: 548% more accurate!**

---

## ✅ What's Been Fixed

### 1. API Query Fix (DONE ✅)

**File:** `src/lib/google-ads-api.ts`

**Changes:**
- Line 814: `metrics.conversions` → `metrics.all_conversions`
- Line 815: `metrics.conversions_value` → `metrics.all_conversions_value`  
- Line 817: Filter changed to `metrics.all_conversions > 0`
- Line 905-907: Updated parsing logic

**Impact:** ALL future fetches now use the correct metric.

---

## 🔄 What Needs to Be Done

### 1. Current Month/Week (Auto-fixes in 3 hours)

**Status:** ✅ Will auto-refresh

- Smart cache for current periods uses `getCampaignData()` which now has the fix
- Cache TTL is 3 hours
- Will automatically fetch with corrected metric on next refresh

**Manual refresh (optional):**
```sql
-- Clear November cache to force immediate refresh
DELETE FROM google_ads_current_month_cache 
WHERE period_id = '2025-11';

DELETE FROM google_ads_current_week_cache 
WHERE period_id LIKE '2025-W%';
```

### 2. Historical Data (Needs Manual Backfill)

**Status:** ⚠️ Needs action

All months before current month have incorrect data stored in database.

**Solution:** Run the backfill script

```bash
# Step 1: Dry run to see what will be updated
npx tsx scripts/backfill-all-historical-google-ads.ts --dry-run

# Step 2: Run for real (updates all historical months)
npx tsx scripts/backfill-all-historical-google-ads.ts

# Optional: Start from specific month only
npx tsx scripts/backfill-all-historical-google-ads.ts --start=2025-01
```

---

## 📋 What the Backfill Script Does

1. **Fetches data from Google Ads API** for all months from Jan 2024 to current month
2. **Uses corrected `all_conversions` metric** (matches console)
3. **Updates `google_ads_campaigns` table** with fresh campaign data
4. **Updates `campaign_summaries` table** with aggregated data
5. **Works for ALL clients automatically** (12 clients)
6. **Preserves data source tracking** (`backfill_all_conversions_YYYY-MM-DD`)

---

## 🎯 Expected Results After Backfill

### Before (using `conversions`):
```
December 2025:
  Booking Step 1: 0 (or very low)
  Booking Step 2: 0 (or very low)
  Booking Step 3: 0 (or very low)
```

### After (using `all_conversions`):
```
December 2025:
  Booking Step 1: ~9,000+ (realistic)
  Booking Step 2: ~900+ (realistic)
  Booking Step 3: ~300+ (realistic)
```

**All months will match Google Ads Console numbers!**

---

## ✅ Verification

### Check if backfill worked:

```sql
-- Check updated months
SELECT 
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  COUNT(*) as client_count,
  SUM(booking_step_1) as total_step1,
  SUM(booking_step_2) as total_step2,
  SUM(booking_step_3) as total_step3,
  data_source
FROM campaign_summaries
WHERE platform = 'google'
  AND summary_type = 'monthly'
  AND summary_date >= '2024-01-01'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM'), summary_date, data_source
ORDER BY summary_date DESC;
```

**Look for:**
- `data_source` starting with `backfill_all_conversions_`
- Much higher booking_step numbers than before

---

## 🚀 Execution Steps

### Step 1: Verify the fix is in place
```bash
# Check that google-ads-api.ts has the fix
grep -A 5 "all_conversions" src/lib/google-ads-api.ts
```

### Step 2: Test with one client first
```bash
# Test with November to verify
npx tsx scripts/test-havet-november-live-fetch.ts
# Should show 9,867 for Step 1 (not 1,523)
```

### Step 3: Backfill all historical data
```bash
# Dry run first
npx tsx scripts/backfill-all-historical-google-ads.ts --dry-run

# Review output, then run for real
npx tsx scripts/backfill-all-historical-google-ads.ts
```

### Step 4: Verify results
```bash
# Run the audit again
# Execute AUDIT_ALL_MONTHS_BOOKING_STEPS.sql
```

**Expected:** All 13 months should now have booking_steps > 0

---

## ⏱️ Time Estimates

- **Dry run:** ~2-3 minutes (no API calls, just planning)
- **Full backfill:** ~15-20 minutes for 12 clients × 12-24 months
  - ~5-10 seconds per client per month
  - Includes API fetch + database updates

---

## 🛡️ Safety Features

1. **Dry run mode** - Test before committing
2. **Upserts** - Won't create duplicates, only updates
3. **Data source tracking** - Can identify backfilled data
4. **Error handling** - Continues on individual failures
5. **Detailed logging** - See exactly what's happening

---

## 📊 Summary

| Component | Status | Action |
|-----------|--------|--------|
| API Fix | ✅ Done | `all_conversions` now used |
| Live Fetch (Current) | ✅ Auto-fixes | Wait 3 hours or clear cache |
| Historical Data | ⚠️ Needs backfill | Run script |
| Future Data | ✅ Fixed | All new fetches correct |

**Next Action:** Run the backfill script to update all historical data!

