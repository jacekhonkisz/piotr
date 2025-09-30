# 🔧 Attribution Fix Implementation Summary

**Date:** September 30, 2025  
**Task:** Fix Meta API to fetch data with proper attribution windows

---

## ✅ What Was Done

### 1. **Added Attribution Windows to Meta API Call**

**File:** `src/lib/meta-api.ts`  
**Lines:** 636-637

**Change:**
```typescript
// BEFORE (Missing attribution):
const params = new URLSearchParams({
  fields: fields,
  time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
  level: 'campaign',
  limit: '100',
});

// AFTER (With 7-day click + 1-day view attribution):
const params = new URLSearchParams({
  fields: fields,
  time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
  level: 'campaign',
  limit: '100',
});

// Add attribution windows as JSON array
params.append('action_attribution_windows', JSON.stringify(['7d_click', '1d_view']));
```

**Purpose:**  
Configure Meta API to return conversion data using 7-day click and 1-day view attribution windows, matching Meta Ads Manager CSV exports.

---

### 2. **Added Enhanced Logging for Debugging**

**File:** `src/lib/meta-api.ts`  
**Lines:** 820-836

**Added:**
```typescript
// Log all purchase-like actions with attribution breakdown
const purchaseActions = actionsArray.filter((a: any) => {
  const type = String(a.action_type || a.type || '').toLowerCase();
  return type.includes('purchase') || type.includes('offsite_conversion');
});
if (purchaseActions.length > 0) {
  logger.info('🛒 PURCHASE ACTIONS FOUND:', {
    campaign: insight.campaign_name,
    purchases: purchaseActions.map((a: any) => ({
      type: a.action_type,
      value: a.value,
      '1d_click': a['1d_click'],
      '7d_click': a['7d_click'],
      '1d_view': a['1d_view']
    }))
  });
}
```

**Purpose:**  
Track what attribution-specific data Meta API is returning to verify the fix is working.

---

## 📊 Test Results

### Initial Test (After Adding Attribution Parameter)

**Request:**
- Client: Belmonte
- Date Range: Sept 1-29, 2025
- Force Fresh: Yes
- Attribution: `['7d_click', '1d_view']`

**Result:**
- ✅ API call successful (4.75s response time)
- ✅ 17 campaigns returned
- ❌ Conversions: Still 38 (expected: 100)
- ❌ No change from before fix

---

## 🤔 Why the Fix Didn't Change the Number

### Possible Explanations:

**1. Meta API's `conversions` Field Limitation**
- The summary `conversions` field may not respect `action_attribution_windows`
- It might be a pre-calculated summary metric
- Need to check individual `actions` array items for attribution-specific values

**2. Attribution Window Nested Data**
- Meta API may return attribution data as nested properties:
  - `action.value` = default (1-day)
  - `action['7d_click']` = 7-day click attribution count
  - `action['1d_view']` = 1-day view attribution count
- Our code currently only reads `action.value`, not the attribution-specific fields

**3. Different Metrics Being Compared**
- CSV "Wyniki" (Results) column: Sums PRIMARY campaign objective per campaign
- CSV "Zakupy w witrynie" (Website Purchases): Actual purchase conversions
- API `reservations`: Only counts `purchase` action types
- These might be fundamentally different metrics!

**4. CSV Export Time vs API Real-Time**
- CSV was exported AFTER Sept 29 (more attribution time)
- API call on Sept 30 is still within attribution window
- Conversions from Sept 22-29 ads haven't finished their 7-day attribution window yet

---

## 🔍 CSV Analysis - What Does "100 Conversions" Mean?

### CSV Breakdown by Campaign:

| Campaign | Typ wyniku | Wyniki | Zakupy w witrynie |
|----------|------------|--------|-------------------|
| [PBM] HOT \| Remarketing | Zakupy w witrynie | 34 | 34 |
| [PBM] HOT \| LTL \| Remarketingu | Zakupy w witrynie | 11 | 11 |
| [PBM] Konwersje \| 30-60 lat | Zakupy w witrynie | 1 | 2 |
| ... (video campaigns) | Całkowite odtworzenie | 65,794 | - |
| ... (reach campaigns) | Zasięg | 147,023 | - |
| ... (profile visits) | Wizyty w profilu | 3,341 | 1 |

