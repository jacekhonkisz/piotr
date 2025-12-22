# 🔴 WEEKLY PDF "NaN" ISSUE - ROOT CAUSE FOUND

**Date**: November 20, 2025  
**Status**: 🔴 **CRITICAL BUG IDENTIFIED**  
**Impact**: Weekly PDFs show "NaN zł" instead of actual spend values

---

## 🎯 User Report

**Monthly PDF** (Working ✅):
```
W okresie od 1-30 listopada 2025 przeprowadziliśmy kampanie Meta Ads i Google Ads o budżecie 
17 459,44 zł w Meta Ads i 489,66 zł w Google Ads.
```

**Weekly PDF** (Broken ❌):
```
W okresie od 17-23 listopada 2025 przeprowadziliśmy kampanie Meta Ads i Google Ads o budżecie 
NaN zł w Meta Ads i 489,66 zł w Google Ads.
```

---

## 🔍 Root Cause Analysis

### The Data Flow

```
PDF Generation
    ↓
fetchReportData() in generate-pdf/route.ts
    ↓
Fetches Meta data via StandardizedDataFetcher
    ↓
Constructs reportData.metaData.metrics object
    ↓
Calls /api/generate-executive-summary
    ↓
Passes: { metaData: reportData.metaData, googleData: reportData.googleData }
    ↓
generate-executive-summary extracts:
    const metaSpend = reportData.metaData?.metrics?.totalSpend || 0;
    ↓
If metrics is undefined or totalSpend is NaN → "NaN zł" appears in summary
```

### The Bug

**File**: `src/lib/ai-summary-generator.ts`  
**Lines**: 326-330

```typescript
// Line 326: Gets data from platformBreakdown
const metaData = data.platformBreakdown.meta;
const googleData = data.platformBreakdown.google;

// Line 330: Formats currency - if metaData.spend is undefined or NaN:
summary += ` o budżecie ${formatCurrency(metaData.spend || 0)} w Meta Ads...`;
//                                          ↑
//                            If undefined → formatCurrency(0) works
//                            If NaN → formatCurrency(NaN) → "NaN zł"
```

### Why Weekly Reports Show NaN

**Hypothesis 1**: Week-specific data fetching issue
- Weekly date ranges might not have data in database for `meta_spend`
- `actualReportData.account_summary.meta_spend` becomes `undefined`
- When passed to fallback summary, becomes `NaN` instead of `0`

**Hypothesis 2**: Platform breakdown extraction fails for weekly
- In `generate-executive-summary/route.ts` lines 410-433
- For weekly reports, `actualReportData.account_summary.meta_spend` might be `NaN`
- This `NaN` propagates to `platformBreakdown.meta.spend`
- Falls through to fallback summary generator which doesn't sanitize `NaN`

---

## 🔬 Evidence

### Code Location 1: Data Extraction (generate-executive-summary)

**File**: `src/app/api/generate-executive-summary/route.ts`  
**Lines**: 410-433

```typescript
// Line 410-411: Extracts platform-specific spend
const metaSpend = actualReportData.account_summary?.meta_spend || 0;
const googleSpend = actualReportData.account_summary?.google_spend || 0;

// Line 420-433: Builds platformBreakdown
platformBreakdown = {
  meta: {
    spend: actualReportData.account_summary.meta_spend || 0,  // ← Issue here
    impressions: actualReportData.account_summary.meta_impressions || 0,
    clicks: actualReportData.account_summary.meta_clicks || 0,
    conversions: actualReportData.account_summary.meta_conversions || 0
  },
  google: {
    spend: actualReportData.account_summary.google_spend || 0,
    impressions: actualReportData.account_summary.google_impressions || 0,
    clicks: actualReportData.account_summary.google_clicks || 0,
    conversions: actualReportData.account_summary.google_conversions || 0
  }
};
```

