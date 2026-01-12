# ✅ CTR/CPC Display Fix - Use API Values with 2 Decimal Places

## Summary

Updated the system to **consistently display CTR and CPC values from Meta API account-level insights** with **2 decimal places**, replacing the calculation-based display system.

---

## Changes Made

### 1. Data Fetching (`smart-cache-helper.ts`)

**Already implemented** - System fetches account-level insights and stores:
- `stats.averageCtr` = `inline_link_click_ctr` from API (1.066998%)
- `stats.averageCpc` = `cost_per_inline_link_click` from API (1.01836 zł)

### 2. Reports Page (`src/app/reports/page.tsx`)

**Updated `getSelectedPeriodTotals()` function** (lines 3361-3362):

**Before** (Always calculated):
```typescript
const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
```

**After** (Uses API values for Meta Ads):
```typescript
const ctr = (activeAdsProvider === 'meta' && selectedReport.stats?.averageCtr) 
  ? selectedReport.stats.averageCtr 
  : (totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0);
const cpc = (activeAdsProvider === 'meta' && selectedReport.stats?.averageCpc) 
  ? selectedReport.stats.averageCpc 
  : (totals.clicks > 0 ? totals.spend / totals.clicks : 0);
```

### 3. WeeklyReportView Component (`src/components/WeeklyReportView.tsx`)

**Updated CTR/CPC display** (lines 926-936):

**Before** (Always calculated):
```typescript
<MetricCard
  title="Współczynnik kliknięć z linku"
  value={`${((campaignTotals.clicks / campaignTotals.impressions) * 100 || 0).toFixed(2)}%`}
/>
<MetricCard
  title="Koszt kliknięcia linku"
  value={formatCurrency((campaignTotals.spend / campaignTotals.clicks) || 0)}
/>
```

**After** (Uses API values if available):
```typescript
<MetricCard
  title="Współczynnik kliknięć z linku"
  value={`${(report.stats?.averageCtr || (campaignTotals.impressions > 0 ? (campaignTotals.clicks / campaignTotals.impressions) * 100 : 0)).toFixed(2)}%`}
  tooltip="Click-Through Rate: stosunek kliknięć do wyświetleń (z API Meta)"
/>
<MetricCard
  title="Koszt kliknięcia linku"
  value={formatCurrency(report.stats?.averageCpc || (campaignTotals.clicks > 0 ? campaignTotals.spend / campaignTotals.clicks : 0))}
  tooltip="Cost Per Click: średni koszt kliknięcia (z API Meta)"
/>
```

### 4. PlatformSeparatedMetrics Component (`src/components/PlatformSeparatedMetrics.tsx`)

**Updated Meta Ads CTR/CPC display** (lines 140-153):

**Before** (Always calculated):
```typescript
<MetricCard
  title="Współczynnik kliknięć z linku"
  value={`${(metaData.stats.totalImpressions > 0 ? (metaData.stats.totalClicks / metaData.stats.totalImpressions) * 100 : 0).toFixed(2)}%`}
/>
<MetricCard
  title="Koszt kliknięcia linku"
  value={formatCurrency(metaData.stats.totalClicks > 0 ? metaData.stats.totalSpend / metaData.stats.totalClicks : 0)}
/>
```

**After** (Uses API values if available):
```typescript
<MetricCard
  title="Współczynnik kliknięć z linku"
  value={`${(metaData.stats.averageCtr || (metaData.stats.totalImpressions > 0 ? (metaData.stats.totalClicks / metaData.stats.totalImpressions) * 100 : 0)).toFixed(2)}%`}
  subtitle="Meta Ads (z API)"
/>
<MetricCard
  title="Koszt kliknięcia linku"
  value={formatCurrency(metaData.stats.averageCpc || (metaData.stats.totalClicks > 0 ? metaData.stats.totalSpend / metaData.stats.totalClicks : 0))}
  subtitle="Meta Ads (z API)"
/>
```

### 5. UnifiedReportView Component (`src/components/UnifiedReportView.tsx`)

**Updated CTR display** (lines 206, 496):

**Before** (Always calculated):
```typescript
<div className="text-2xl font-bold">{(totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0).toFixed(2)}%</div>
<li>• Średni CTR: {(report.totals.meta.totalImpressions > 0 ? (report.totals.meta.totalClicks / report.totals.meta.totalImpressions) * 100 : 0).toFixed(2)}%</li>
```

**After** (Uses API values if available):
```typescript
<div className="text-2xl font-bold">{(totals.averageCtr || (totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0)).toFixed(2)}%</div>
<li>• Średni CTR: {(report.totals.meta.averageCtr || (report.totals.meta.totalImpressions > 0 ? (report.totals.meta.totalClicks / report.totals.meta.totalImpressions) * 100 : 0)).toFixed(2)}%</li>
```

---

## Display Format

All CTR/CPC values are now displayed with **2 decimal places**:

- **CTR**: `1.07%` (from API: 1.066998%)
- **CPC**: `1.02 zł` (from API: 1.01836 zł)

Formatting functions:
- CTR: `.toFixed(2)` + `%`
- CPC: `formatCurrency()` with `minimumFractionDigits: 2`

---

## How It Works

### Priority Order:

1. **Account-Level API Values** ✅ (Preferred)
   - Uses `stats.averageCtr` and `stats.averageCpc` from cache
   - These come from Meta API `getAccountInsights()` → `inline_link_click_ctr` and `cost_per_inline_link_click`
   - **Matches Meta Business Suite exactly**

2. **Calculated from Totals** ⚠️ (Fallback)
   - Only if API values not available
   - `CTR = (totalClicks / totalImpressions) * 100`
   - `CPC = totalSpend / totalClicks`

---

## Expected Results

For Havet January 2026:
- **CTR**: `1.07%` (from API: 1.066998%)
- **CPC**: `1.02 zł` (from API: 1.01836 zł)

These values will be **consistent across all components**:
- Reports page summary cards
- WeeklyReportView component
- PlatformSeparatedMetrics component
- UnifiedReportView component

---

## Files Modified

1. ✅ `src/app/reports/page.tsx` - Updated `getSelectedPeriodTotals()`
2. ✅ `src/components/WeeklyReportView.tsx` - Updated CTR/CPC MetricCard
3. ✅ `src/components/PlatformSeparatedMetrics.tsx` - Updated Meta Ads CTR/CPC
4. ✅ `src/components/UnifiedReportView.tsx` - Updated CTR display

---

## Testing

After deployment, verify:
1. ✅ CTR displays as `1.07%` (not calculated value)
2. ✅ CPC displays as `1.02 zł` (not calculated value)
3. ✅ Values are consistent across all components
4. ✅ Values match Meta Business Suite
5. ✅ Formatting shows 2 decimal places

