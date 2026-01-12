# 📊 Year-Over-Year Funnel Comparison Audit Report

**Date:** January 2026  
**Purpose:** Comprehensive audit of year-over-year comparison system to verify funnel metrics are correctly compared between current period and same period year ago.

---

## 🎯 Executive Summary

**⚠️ CRITICAL ISSUES FOUND:**

1. **❌ Data Source Mismatch:** Current period uses smart cache with different priority logic than historical database
2. **❌ Funnel Metrics Extraction Inconsistency:** Current period extracts from `conversionMetrics` object, previous year from database columns
3. **✅ Date Range Matching:** Correctly calculates same period year ago
4. **⚠️ Platform Consistency:** Fixed in previous update, but needs verification

---

## 🔍 System Architecture Analysis

### Current Period Data Flow

**API Endpoint:** `/api/year-over-year-comparison/route.ts`

**For Meta Ads (lines 184-225):**
```typescript
// Fetches current data via /api/fetch-live-data
const response = await fetch(`${baseUrl}/api/fetch-live-data`, {
  method: 'POST',
  body: JSON.stringify({
    clientId,
    dateRange,
    platform: 'meta',
    reason: 'comparison-current-meta'
  })
});

// Extracts funnel metrics from conversionMetrics object
if (data.data.conversionMetrics) {
  currentData.totalBookingStep1 = data.data.conversionMetrics.booking_step_1 || 0;
  currentData.totalBookingStep2 = data.data.conversionMetrics.booking_step_2 || 0;
  currentData.totalBookingStep3 = data.data.conversionMetrics.booking_step_3 || 0;
  currentData.totalReservations = data.data.conversionMetrics.reservations || 0;
  currentData.totalReservationValue = data.data.conversionMetrics.reservation_value || 0;
}
```

**For Google Ads (lines 123-179):**
```typescript
// Uses smart cache directly (faster)
const smartCacheResult = await getGoogleAdsSmartCacheData(clientId, false);

if (smartCacheResult.data.conversionMetrics) {
  currentData.totalBookingStep1 = smartCacheResult.data.conversionMetrics.booking_step_1 || 0;
  currentData.totalBookingStep2 = smartCacheResult.data.conversionMetrics.booking_step_2 || 0;
  currentData.totalBookingStep3 = smartCacheResult.data.conversionMetrics.booking_step_3 || 0;
  currentData.totalReservations = smartCacheResult.data.conversionMetrics.reservations || 0;
  currentData.totalReservationValue = smartCacheResult.data.conversionMetrics.reservation_value || 0;
}
```

**Data Source Priority (from `/api/fetch-live-data`):**
1. **Smart Cache** (if current period) → Uses `enhanceCampaignsWithConversions()` + `daily_kpi_data` fallback
2. **campaign_summaries** (if historical) → Uses stored columns
3. **daily_kpi_data** → Aggregated daily records
4. **Live Meta API** → Fresh fetch with parsing

### Previous Year Data Flow

**API Endpoint:** `/api/year-over-year-comparison/route.ts` (lines 234-317)

```typescript
// Fetches from campaign_summaries table directly
const { data: previousSummariesData } = await supabase
  .from('campaign_summaries')
  .select('*')
  .eq('client_id', clientId)
  .eq('summary_type', summaryType) // 'weekly' or 'monthly'
  .eq('platform', dbPlatform) // 'meta' or 'google'
  .gte('summary_date', prevDateRange.start!)
  .lte('summary_date', prevDateRange.end!)
  .order('summary_date', { ascending: false });

// Extracts funnel metrics from database columns
previousData = {
  booking_step_1: selectedSummary.booking_step_1 || 0,
  booking_step_2: selectedSummary.booking_step_2 || 0,
  booking_step_3: selectedSummary.booking_step_3 || 0,
  reservations: selectedSummary.reservations || 0,
  reservation_value: selectedSummary.reservation_value || 0
};
```

**Data Source:** `campaign_summaries` table columns (stored by `BackgroundDataCollector`)

---

## 🚨 Critical Issues Found

### Issue #1: Data Source Priority Mismatch

**Current Period:**
- Uses smart cache → `fetchFreshCurrentMonthData()` or `fetchFreshCurrentWeekData()`
- Priority: `enhanceCampaignsWithConversions()` (Meta API parsed) → `daily_kpi_data` fallback
- **Location:** `smart-cache-helper.ts:347-388` (monthly), `smart-cache-helper.ts:1381-1400` (weekly)