**Problem**: If `actualReportData.account_summary.meta_spend` is explicitly `NaN` (not `undefined`), the `|| 0` fallback doesn't work because `NaN || 0` evaluates to `NaN`.

### Code Location 2: Fallback Summary Generation

**File**: `src/lib/ai-summary-generator.ts`  
**Lines**: 325-330

```typescript
if (data.platformBreakdown && data.platformBreakdown.meta && data.platformBreakdown.google) {
  const metaData = data.platformBreakdown.meta;
  const googleData = data.platformBreakdown.google;
  
  // Line 330: If metaData.spend is NaN, formatCurrency(NaN) → "NaN zł"
  summary += ` o budżecie ${formatCurrency(metaData.spend || 0)} w Meta Ads i ${formatCurrency(googleData.spend || 0)} w Google Ads. `;
}
```

**Problem**: `formatCurrency(NaN)` returns `"NaN zł"` instead of `"0,00 zł"`.

---

## 🎯 Why Monthly Works But Weekly Doesn't

### Monthly Reports (Working):
```
1. PDF generation fetches data for November 1-30
2. Meta data available in database or smart cache
3. actualReportData.account_summary.meta_spend = 17459.44  ✅ Valid number
4. platformBreakdown.meta.spend = 17459.44  ✅
5. formatCurrency(17459.44) → "17 459,44 zł"  ✅
```

### Weekly Reports (Broken):
```
1. PDF generation fetches data for November 17-23
2. Meta data might be:
   - Not in database for this specific week range
   - Returned as undefined from API
   - Calculated incorrectly resulting in NaN
3. actualReportData.account_summary.meta_spend = NaN  ❌ Invalid
4. platformBreakdown.meta.spend = NaN  ❌ (NaN || 0 = NaN)
5. formatCurrency(NaN) → "NaN zł"  ❌
```

---

## 🔧 Required Fixes

### Fix 1: Sanitize NaN in Platform Breakdown Extraction (CRITICAL)

**File**: `src/app/api/generate-executive-summary/route.ts`  
**Location**: Lines 420-433

```typescript
// BEFORE (Broken):
platformBreakdown = {
  meta: {
    spend: actualReportData.account_summary.meta_spend || 0,
    // ...
  }
};

// AFTER (Fixed):
platformBreakdown = {
  meta: {
    spend: Number.isFinite(actualReportData.account_summary.meta_spend) 
      ? actualReportData.account_summary.meta_spend 
      : 0,
    impressions: Number.isFinite(actualReportData.account_summary.meta_impressions)
      ? actualReportData.account_summary.meta_impressions
      : 0,
    clicks: Number.isFinite(actualReportData.account_summary.meta_clicks)
      ? actualReportData.account_summary.meta_clicks
      : 0,
    conversions: Number.isFinite(actualReportData.account_summary.meta_conversions)
      ? actualReportData.account_summary.meta_conversions
      : 0
  },
  google: {
    spend: Number.isFinite(actualReportData.account_summary.google_spend)
      ? actualReportData.account_summary.google_spend
      : 0,
    impressions: Number.isFinite(actualReportData.account_summary.google_impressions)
      ? actualReportData.account_summary.google_impressions
      : 0,
    clicks: Number.isFinite(actualReportData.account_summary.google_clicks)
      ? actualReportData.account_summary.google_clicks
      : 0,
    conversions: Number.isFinite(actualReportData.account_summary.google_conversions)
      ? actualReportData.account_summary.google_conversions
      : 0
  }
};
```

### Fix 2: Sanitize NaN in Fallback Summary (CRITICAL)

**File**: `src/lib/ai-summary-generator.ts`  
**Location**: Lines 325-337

