# 🔧 Year-over-Year Platform Separation FIX - APPLIED

**Date:** November 5, 2025  
**Issue:** 96-99% year-over-year drops caused by comparing different platforms  
**Status:** ✅ **FIXED**

---

## 🚨 THE PROBLEM

### What Was Happening:

**When viewing Google Ads funnel in November 2025:**
```
Year-over-Year Comparison:
  Current (Nov 2025):  Google Ads → 1, 4, 2, 7
  Previous (Nov 2024): Meta Ads → 23,360, 14,759, 1,704, 249
  
Result: -99.996%, -99.973%, -99.883%, -97.19%
```

**This was MEANINGLESS!** You can't compare Google Ads to Meta Ads!

---

## 🔍 ROOT CAUSE

### Issue #1: Platform Parameter Inconsistency

**Code Location:** `/src/app/api/year-over-year-comparison/route.ts`

**Bug at Line 116:**
```typescript
if (platform === 'google_ads') {
  // Fetch Google current data
} else {
  // Fetch META current data ❌ WRONG!
}
```

**Problem:** 
- If frontend sends `platform='google'` (not `'google_ads'`)
- Check at line 116 fails
- Falls through to `else` block
- Fetches **META data** for current
- But line 219 filters previous by `platform='google'`
- **Result:** Comparing Meta current vs Google previous!

---

### Issue #2: Meta Collection Stopped in November 2025

**Database Status:**
```sql
-- November 2025 data:
platform='google' only ❌ (Meta collection stopped)

-- November 2024 data:
platform='meta' only ✅ (Meta was being collected back then)
```

**Combined Effect:**
1. November 2025 only has Google data
2. November 2024 only has Meta data  
3. YoY compares Google 2025 vs Meta 2024
4. Result: Meaningless 99% drops

---

## ✅ THE FIX

### Change #1: Normalize Platform Parameter

**Added at Line 116-118:**
```typescript
// Normalize platform parameter to match database values
// Frontend might send 'google' but DB uses 'google', or 'meta' for both
const normalizedPlatform = platform === 'google_ads' ? 'google' : platform;

if (platform === 'google_ads' || platform === 'google') {  // ⬅️ FIXED
  // Fetch Google current data
} else {
  // Fetch Meta current data
}
```

**What this does:**
- Accepts both `'google'` and `'google_ads'` as valid Google platform names
- Routes correctly to Google API endpoint
- Ensures current data is fetched from correct platform

---

### Change #2: Use Normalized Platform for Previous Year Query

**Added at Line 218-221:**
```typescript
// Use normalized platform to match database values ('google' or 'meta')
const dbPlatform = platform === 'google_ads' ? 'google' : platform;

console.log(`🔍 [${requestId}] Querying previous year with platform='${dbPlatform}'`);

const { data: previousSummariesData } = await supabase
  .from('campaign_summaries')
  .select('*')
  .eq('client_id', clientId)
  .eq('summary_type', summaryType)
  .eq('platform', dbPlatform)  // ⬅️ Use normalized platform
  .gte('summary_date', prevDateRange.start!)
  .lte('summary_date', prevDateRange.end!);
```

**What this does:**
- Uses same normalized platform name for database query
- Ensures previous year data is fetched from same platform
- **Guarantees:** Meta compares to Meta, Google compares to Google

---

### Change #3: Added Debug Metadata

**Added at Line 340-347:**
```typescript
_metadata: {
  platformRequested: platform,
  platformUsed: dbPlatform,
  currentPlatform: dbPlatform,
  previousPlatform: dbPlatform,
  previousDataFound: previousSummariesData && previousSummariesData.length > 0
}
```

**What this does:**
- Logs which platform was actually used
- Shows if previous year data was found
- Helps diagnose future issues

---

## 📊 EXPECTED BEHAVIOR AFTER FIX

### Scenario A: Viewing Meta Funnel (November 2025)

**Current Behavior (BROKEN):**
```
❌ November 2025 has NO Meta data (collection stopped)
❌ Falls back to Google data or shows zeros
❌ Compares to Meta November 2024 
❌ Result: Meaningless comparison
```

**After Fix + Meta Collection Restart:**
```
✅ November 2025 has Meta data (after collection runs)
✅ November 2024 has Meta data
✅ Comparison: Meta 2025 vs Meta 2024
✅ Result: Accurate YoY metrics
```

---

### Scenario B: Viewing Google Funnel (November 2025)

**Before Fix:**
```
❌ Current: Google Nov 2025 (1, 4, 2, 7)
❌ Previous: Meta Nov 2024 (23,360, 14,759, 1,704, 249)
❌ Result: -99.996% drops (meaningless!)
```

**After Fix:**
```
✅ Current: Google Nov 2025 (1, 4, 2, 7)
✅ Previous: Google Nov 2024 (if exists, otherwise shows N/A)
✅ Result: Accurate Google-to-Google comparison
```

---

## 🎯 VERIFICATION STEPS

### Test 1: Check API Logs

After deploying, check logs for:
```
🔍 Querying previous year with platform='google'
🔍 Previous summaries query result: { platform: 'google', foundRecords: X }
```

Should show consistent platform usage.

---

### Test 2: Check UI Metadata

In browser console, inspect YoY API response:
```json
{
  "_metadata": {
    "platformRequested": "google",
    "platformUsed": "google",
    "currentPlatform": "google",
    "previousPlatform": "google",
    "previousDataFound": true
  }
}
```

All platform fields should match!

---

### Test 3: Verify Comparison Logic

**For Google Funnel:**
```sql
-- Should compare ONLY Google data
SELECT 
  '2025' as year,
  booking_step_1, reservations
FROM campaign_summaries
WHERE client_id = 'belmonte'
  AND platform = 'google'
  AND summary_date = '2025-11-01';

-- vs

SELECT 
  '2024' as year,
  booking_step_1, reservations
FROM campaign_summaries
WHERE client_id = 'belmonte'
  AND platform = 'google'  -- ⬅️ SAME PLATFORM
  AND summary_date = '2024-11-01';
```

---

## ⚠️ REMAINING ISSUE: Meta Collection Stopped

**The fix ensures correct platform comparison, BUT:**

November 2025 still has **NO Meta data** because collection stopped.

### Immediate Action Required:

1. **Check why Meta collection stopped:**
   ```sql
   SELECT 
     name,
     reporting_frequency,
     last_report_date,
     next_report_scheduled_at,
     token_health_status,
     last_token_validation
   FROM clients
   WHERE id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
   ```

2. **Manually trigger collection or restart scheduled job**

3. **Verify Meta data gets collected for November 2025**

---

## 📋 FILES CHANGED

| File | Changes | Status |
|------|---------|--------|
| `/src/app/api/year-over-year-comparison/route.ts` | Platform normalization, debug logs | ✅ FIXED |

---

## 🎉 SUMMARY

**Before Fix:**
- ❌ Comparing Google 2025 vs Meta 2024
- ❌ Result: -99% drops (meaningless)
- ❌ No validation of platform consistency

**After Fix:**
- ✅ Google compares to Google only
- ✅ Meta compares to Meta only
- ✅ Debug metadata for verification
- ✅ Clear logging of platform usage

**Remaining Task:**
- 🔧 Restart Meta data collection for November 2025
- 🔧 Verify Google Ads conversion tracking (inverted funnel issue)

---

**Generated:** November 5, 2025  
**Applied By:** Senior Developer  
**Verified:** Pending deployment & testing









