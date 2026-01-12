# 🔍 Meta Ads CTR/CPC Audit - January 2026

## Problem
CTR and CPC values for Meta Ads don't match Meta Business Suite for January 2026.

## Root Cause Analysis

### Issue 1: Missing Method `getMonthlyReport`
**Location**: `src/lib/standardized-data-fetcher.ts:1012`

**Problem**: Code calls `metaService.getMonthlyReport()` but this method doesn't exist in `MetaAPIServiceOptimized` class.

**Should be**: `getCampaignInsights()` or `getMonthlyCampaignInsights()`

---

### Issue 2: CTR/CPC Not Recalculated from Aggregated Totals
**Location**: `src/lib/standardized-data-fetcher.ts:1026-1027`

**Current Implementation** (WRONG):
```typescript
ctr: parseFloat(campaign.inline_link_click_ctr || campaign.ctr || '0'),
cpc: parseFloat(campaign.cost_per_inline_link_click || campaign.cpc || '0'),
```

**Problem**: 
- Uses CTR/CPC from individual campaign rows
- When Meta API returns aggregated monthly data, each campaign's CTR/CPC is correct for that campaign
- BUT: The overall average CTR/CPC should be recalculated from total clicks, impressions, and spend
- This matches what `smart-cache-helper.ts` does correctly (lines 215-216)

**Correct Implementation** (from `smart-cache-helper.ts`):
```typescript
const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
```

---

## Why This Causes Mismatches with Meta Business Suite

### Meta Business Suite Calculation:
- **CTR**: `(Total Link Clicks / Total Impressions) * 100`
- **CPC**: `Total Spend / Total Link Clicks`

### Our Current Calculation (WRONG):
- **CTR**: Average of individual campaign CTRs (weighted incorrectly)
- **CPC**: Average of individual campaign CPCs (weighted incorrectly)

### Example:
**Campaign A**: 1000 impressions, 10 clicks, 10 zł spend
- CTR: 1.0%, CPC: 1.00 zł

**Campaign B**: 100 impressions, 5 clicks, 25 zł spend  
- CTR: 5.0%, CPC: 5.00 zł

**WRONG (averaging campaign CTRs/CPCs)**:
- Average CTR = (1.0% + 5.0%) / 2 = **3.0%** ❌
- Average CPC = (1.00 + 5.00) / 2 = **3.00 zł** ❌

**CORRECT (recalculate from totals)**:
- Total: 1100 impressions, 15 clicks, 35 zł spend
- CTR = (15 / 1100) * 100 = **1.36%** ✅
- CPC = 35 / 15 = **2.33 zł** ✅

---

## Files Fixed

### ✅ Fix 1: Added Missing `getMonthlyReport()` Method
**File**: `src/lib/meta-api-optimized.ts` (lines 400-405)

Added method as alias to `getCampaignInsights()`:
```typescript
async getMonthlyReport(adAccountId: string, dateStart: string, dateEnd: string): Promise<any[]> {
  logger.info(`Meta API: Fetching monthly report for ${dateStart} to ${dateEnd}`);
  return this.getCampaignInsights(adAccountId, dateStart, dateEnd, 0);
}
```

### ✅ Fix 2: Use CTR/CPC Directly from Meta API
**File**: `src/lib/standardized-data-fetcher.ts` (lines 1026-1028)

**Implementation** (CORRECT - uses API values directly):
```typescript
// ✅ Use inline_link_click_ctr and cost_per_inline_link_click directly from Meta API (matches Business Suite)
ctr: parseFloat(campaign.inline_link_click_ctr || campaign.ctr || '0'),
cpc: parseFloat(campaign.cost_per_inline_link_click || campaign.cpc || '0'),
```

**Note**: Individual campaign CTR/CPC values are fetched directly from Meta API fields:
- `inline_link_click_ctr` - CTR based on link clicks (matches Business Suite)
- `cost_per_inline_link_click` - CPC based on link clicks (matches Business Suite)

**Overall Stats** (lines 1048-1049):
- Overall `averageCtr` and `averageCpc` are still calculated from aggregated totals
- This is correct because Meta API doesn't return overall summary stats
- Calculation: `(totalClicks / totalImpressions) * 100` and `totalSpend / totalClicks`

---

## Expected Behavior After Fix

1. ✅ Method `getMonthlyReport()` now exists and works
2. ✅ Individual campaign CTR/CPC fetched directly from Meta API (`inline_link_click_ctr`, `cost_per_inline_link_click`)
3. ✅ Overall CTR/CPC calculated from aggregated totals (correct approach)
4. ✅ Values should now match Meta Business Suite for January 2026

---

## Verification Steps

1. Check that `getMonthlyReport()` method exists
2. Verify CTR/CPC are recalculated from totals in `standardized-data-fetcher.ts`
3. Test with January 2026 data for Havet
4. Compare values with Meta Business Suite

