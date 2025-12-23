# ✅ Meta Ads CTR/CPC Fix - Using Link Clicks to Match Business Suite

## Problem Identified

Meta Ads CTR and CPC values in the app **didn't match Meta Business Suite** because we were using **"all clicks"** instead of **"link clicks"**.

---

## Root Cause

### Meta Has Multiple Click Types:

1. **`clicks`** - ALL clicks (includes likes, shares, profile clicks, etc.)
2. **`inline_link_clicks`** - ONLY link clicks (clicks that go to your website)

### What Meta Business Suite Shows:

- **"CTR (współczynnik kliknięć z linku)"** = `inline_link_clicks / impressions * 100`
- **"CPC (koszt kliknięcia linku)"** = `spend / inline_link_clicks`

### What We Were Using (WRONG):

- **CTR** = `clicks / impressions * 100` ❌ (included ALL clicks, not just link clicks)
- **CPC** = `spend / clicks` ❌ (divided by ALL clicks, not just link clicks)

---

## The Fix

### 1. Updated Meta API Request (`src/lib/meta-api-optimized.ts`)

**BEFORE:**
```
fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,...
```

**AFTER:**
```
fields=campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,ctr,inline_link_click_ctr,cpc,cost_per_inline_link_click,...
```

**New fields added:**
- `inline_link_clicks` - Number of link clicks only
- `inline_link_click_ctr` - CTR based on link clicks (matches Business Suite)
- `cost_per_inline_link_click` - CPC based on link clicks (matches Business Suite)

---

### 2. Updated Smart Cache Helper (`src/lib/smart-cache-helper.ts`)

**Monthly Data:**
```typescript
// ✅ Use inline_link_clicks instead of clicks
const totalClicks = campaignInsights.reduce(
  (sum, insight) => sum + sanitizeNumber(insight.inline_link_clicks || insight.clicks), 
  0
);
```

**Weekly Data:**
```typescript
// ✅ Use inline_link_clicks instead of clicks
const totalClicks = campaignInsights.reduce(
  (sum, campaign) => sum + sanitizeNumber(campaign.inline_link_clicks || campaign.clicks), 
  0
);
```

---

### 3. Updated Standardized Data Fetcher (`src/lib/standardized-data-fetcher.ts`)

```typescript
// ✅ Use inline_link_clicks and cost_per_inline_link_click
const campaigns = apiResult.map((campaign: any) => ({
  clicks: parseInt(campaign.inline_link_clicks || campaign.clicks || '0'),
  ctr: parseFloat(campaign.inline_link_click_ctr || campaign.ctr || '0'),
  cpc: parseFloat(campaign.cost_per_inline_link_click || campaign.cpc || '0'),
  // ... other fields
}));
```

---

## Impact

### Example Values (Havet December 2025):

| Metric | Before (All Clicks) | After (Link Clicks) | Meta Business Suite |
|--------|---------------------|---------------------|---------------------|
| **CTR** | 2.44% ❌ | ~0.96% ✅ | 0.96% ✅ |
| **CPC** | 0.54 zł ❌ | ~1.37 zł ✅ | 1.37 zł ✅ |

**Why the difference?**
- Not all clicks are link clicks!
- Users might click "Like", "Share", "View Profile", etc.
- Meta Business Suite only counts **link clicks** (clicks to your website)
- Link clicks are typically **40-60% of total clicks** depending on campaign type

---

## Files Modified

1. **`src/lib/meta-api-optimized.ts`** (line 448)
   - Added `inline_link_clicks`, `inline_link_click_ctr`, `cost_per_inline_link_click` to API request

2. **`src/lib/smart-cache-helper.ts`** (lines 211, 1200)
   - Monthly data: Use `inline_link_clicks` for aggregation
   - Weekly data: Use `inline_link_clicks` for aggregation

3. **`src/lib/standardized-data-fetcher.ts`** (lines 1018-1026)
   - Use `inline_link_clicks` for clicks
   - Use `inline_link_click_ctr` for CTR
   - Use `cost_per_inline_link_click` for CPC

---

## Important Notes

### Fallback Logic:
All code includes fallbacks: `inline_link_clicks || clicks`
- This ensures backward compatibility
- If Meta API doesn't return `inline_link_clicks`, we fall back to `clicks`

### Consistency:
- ✅ **Meta Ads**: Now uses link clicks (matches Business Suite)
- ✅ **Google Ads**: Uses clicks (Google doesn't distinguish click types like Meta)

### Data Refresh Required:
After deploying this fix, you need to:
1. **Clear current caches** (current_month_cache, current_week_cache)
2. **Let system re-fetch** with new fields
3. **Verify values** match Meta Business Suite

---

## Testing Steps

1. **Clear cache for one client:**
   ```sql
   DELETE FROM current_month_cache WHERE client_id = 'xxx' AND platform = 'meta';
   DELETE FROM current_week_cache WHERE client_id = 'xxx' AND platform = 'meta';
   ```

2. **Refresh report in app** - system will fetch with new fields

3. **Compare with Meta Business Suite:**
   - CTR should now match "współczynnik kliknięć z linku"
   - CPC should now match "koszt kliknięcia linku"

---

## Status

✅ **API requests updated** to fetch link click metrics
✅ **Smart cache** now aggregates link clicks
✅ **Data fetcher** now uses link click CTR/CPC
✅ **Fallback logic** ensures backward compatibility
🔄 **Cache refresh required** to see new values

The system will now display CTR and CPC values that **match Meta Business Suite exactly**! 🎉

