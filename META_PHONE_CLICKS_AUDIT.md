# 🔍 Meta Phone Clicks Fetching Audit

**Date:** January 2025  
**Issue:** Different phone click data between current and past periods  
**Status:** 🐛 **BUG FOUND AND FIXED**

---

## 📊 Executive Summary

The system fetches phone clicks from Meta API differently for current vs past periods, and there's a **critical bug** in the parsing logic that causes undercounting.

---

## 🐛 **CRITICAL BUG FOUND**

### **Location:** `src/lib/meta-actions-parser.ts` (Line 113)

**Problem:**
```typescript
// ❌ BUG: Uses assignment (=) instead of addition (+=)
else if (actionType === 'click_to_call_call_confirm' && 
         !actionMap.has('offsite_conversion.custom.1470262077092668')) {
  metrics.click_to_call = value;  // ❌ Should be +=
}
```

**Impact:**
- If a campaign has **multiple** `click_to_call_call_confirm` actions in the `actions` array, only the **last one** is counted
- This causes **undercounting** of phone clicks
- The bug affects **current period** data (live API parsing)
- Past period data may have been collected with different logic or before this bug existed

**Comparison:**
- Line 109 (Havet PBM): ✅ Correctly uses `+=` 
- Line 113 (Standard): ❌ Incorrectly uses `=`

---

## 🔄 **How Phone Clicks Are Fetched**

### **Current Period (Live API)**

1. **Source:** Meta API `getCampaignInsights()` with `actions` and `action_values` arrays
2. **Parser:** `parseMetaActions()` in `meta-actions-parser.ts`
3. **Logic:**
   - Priority 1: `offsite_conversion.custom.1470262077092668` (Havet PBM custom event) ✅
   - Priority 2: `click_to_call_call_confirm` (standard Meta event) ❌ **BUG HERE**
4. **Storage:** 
   - Cached in `current_month_cache` / `current_week_cache` (3-6 hour refresh)
   - Also saved to `campaign_summaries.click_to_call` column
5. **Issue:** Bug causes undercounting when multiple `click_to_call_call_confirm` actions exist

### **Past Period (Database)**

1. **Source:** `campaign_summaries` table (column: `click_to_call`)
2. **How it was stored:**
   - Collected via `BackgroundDataCollector` at end of month/week
   - Used `parseMetaActions()` at time of collection
   - Stored permanently in database
3. **Issue:** 
   - If collected before bug fix, may have correct data (if bug didn't exist then)
   - If collected after bug, will have undercounted data
   - Different parsing logic versions may have been used over time

---

## 📋 **Phone Click Action Types**

Meta API returns phone clicks in various action types:

1. **Havet PBM Custom Event:**
   - `offsite_conversion.custom.1470262077092668` ✅ (Correctly parsed with `+=`)

2. **Standard Meta Events:**
   - `click_to_call_call_confirm` ❌ (Bug: uses `=` instead of `+=`)
   - `click_to_call_native_call_placed`
   - `click_to_call_native_20s_call_connect`
   - `phone_number_clicks` (not currently handled)

**Current Parser Logic:**
- Only handles `click_to_call_call_confirm` (with bug)
- Doesn't handle other variants like `click_to_call_native_call_placed`

---

## ✅ **FIX APPLIED**

### **Change 1: Fix Assignment Bug**

```typescript
// ✅ FIXED: Use += to accumulate multiple actions
else if (actionType === 'click_to_call_call_confirm' && 
         !actionMap.has('offsite_conversion.custom.1470262077092668')) {
  metrics.click_to_call += value;  // ✅ Fixed: Now accumulates
}
```

### **Change 2: Handle All Phone Click Variants**

The parser should handle ALL phone click action types, not just `click_to_call_call_confirm`:

```typescript
// ✅ IMPROVED: Handle all phone click variants
if (actionType === 'offsite_conversion.custom.1470262077092668') {
  metrics.click_to_call += value;  // Havet PBM
}
else if (actionType.includes('click_to_call') || 
         actionType.includes('phone_number_clicks')) {
  // Only count if Havet PBM event doesn't exist
  if (!actionMap.has('offsite_conversion.custom.1470262077092668')) {
    metrics.click_to_call += value;  // ✅ Accumulate all variants
  }
}
```

---

## 🧪 **Testing Recommendations**

1. **Compare Current vs Past:**
   - Fetch same period from Meta API directly
   - Compare with stored database value
   - Verify fix resolves discrepancy

2. **Test Multiple Actions:**
   - Find campaign with multiple `click_to_call_call_confirm` actions
   - Verify parser now accumulates them correctly

3. **Verify All Variants:**
   - Test campaigns with different phone click action types
   - Ensure all are captured

---

## 📝 **Data Reconciliation**

### **For Past Periods:**

If past periods have incorrect data due to this bug:

1. **Option 1:** Re-fetch from Meta API (if within attribution window)
2. **Option 2:** Accept historical data as-is (already stored)
3. **Option 3:** Create migration script to re-parse stored `campaign_data` JSONB

### **For Current Period:**

- Fix will apply immediately to new API calls
- Cache will refresh within 3-6 hours
- New data will be correct going forward

---

## 🔗 **Related Files**

- `src/lib/meta-actions-parser.ts` - Parser with bug (FIXED)
- `src/lib/smart-cache-helper.ts` - Current period caching
- `src/lib/background-data-collector.ts` - Past period collection
- `src/lib/standardized-data-fetcher.ts` - Unified fetching logic
- `supabase/migrations/033_add_conversion_metrics_to_summaries.sql` - Database schema

---

## ✅ **Status**

- [x] Bug identified
- [x] Fix applied
- [ ] Testing completed
- [ ] Past period data verified
- [ ] Documentation updated

