# PDF Generation Null Safety Fixes

## Issue
The PDF generation was failing with the error:
```
TypeError: Cannot read properties of undefined (reading 'toFixed')
```

This occurred when campaign data contained `undefined` or `null` values for numeric fields like `spend`, `impressions`, `clicks`, `ctr`, `cpc`, etc.

## Root Cause
The formatting functions (`formatCurrency`, `formatNumber`, `formatPercentage`) were expecting valid numbers but receiving `undefined` or `null` values from the campaign data.

## Fixes Applied

### 1. Updated Formatting Functions
**File:** `src/app/api/generate-pdf/route.ts`

**Before:**
```typescript
const formatCurrency = (value: number) => `${value.toFixed(2)} zł`;
const formatNumber = (value: number) => value.toLocaleString();
const formatPercentage = (value: number) => `${value.toFixed(2)}%`;
```

**After:**
```typescript
const formatCurrency = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return '0.00 zł';
  return `${value.toFixed(2)} zł`;
};
const formatNumber = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return value.toLocaleString();
};
const formatPercentage = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return '0.00%';
  return `${value.toFixed(2)}%`;
};
```

### 2. Added Safety Checks for Calculated Metrics
**File:** `src/app/api/generate-pdf/route.ts`

**Before:**
```typescript
const totalSpend = reportData.totals.spend;
const totalImpressions = reportData.totals.impressions;
const totalClicks = reportData.totals.clicks;
const ctr = reportData.totals.ctr;
const cpc = reportData.totals.cpc;
const cpm = reportData.totals.cpm;
const reach = Math.round(totalImpressions / 1.5);
const frequency = totalImpressions / reach;
```

**After:**
```typescript
const totalSpend = reportData.totals.spend || 0;
const totalImpressions = reportData.totals.impressions || 0;
const totalClicks = reportData.totals.clicks || 0;
const ctr = reportData.totals.ctr || 0;
const cpc = reportData.totals.cpc || 0;
const cpm = reportData.totals.cpm || 0;
const reach = totalImpressions > 0 ? Math.round(totalImpressions / 1.5) : 0;
const frequency = reach > 0 ? totalImpressions / reach : 0;
```

### 3. Added Safety Checks for Campaign Data Aggregation
**File:** `src/app/api/generate-pdf/route.ts`

**Before:**
```typescript
const totals = campaigns.reduce((acc, campaign) => ({
  spend: acc.spend + campaign.spend,
  impressions: acc.impressions + campaign.impressions,
  clicks: acc.clicks + campaign.clicks,
  conversions: acc.conversions + campaign.conversions,
}), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
```

**After:**
```typescript
const totals = campaigns.reduce((acc, campaign) => ({
  spend: acc.spend + (campaign.spend || 0),
  impressions: acc.impressions + (campaign.impressions || 0),
  clicks: acc.clicks + (campaign.clicks || 0),
  conversions: acc.conversions + (campaign.conversions || 0),
}), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
```

### 4. Added Safety Check for Campaign Names
**File:** `src/app/api/generate-pdf/route.ts`

**Before:**
```typescript
<td>${campaign.campaign_name}</td>
```

**After:**
```typescript
<td>${campaign.campaign_name || 'Unknown Campaign'}</td>
```

### 5. Added Safety Checks for Console Logging
**File:** `src/app/api/generate-pdf/route.ts`

**Before:**
```typescript
spend: reportData.totals.spend.toFixed(2) + ' zł',
impressions: reportData.totals.impressions.toLocaleString(),
clicks: reportData.totals.clicks.toLocaleString()
```

**After:**
```typescript
spend: (reportData.totals.spend || 0).toFixed(2) + ' zł',
impressions: (reportData.totals.impressions || 0).toLocaleString(),
clicks: (reportData.totals.clicks || 0).toLocaleString()
```

## Testing
Created a test script (`scripts/test-pdf-fix.js`) that validates all formatting functions handle null/undefined values correctly:

```bash
node scripts/test-pdf-fix.js
```

**Test Results:**
- ✅ All formatting functions now handle `undefined`, `null`, and `NaN` values
- ✅ Default values are returned: `'0.00 zł'`, `'0'`, `'0.00%'`
- ✅ Valid numbers are formatted correctly
- ✅ PDF generation should no longer crash with the `toFixed` error

## Impact
- **Before:** PDF generation would crash when encountering undefined/null values
- **After:** PDF generation gracefully handles missing data and displays default values
- **Benefit:** More robust PDF generation that works with incomplete or inconsistent data

## Files Modified
- `src/app/api/generate-pdf/route.ts` - Main PDF generation logic
- `scripts/test-pdf-fix.js` - Test script for validation
- `PDF_NULL_SAFETY_FIXES.md` - This documentation 