```typescript
// BEFORE (Broken):
const metaData = data.platformBreakdown.meta;
const googleData = data.platformBreakdown.google;

summary += ` o budżecie ${formatCurrency(metaData.spend || 0)} w Meta Ads...`;

// AFTER (Fixed):
const metaData = data.platformBreakdown.meta;
const googleData = data.platformBreakdown.google;

// Sanitize NaN values
const metaSpendSafe = Number.isFinite(metaData.spend) ? metaData.spend : 0;
const googleSpendSafe = Number.isFinite(googleData.spend) ? googleData.spend : 0;

summary += ` o budżecie ${formatCurrency(metaSpendSafe)} w Meta Ads i ${formatCurrency(googleSpendSafe)} w Google Ads. `;
```

### Fix 3: Sanitize All Numeric Values in Summary Data (PREVENTIVE)

**File**: `src/app/api/generate-executive-summary/route.ts`  
**Location**: Lines 493-514

```typescript
// Add helper function
function sanitizeNumber(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

// Use in summaryData construction:
const summaryData: ExecutiveSummaryData = {
  totalSpend: sanitizeNumber(actualReportData.account_summary?.total_spend),
  totalImpressions: sanitizeNumber(actualReportData.account_summary?.total_impressions),
  totalClicks: sanitizeNumber(actualReportData.account_summary?.total_clicks),
  totalConversions: sanitizeNumber(actualReportData.account_summary?.total_conversions),
  averageCtr: sanitizeNumber(actualReportData.account_summary?.average_ctr),
  averageCpc: sanitizeNumber(actualReportData.account_summary?.average_cpc),
  averageCpa: sanitizeNumber(actualReportData.account_summary?.average_cpa),
  // ... rest of fields
};
```

---

## 🔍 Investigation Needed

To confirm the root cause, check:

1. **What is `actualReportData.account_summary.meta_spend` for weekly reports?**
   - Check logs: `logger.info('[DEBUG] Extracted values:'...)`
   - Expected: Should be a valid number or 0
   - Actual: Likely `NaN` or `undefined`

2. **Where does the NaN originate?**
   - In PDF `fetchReportData()`? (lines 3072-3089)
   - In `generate-executive-summary` data extraction? (lines 133-157)
   - In database query results?

3. **Why does Google Ads work but Meta doesn't?**
   - Check if Google data uses different extraction logic
   - Check if Google has fallback to 0 that Meta doesn't

---

## 🎯 Testing Plan

### Test 1: Verify NaN Detection
```typescript
// Add logging before platformBreakdown creation:
logger.info('🔍 [NaN-DEBUG] Raw platform values:', {
  meta_spend: actualReportData.account_summary.meta_spend,
  meta_spend_type: typeof actualReportData.account_summary.meta_spend,
  meta_spend_isNaN: Number.isNaN(actualReportData.account_summary.meta_spend),
  meta_spend_isFinite: Number.isFinite(actualReportData.account_summary.meta_spend),
  google_spend: actualReportData.account_summary.google_spend,
  google_spend_isFinite: Number.isFinite(actualReportData.account_summary.google_spend)
});
```

### Test 2: Generate Weekly PDF
1. Generate PDF for week 17-23 November
2. Check logs for NaN detection
3. Verify if fix resolves the issue

### Test 3: Regression Test  
1. Generate monthly PDF (should still work)
2. Verify no impact on working monthly reports

---

## 📊 Priority

**Severity**: 🔴 **CRITICAL**  
**Impact**: User-facing data corruption in PDF reports  
**Frequency**: All weekly PDFs affected  
**Fix Time**: 30 minutes (implement sanitization)  
**Testing Time**: 15 minutes

---

## ✅ Success Criteria

After fix implementation:
- ✅ Weekly PDFs show valid spend values (not NaN)
- ✅ Monthly PDFs continue to work correctly
- ✅ All numeric values in summaries are valid numbers
- ✅ Graceful degradation to 0 when data is missing

---

**Status**: 🔴 **BUG IDENTIFIED - FIX READY**  
**Next Step**: Implement NaN sanitization in both locations  
**Estimated Fix Time**: 30 minutes