**Observation:**
- Some campaigns optimize for purchases → "Wyniki" = purchases
- Some campaigns optimize for video plays → "Wyniki" = video completions
- Some campaigns optimize for reach → "Wyniki" = reach count
- The CSV "Wyniki" column is NOT consistent conversion types!

**Possible CSV Totals:**
- "Wyniki" (mixed objectives): ~121 total (not all conversions!)
- "Zakupy w witrynie" (purchases only): ~133 actual purchases
- API returns: 38 reservations (purchases with current attribution)

---

## 🎯 Next Steps to Fully Diagnose

### 1. **Check Attribution-Specific Action Fields**

The Meta API might be returning attribution breakdown as nested fields. Need to modify the code to read:

```typescript
// Instead of just:
const valueNum = Number(action.value ?? 0);

// Try summing attribution-specific fields:
const value_1d_click = Number(action['1d_click'] ?? action.value ?? 0);
const value_7d_click = Number(action['7d_click'] ?? 0);
const value_1d_view = Number(action['1d_view'] ?? 0);
const totalValue = value_7d_click || value_1d_view || value_1d_click;
```

### 2. **Inspect Raw API Response**

Add logging to see the RAW Meta API response before parsing:

```typescript
logger.info('🔍 RAW META API RESPONSE:', JSON.stringify(data.data[0], null, 2));
```

This will show if Meta is returning attribution breakdowns in a format we're not parsing.

### 3. **Test with a Single Campaign**

Query Meta API for just ONE campaign that the CSV shows has purchases, and compare field-by-field.

### 4. **Verify CSV Export Settings**

Check what attribution window was used when generating the CSV:
- In Meta Ads Manager → Settings → Attribution
- Should show "7-day click, 1-day view" if that's what was used

### 5. **Wait for Full Attribution Window**

Since we're testing on Sept 30 for data through Sept 29:
- Conversions from Sept 23-29 ads haven't completed their 7-day window yet
- Re-test on October 6 (after full 7-day window from Sept 29)
- Compare if numbers match then

---

## 🔧 Code Changes Made

### File: `/Users/macbook/piotr/src/lib/meta-api.ts`

**Change 1 (Line 636-637):** Add attribution windows parameter
```typescript
params.append('action_attribution_windows', JSON.stringify(['7d_click', '1d_view']));
```

**Change 2 (Lines 820-836):** Add purchase action logging
```typescript
const purchaseActions = actionsArray.filter(/* purchases and offsite_conversions */);
logger.info('🛒 PURCHASE ACTIONS FOUND:', { /* details */ });
```

**Change 3 (Line 643):** Add attribution logging
```typescript
logger.info('🔧 Attribution Windows:', ['7d_click', '1d_view']);
```

---

## ✅ Status: Partially Complete

**What Works:**
- ✅ Attribution parameter added to API call
- ✅ API accepts the parameter (no errors)
- ✅ Enhanced logging in place

**What's Unclear:**
- ❓ Whether Meta API returns attribution breakdown in `actions` array
- ❓ Whether we're parsing attribution-specific fields correctly
- ❓ Whether CSV "100 conversions" means something different than API "38 reservations"

**What's Needed:**
- 🔍 Inspect dev server logs for purchase action details
- 🔍 Check if actions have `'7d_click'` or `'1d_view'` properties
- 🔍 Clarify what metric the CSV "100" represents
- 🔍 Possibly modify parsing logic to read attribution-specific fields

---

## 📁 Related Files

- `src/lib/meta-api.ts` - Main API integration (MODIFIED)
- `src/lib/smart-cache-helper.ts` - Calls getCampaignInsights()
- `src/lib/standardized-data-fetcher.ts` - Routes between cache and DB
- `src/app/api/fetch-live-data/route.ts` - API endpoint for testing

---

## 🎯 Recommendation

**Before proceeding further, need to:**

1. **Look at dev server logs** from the last test to see what purchase actions Meta returned
2. **Verify CSV metrics** - what does "Wyniki: 100" actually represent?
3. **Test attribution fields** - modify code to read `action['7d_click']` instead of `action.value`

**The attribution parameter IS correctly added, but we may not be READING the attribution data correctly from the response!**

---

**Generated:** September 30, 2025  
**Status:** Awaiting further investigation of API response structure