**Previous Year:**
- Uses `campaign_summaries` table columns
- Stored by `BackgroundDataCollector` which uses: `enhanceCampaignsWithConversions()` → `daily_kpi_data` fallback
- **Location:** `background-data-collector.ts:884-972` (monthly), `background-data-collector.ts:1106-1124` (weekly)

**Problem:**
- Current period smart cache has **different priority logic** than historical storage
- Smart cache prioritizes **fresh parser** over `daily_kpi_data` for `click_to_call`
- Historical storage prioritizes **Meta API parsed** but falls back to `daily_kpi_data` if no data

**Evidence:**
```typescript
// Smart Cache (current period) - smart-cache-helper.ts:347-353
click_to_call: metaConversionMetrics.click_to_call > 0
  ? metaConversionMetrics.click_to_call // ✅ Fresh parser FIRST
  : realConversionMetrics.click_to_call > 0 
    ? realConversionMetrics.click_to_call // daily_kpi_data fallback
    : 0,

// Historical Storage - background-data-collector.ts:884-902
// Aggregates from campaigns (which were parsed with enhanceCampaignsWithConversions)
const conversionTotals = campaigns.reduce((acc, campaign) => ({
  click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
  // ...
}), { click_to_call: 0, ... });

// Then checks daily_kpi_data if no conversion data
if (!hasAnyConversionData) {
  // Uses daily_kpi_data as fallback
}
```

**Impact:** 
- Current period might show different values than previous year even if data is identical
- Funnel metrics might not be directly comparable

---

### Issue #2: Funnel Metrics Extraction Inconsistency

**Current Period Extraction:**
```typescript
// year-over-year-comparison/route.ts:207-212
if (data.data.conversionMetrics) {
  currentData.totalBookingStep1 = data.data.conversionMetrics.booking_step_1 || 0;
  currentData.totalBookingStep2 = data.data.conversionMetrics.booking_step_2 || 0;
  currentData.totalBookingStep3 = data.data.conversionMetrics.booking_step_3 || 0;
  currentData.totalReservations = data.data.conversionMetrics.reservations || 0;
}
```

**Previous Year Extraction:**
```typescript
// year-over-year-comparison/route.ts:301-305
previousData = {
  booking_step_1: selectedSummary.booking_step_1 || 0,
  booking_step_2: selectedSummary.booking_step_2 || 0,
  booking_step_3: selectedSummary.booking_step_3 || 0,
  reservations: selectedSummary.reservations || 0,
};
```

**Problem:**
- Both extract correctly, but **source of truth is different**
- Current: `conversionMetrics` object (from smart cache or API response)
- Previous: Database columns (from `campaign_summaries` table)

**Impact:**
- If `conversionMetrics` object is missing or incomplete, current period shows 0
- If database columns are missing or incomplete, previous year shows 0
- **No fallback mechanism** to ensure both use same source

---

### Issue #3: Date Range Matching Verification

**Monthly Period Calculation:**
```typescript
// year-over-year-comparison/route.ts:92-101
const prevYearStart = new Date(currentStart);
prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);
const prevYearEnd = new Date(currentEnd);
prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);

prevDateRange = {
  start: prevYearStart.toISOString().split('T')[0],
  end: prevYearEnd.toISOString().split('T')[0]
};
```

**Weekly Period Calculation:**
```typescript
// year-over-year-comparison/route.ts:70-90
const currentWeekNumber = getISOWeekNumber(currentWeekEnd);
const currentYear = currentWeekEnd.getFullYear();
const prevYear = currentYear - 1;
const prevWeekStart = getISOWeekStartDate(prevYear, currentWeekNumber);
const prevWeekEnd = new Date(prevWeekStart);
prevWeekEnd.setDate(prevWeekStart.getDate() + 6);
```

**✅ VERDICT:** Date range matching is **CORRECT**
- Monthly: Simple year subtraction (correct)
- Weekly: ISO week number matching (correct)

**Potential Issue:**
- For weekly periods, if current week is partial (e.g., Jan 15-21, 2026), it compares to full week year ago (Jan 15-21, 2025)
- This is **correct behavior** but might cause misleading comparisons if current week is incomplete

---

### Issue #4: Platform Consistency

**Code Location:** `year-over-year-comparison/route.ts:240-250`

