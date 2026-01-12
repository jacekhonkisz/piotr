# 🔍 CTR/CPC Discrepancy in Reports Page - ROOT CAUSE

## Problem
User sees TWO different CTR/CPC values in the reports page:
- **Top cards**: 3.15% CTR, 0.35 zł CPC  
- **Campaign table bottom**: 1.14% CTR, 0.98 zł CPC

## Root Cause

### Where the values come from:

**1. Top Cards (WRONG - 3.15% / 0.35 zł)**
- Location: Reports page displays `selectedReport.stats.averageCtr` and `selectedReport.stats.averageCpc`
- Source: These come from `StandardizedDataFetcher` which returns `result.data.stats`
- Issue: `stats.averageCtr` and `stats.averageCpc` are calculated correctly from totals
- BUT: Individual campaigns in `selectedReport.campaigns` have CTR/CPC from API

**2. Campaign Table Bottom (CORRECT - 1.14% / 0.98 zł)**
- Location: `getSelectedPeriodTotals()` function (line 3194-3195)
- Calculation: Recalculates from campaign totals
```typescript
const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
```

## The Issue

The problem is that **individual campaigns** (line 1148-1149) store CTR/CPC from the API:

```typescript:src/app/reports/page.tsx
ctr: parseFloat(campaign.ctr || '0'),  // ❌ Uses API value per campaign
cpc: parseFloat(campaign.cpc || '0'),  // ❌ Uses API value per campaign
```

These per-campaign CTR/CPC values are then displayed somewhere in the top section.

## Why This Matters

### Meta Business Suite shows:
- **CTR**: Calculated from ALL campaigns combined: `(totalClicks / totalImpressions) * 100`
- **CPC**: Calculated from ALL campaigns combined: `totalSpend / totalClicks`

### What we're showing in top cards:
- Using `selectedReport.stats` which should be correct
- BUT somewhere the display is using individual campaign CTR/CPC values

## Solution

Need to verify WHERE the top cards (3.15% / 0.35 zł) are pulling their data from:

1. **If using `selectedReport.stats`**: These should already be correct (calculated from totals)
2. **If using individual campaign values**: Need to change to use calculated totals

## Files to Check

1. `src/app/reports/page.tsx` - Lines around 3100-4000 where metrics cards are rendered
2. `src/components/WeeklyReportView.tsx` - Line 910-920 where CTR/CPC cards are shown
3. `src/components/PlatformSeparatedMetrics.tsx` - Line 141-149 for top-level metrics

## Expected Fix

The top cards should display the SAME values as the campaign table bottom:
- **CTR**: 1.14% (calculated from totals)
- **CPC**: 0.98 zł (calculated from totals)

NOT the individual campaign averages (3.15% / 0.35 zł).

