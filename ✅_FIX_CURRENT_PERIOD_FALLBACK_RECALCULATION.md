# ✅ Fix: Current Period Fallback Recalculation

## Issue Found

Current period (January 2026) was falling back to **recalculation** instead of using API values when:
1. Smart cache was empty/missing
2. System fell back to `fetchFromLiveAPIWithCaching`
3. System fell back to `fetchFromDailyKpiData`

## Root Causes

### 1. ❌ `fetchFromLiveAPIWithCaching` Recalculated
**File**: `src/lib/standardized-data-fetcher.ts` (lines 1060-1061)

**Issue**: When falling back to live API, it recalculated CTR/CPC from totals:
```typescript
averageCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
averageCpc: totalClicks > 0 ? totalSpend / totalClicks : 0
```

**Fix**: ✅ Now fetches account-level insights first, then falls back to calculation only if API values unavailable.

### 2. ❌ `fetchFromDailyKpiData` Recalculated
**File**: `src/lib/standardized-data-fetcher.ts` (lines 615-616)

**Issue**: When using `daily_kpi_data`, it always recalculated CTR/CPC from totals.

**Fix**: ✅ Now checks `campaign_summaries` for API values first, then falls back to calculation only if unavailable.

## Fixes Applied

### Fix 1: `fetchFromLiveAPIWithCaching` ✅
**File**: `src/lib/standardized-data-fetcher.ts` (lines 1044-1085)

**Before**:
```typescript
stats: {
  totalSpend,
  totalImpressions,
  totalClicks,
  totalConversions,
  averageCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
  averageCpc: totalClicks > 0 ? totalSpend / totalClicks : 0
}
```

**After**:
```typescript
// ✅ CRITICAL FIX: Fetch account-level insights for CTR/CPC
let averageCtr: number;
let averageCpc: number;

try {
  const accountInsights = await metaService.getAccountInsights(adAccountId, dateRange.start, dateRange.end);
  if (accountInsights) {
    averageCtr = parseFloat(accountInsights.inline_link_click_ctr || accountInsights.ctr || '0');
    averageCpc = parseFloat(accountInsights.cost_per_inline_link_click || accountInsights.cpc || '0');
    console.log('✅ Using CTR/CPC directly from account-level API insights');
  } else {
    // Fallback: Calculate from totals
    averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  }
} catch (accountError) {
  // Fallback: Calculate from totals
  averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
}

stats: {
  totalSpend,
  totalImpressions,
  totalClicks,
  totalConversions,
  averageCtr,
  averageCpc
}
```

### Fix 2: `fetchFromDailyKpiData` ✅
**File**: `src/lib/standardized-data-fetcher.ts` (lines 614-640)

**Before**:
```typescript
const averageCtr = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0;
const averageCpc = totals.totalClicks > 0 ? totals.totalSpend / totals.totalClicks : 0;
```

**After**:
```typescript
// ✅ CRITICAL FIX: Try to get API values from campaign_summaries first (for Meta Ads)
let averageCtr: number;
let averageCpc: number;

if (platform === 'meta') {
  // Try to get API values from campaign_summaries for this period
  const { data: summary } = await dbClient
    .from('campaign_summaries')
    .select('average_ctr, average_cpc')
    .eq('client_id', clientId)
    .eq('platform', 'meta')
    .gte('summary_date', dateRange.start)
    .lte('summary_date', dateRange.end)
    .order('summary_date', { ascending: false })
    .limit(1)
    .single();
  
  if (summary && summary.average_ctr !== null && summary.average_ctr !== undefined) {
    averageCtr = summary.average_ctr;
    averageCpc = summary.average_cpc;
    console.log('✅ Using API values from campaign_summaries for CTR/CPC');
  } else {
    // Fallback: Calculate from totals
    averageCtr = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0;
    averageCpc = totals.totalClicks > 0 ? totals.totalSpend / totals.totalClicks : 0;
  }
} else {
  // For Google Ads, calculate from totals
  averageCtr = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0;
  averageCpc = totals.totalClicks > 0 ? totals.totalSpend / totals.totalClicks : 0;
}
```

## Complete Data Flow (After Fix)

### Current Period Flow:

1. **Primary**: Smart Cache
   - ✅ Uses account-level insights
   - ✅ Stores API values in cache
   - ✅ Returns API values

2. **Fallback 1**: `fetchFromLiveAPIWithCaching`
   - ✅ **NOW FIXED**: Fetches account-level insights
   - ✅ Uses API values if available
   - ✅ Falls back to calculation only if API unavailable

3. **Fallback 2**: `fetchFromDailyKpiData`
   - ✅ **NOW FIXED**: Checks `campaign_summaries` for API values
   - ✅ Uses API values if available
   - ✅ Falls back to calculation only if API unavailable

4. **Display Components**
   - ✅ Check for existence (not truthiness)
   - ✅ Use API values when available
   - ✅ Fallback to calculation only when truly missing

## Result

**Status**: ✅ **FIXED**

All fallback paths now use API values when available:
- ✅ Smart cache: Uses API values
- ✅ Live API fallback: Uses API values
- ✅ Daily KPI fallback: Uses API values from campaign_summaries
- ✅ Display: Uses API values

**No more recalculation** for current periods when API values are available!