```typescript
// Normalize platform parameter
const dbPlatform = platform === 'google_ads' ? 'google' : platform;

// Query previous year with SAME platform
.eq('platform', dbPlatform)  // ✅ ALWAYS same platform!
```

**✅ VERDICT:** Platform consistency is **FIXED**
- Both current and previous use same platform filter
- Normalization handles `'google_ads'` → `'google'` conversion

---

## 📊 Detailed Comparison Matrix

| Aspect | Current Period | Previous Year | Match? |
|--------|---------------|---------------|--------|
| **Data Source** | Smart Cache / API | `campaign_summaries` table | ⚠️ Different |
| **Funnel Extraction** | `conversionMetrics` object | Database columns | ⚠️ Different |
| **Priority Logic** | Parser → daily_kpi_data | Parser → daily_kpi_data | ✅ Same |
| **Date Range** | User-selected | Same period year ago | ✅ Correct |
| **Platform Filter** | Normalized platform | Normalized platform | ✅ Same |
| **Fallback Logic** | daily_kpi_data | daily_kpi_data | ✅ Same |

---

## 🔬 Code-Level Verification

### 1. Current Period Funnel Metrics Source

**Meta Ads Path:**
```
/api/year-over-year-comparison
  → /api/fetch-live-data
    → Smart Cache (if current period)
      → fetchFreshCurrentMonthData()
        → enhanceCampaignsWithConversions()
        → daily_kpi_data fallback
    → Returns: conversionMetrics object
  → Extracts: conversionMetrics.booking_step_1, etc.
```

**Google Ads Path:**
```
/api/year-over-year-comparison
  → getGoogleAdsSmartCacheData()
    → Returns: conversionMetrics object
  → Extracts: conversionMetrics.booking_step_1, etc.
```

### 2. Previous Year Funnel Metrics Source

```
/api/year-over-year-comparison
  → campaign_summaries table query
    → Filters: client_id, summary_type, platform, date range
    → Returns: Database row with columns
  → Extracts: booking_step_1, booking_step_2, booking_step_3, reservations columns
```

### 3. Data Collection Methodology

**Both Use Same Parser:**
- ✅ `enhanceCampaignsWithConversions()` from `meta-actions-parser.ts`
- ✅ Same action type mapping logic
- ✅ Same conversion event parsing

**Both Use Same Fallback:**
- ✅ `daily_kpi_data` table aggregation
- ✅ Same aggregation logic

**Difference:**
- ⚠️ **Priority order** differs between smart cache and historical storage
- ⚠️ Smart cache prioritizes fresh parser for `click_to_call`
- ⚠️ Historical storage prioritizes aggregated campaigns

---

## 🎯 Root Cause Analysis

### Why Funnel Comparison Might Be Wrong

**Scenario 1: Current Period Uses Smart Cache**
```
Current Period (Jan 2026):
  - Smart cache: conversionMetrics.booking_step_1 = 100 (from fresh parser)
  - daily_kpi_data: booking_step_1 = 95 (aggregated)
  - Result: Shows 100 ✅

Previous Year (Jan 2025):
  - campaign_summaries: booking_step_1 = 95 (stored from daily_kpi_data fallback)
  - Result: Shows 95 ✅

Comparison: 100 vs 95 = +5.3% ✅ CORRECT
```

**Scenario 2: Current Period Uses daily_kpi_data**
```
Current Period (Jan 2026):
  - Smart cache: conversionMetrics.booking_step_1 = 0 (parser returned 0)
  - daily_kpi_data: booking_step_1 = 100 (aggregated)
  - Result: Shows 100 ✅

Previous Year (Jan 2025):
  - campaign_summaries: booking_step_1 = 100 (stored from daily_kpi_data)
  - Result: Shows 100 ✅

Comparison: 100 vs 100 = 0% ✅ CORRECT
```

**Scenario 3: Priority Mismatch (THE PROBLEM)**
```
Current Period (Jan 2026):
  - Smart cache: conversionMetrics.click_to_call = 50 (fresh parser)
  - daily_kpi_data: click_to_call = 45 (aggregated)
  - Result: Shows 50 ✅

Previous Year (Jan 2025):
  - campaign_summaries: click_to_call = 45 (stored from daily_kpi_data fallback)
  - Result: Shows 45 ✅

Comparison: 50 vs 45 = +11.1% ⚠️ MISLEADING (different sources)
```

