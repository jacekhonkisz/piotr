# ✅ Use API Values Directly for CTR/CPC (No Recalculation)

## Changes Made

Updated the system to **use CTR and CPC values directly from Meta API** instead of recalculating them from totals.

---

## What Changed

### 1. Added Account-Level Insights Fetch (`meta-api-optimized.ts`)

**New Method**: `getAccountInsights()`

```typescript
async getAccountInsights(adAccountId: string, dateStart: string, dateEnd: string): Promise<any | null> {
  // Fetches account-level insights with overall CTR/CPC directly from API
  // Uses level=account instead of level=campaign
  // Returns overall summary metrics: inline_link_click_ctr, cost_per_inline_link_click
}
```

**Purpose**: Try to get overall CTR/CPC directly from Meta API at account level (if supported).

---

### 2. Updated Monthly Data Fetch (`smart-cache-helper.ts` lines 208-266)

**Before** (Recalculated):
```typescript
const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
```

**After** (Uses API Values):
```typescript
// 1. Try to get account-level insights first
const accountInsights = await metaService.getAccountInsights(...);

if (accountInsights) {
  // ✅ Use account-level CTR/CPC directly from API
  averageCtr = accountInsights.inline_link_click_ctr;
  averageCpc = accountInsights.cost_per_inline_link_click;
} else {
  // 2. Fallback: Weighted average from campaign API values
  // Weight by clicks (more clicks = more influence)
  averageCtr = weightedAverageOfCampaignCTRs;
  averageCpc = weightedAverageOfCampaignCPCs;
  
  // 3. Final fallback: Calculate from totals (if no API values)
}
```

---

### 3. Updated Weekly Data Fetch (`smart-cache-helper.ts` lines 1258-1305)

Same logic as monthly - uses API values directly with fallbacks.

---

## How It Works Now

### Priority Order (Highest to Lowest):

1. **Account-Level API Values** ✅ (Preferred)
   - If Meta API supports `level=account` insights
   - Uses `inline_link_click_ctr` and `cost_per_inline_link_click` directly
   - **Matches Meta Business Suite exactly**

2. **Weighted Average of Campaign API Values** ✅ (Fallback 1)
   - If account-level not available
   - Uses each campaign's `inline_link_click_ctr` and `cost_per_inline_link_click`
   - Weighted by clicks (campaigns with more clicks have more influence)
   - **Uses API values directly, not recalculated**

3. **Calculated from Totals** ⚠️ (Final Fallback)
   - Only if no API values available at all
   - `CTR = (totalClicks / totalImpressions) * 100`
   - `CPC = totalSpend / totalClicks`

---

## Individual Campaigns

**No Change** - Already using API values directly:
- `ctr` = `inline_link_click_ctr` from API ✅
- `cpc` = `cost_per_inline_link_click` from API ✅

---

## Benefits

1. **Matches Meta Business Suite**: Uses same values Meta API provides
2. **No Calculation Errors**: Avoids potential rounding or aggregation issues
3. **Consistent**: Same values Meta shows in their UI
4. **Fallback Safety**: Still works if account-level insights not available

---

## Testing

After deployment, verify:
1. Overall summary CTR/CPC matches Meta Business Suite
2. Individual campaign CTR/CPC still matches (unchanged)
3. System gracefully handles cases where account-level insights not available

---

## Files Modified

- `src/lib/meta-api-optimized.ts` - Added `getAccountInsights()` method
- `src/lib/smart-cache-helper.ts` - Updated monthly and weekly data fetch to use API values