**The Real Issue:**
- If current period uses **fresh parser** (which might have different parsing logic than when data was collected)
- And previous year uses **stored values** (which were collected with older parser or daily_kpi_data)
- The comparison might show **artificial differences** that don't reflect actual performance changes

---

## ✅ Recommendations

### Fix #1: Standardize Data Source Priority

**Option A: Use Same Priority for Both Periods**
```typescript
// In year-over-year-comparison/route.ts
// For current period, use campaign_summaries if available (same as previous year)
// Only use smart cache if campaign_summaries doesn't exist for current period
```

**Option B: Use Smart Cache for Both (Not Recommended)**
- Previous year data would need to be re-fetched from API
- Slower performance
- Not practical for historical data

**Recommended: Option A**
- Ensures both periods use same data source
- Maintains performance (database lookup is fast)
- Ensures consistency

### Fix #2: Add Fallback Verification

**Current Code:**
```typescript
// year-over-year-comparison/route.ts:207-212
if (data.data.conversionMetrics) {
  currentData.totalBookingStep1 = data.data.conversionMetrics.booking_step_1 || 0;
}
```

**Fixed Code:**
```typescript
// Verify both sources and log discrepancies
const fromConversionMetrics = data.data.conversionMetrics?.booking_step_1 || 0;
const fromCampaigns = data.data.campaigns?.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0) || 0;

currentData.totalBookingStep1 = fromConversionMetrics || fromCampaigns;

// Log if there's a discrepancy
if (fromConversionMetrics > 0 && fromCampaigns > 0 && fromConversionMetrics !== fromCampaigns) {
  console.warn(`⚠️ Funnel metric discrepancy: conversionMetrics=${fromConversionMetrics}, campaigns=${fromCampaigns}`);
}
```

### Fix #3: Verify Date Range Matching

**Add Validation:**
```typescript
// Verify previous year date range matches expected period
const expectedPrevStart = new Date(currentStart);
expectedPrevStart.setFullYear(expectedPrevStart.getFullYear() - 1);
const expectedPrevEnd = new Date(currentEnd);
expectedPrevEnd.setFullYear(expectedPrevEnd.getFullYear() - 1);

if (prevDateRange.start !== expectedPrevStart.toISOString().split('T')[0] ||
    prevDateRange.end !== expectedPrevEnd.toISOString().split('T')[0]) {
  console.error(`❌ Date range mismatch: Expected ${expectedPrevStart} to ${expectedPrevEnd}, got ${prevDateRange.start} to ${prevDateRange.end}`);
}
```

---

## 📋 Verification Checklist

### Data Source Consistency
- [ ] Current period uses same data source as previous year
- [ ] Both periods use same priority logic for funnel metrics
- [ ] Both periods use same fallback mechanism

### Funnel Metrics Extraction
- [ ] Current period extracts from correct source
- [ ] Previous year extracts from correct source
- [ ] Both use same field names and data types

### Date Range Matching
- [x] Monthly periods correctly calculate year-ago date range
- [x] Weekly periods correctly calculate year-ago ISO week
- [ ] Partial periods are handled correctly

### Platform Consistency
- [x] Both periods filter by same platform
- [x] Platform normalization works correctly
- [ ] Platform-specific metrics are handled correctly

---

## 🎯 Conclusion

### Critical Issues Summary

1. **❌ Data Source Mismatch:** Current period uses smart cache with different priority than historical storage
2. **⚠️ Funnel Metrics Extraction:** Different extraction methods (object vs columns) but both work correctly
3. **✅ Date Range Matching:** Correctly calculates same period year ago
4. **✅ Platform Consistency:** Fixed and working correctly

### Impact Assessment

**High Impact:**
- Funnel metrics comparison might show **artificial differences** due to different data source priorities
- `click_to_call` metric specifically affected (different priority logic)

**Medium Impact:**
- Other funnel metrics (`booking_step_1`, `booking_step_2`, `booking_step_3`, `reservations`) should be consistent
- But verification needed to confirm

**Low Impact:**
- Date range matching is correct
- Platform consistency is fixed

### Recommended Actions

1. **Immediate:** Verify if current period should use `campaign_summaries` for consistency
2. **Short-term:** Add fallback verification and logging
3. **Long-term:** Standardize data source priority across all systems

---

**Report Generated:** January 2026  
**Audit Status:** ⚠️ ISSUES FOUND - Requires fixes for accurate comparisons

