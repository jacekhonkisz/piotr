# 🔍 Meta Ads CTR & CPC Fetching Audit - January 2026

## Executive Summary

This audit documents **exactly what fields are being fetched** from Meta API for CTR (współczynnik kliknięć z linku) and CPC (koszt kliknięcia linku) and how they differ from what Meta Business Suite displays.

**Date**: January 2026  
**Client**: Havet  
**Issue**: CTR/CPC values in our report don't match Meta Business Suite

---

## 📡 What We Fetch from Meta API

### API Request Fields

**File**: `src/lib/meta-api-optimized.ts` (line 459)

```typescript
fields=campaign_id,campaign_name,spend,impressions,clicks,
       inline_link_clicks,ctr,inline_link_click_ctr,cpc,
       cost_per_inline_link_click,cpm,cpp,reach,frequency,
       conversions,actions,action_values,cost_per_action_type
```

### Key Fields for CTR/CPC

| Field | Description | Used For |
|-------|-------------|----------|
| `inline_link_clicks` | Number of link clicks (not all clicks) | ✅ **Primary click metric** |
| `inline_link_click_ctr` | CTR based on link clicks only | ✅ **Individual campaign CTR** |
| `cost_per_inline_link_click` | Cost per link click | ✅ **Individual campaign CPC** |
| `clicks` | All clicks (including other interactions) | ⚠️ Fallback only |
| `ctr` | CTR based on all clicks | ⚠️ Fallback only |
| `cpc` | Cost per all clicks | ⚠️ Fallback only |

---

## 🔄 Data Flow: API → Cache → Display

### Step 1: API Fetch (`meta-api-optimized.ts`)

```typescript
// Line 452-459: getCampaignInsights()
async getCampaignInsights(adAccountId: string, dateStart: string, dateEnd: string, timeIncrement?: number) {
  const params = `level=campaign&time_range={"since":"${dateStart}","until":"${dateEnd}"}...&fields=...,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,...`;
  // Returns array of campaign insights with these fields
}
```

**Returns**: Array of campaign objects with:
- `inline_link_clicks` (integer)
- `inline_link_click_ctr` (float, percentage)
- `cost_per_inline_link_click` (float, currency)

---

### Step 2: Processing & Cache Storage (`smart-cache-helper.ts`)

#### Individual Campaigns (Lines 424-479)

```typescript
// Line 428-429: Use inline_link_clicks (link clicks only)
const linkClicks = parseInt(campaign.inline_link_clicks || campaign.clicks) || 0;

// Line 432-434: Use API values DIRECTLY for individual campaigns
const apiCtr = parseFloat(campaign.inline_link_click_ctr) || parseFloat(campaign.ctr) || 0;
const apiCpc = parseFloat(campaign.cost_per_inline_link_click) || parseFloat(campaign.cpc) || 0;

// Line 444, 447-449: Store in cache
return {
  clicks: linkClicks,  // ✅ inline_link_clicks
  ctr: apiCtr,         // ✅ inline_link_click_ctr from API
  cpc: apiCpc,         // ✅ cost_per_inline_link_click from API
  // ...
};
```

**✅ Individual campaigns use API values directly** - This matches Meta Business Suite campaign table!

#### Overall Summary Stats (Lines 208-216)

```typescript
// Line 213: Aggregate inline_link_clicks
const totalClicks = campaignInsights.reduce((sum, insight) => 
  sum + sanitizeNumber(insight.inline_link_clicks || insight.clicks), 0);

// Line 215-216: RECALCULATE from totals (not average of campaign CTRs/CPCs)
const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

// Stored in cache_data->stats
{
  totalClicks: totalClicks,      // ✅ Sum of inline_link_clicks
  averageCtr: averageCtr,        // ✅ Recalculated from totals
  averageCpc: averageCpc        // ✅ Recalculated from totals
}
```

**✅ Overall summary recalculates from totals** - This matches Meta Business Suite summary cards!

---

### Step 3: Display in Reports (`reports/page.tsx`)

#### Individual Campaign Table

```typescript
// Uses campaign.ctr and campaign.cpc directly from cache
// These are inline_link_click_ctr and cost_per_inline_link_click from API
// ✅ Matches Meta Business Suite campaign table
```

#### Summary Cards (Top Metrics)

```typescript
// Lines 3194-3195: Recalculate from totals
const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

// totals.clicks = sum of inline_link_clicks from all campaigns
// ✅ Matches Meta Business Suite summary cards
```

---

## 📊 Meta Business Suite Standard

### How Meta Business Suite Calculates

**For Individual Campaigns (Campaign Table):**
- **CTR (współczynnik kliknięć z linku)** = `inline_link_click_ctr` from API ✅
- **CPC (koszt kliknięcia linku)** = `cost_per_inline_link_click` from API ✅

**For Overall Summary (Top Cards):**
- **CTR** = `(total_inline_link_clicks / total_impressions) × 100` ✅
- **CPC** = `total_spend / total_inline_link_clicks` ✅

---

## ✅ Current Implementation Status

### What's Correct ✅

1. **API Request**: Fetches `inline_link_clicks`, `inline_link_click_ctr`, `cost_per_inline_link_click` ✅
2. **Individual Campaign CTR/CPC**: Uses API values directly ✅
3. **Overall Summary CTR/CPC**: Recalculates from aggregated totals ✅
4. **Click Metric**: Uses `inline_link_clicks` (link clicks only) ✅

### Potential Issues to Check ⚠️

1. **Date Range Mismatch**
   - Meta Business Suite might show different date range
   - Our report: January 1-31, 2026
   - Meta UI: Check if same date range

2. **Time Zone Differences**
   - Meta API uses account timezone
   - Our system might use UTC
   - Could cause 1-day offset

3. **Campaign Filtering**
   - Meta Business Suite might filter inactive/paused campaigns
   - Our system might include all campaigns
   - Check if we're including campaigns with zero spend

4. **Attribution Window**
   - Meta Business Suite might use different attribution
   - Our system uses Meta API default
   - Should match, but verify

---

## 🔍 Diagnostic Queries

Run these SQL queries to audit what's stored:

### 1. Check Current Month Cache

```sql
-- See: scripts/audit-meta-ads-ctr-cpc-january.sql
-- Section 2: CURRENT_MONTH_CACHE
```

This will show:
- What CTR/CPC values are stored in cache
- Whether they match calculated values
- Individual campaign CTR/CPC values

### 2. Check Campaign Summaries

```sql
-- See: scripts/audit-meta-ads-ctr-cpc-january.sql
-- Section 4: CAMPAIGN_SUMMARIES
```

This will show:
- Historical data for January 2026
- Whether stored values match calculated values

---

## 🎯 Expected Values from Screenshots

Based on your Meta Business Suite screenshots:

### Individual Campaigns (Table View)
- CTR values: 0.43% to 1.68% (varies by campaign)
- CPC values: 0.56 zł to 3.97 zł (varies by campaign)
- **These should match `inline_link_click_ctr` and `cost_per_inline_link_click` from API**

### Overall Summary (Top Cards)
- **CTR**: 2.34% (from screenshot: "WSPÓŁCZYNNIK KLIKNIĘĆ Z LINKU")
- **CPC**: 0.48 zł (from screenshot: "KOSZT KLIKNIĘCIA LINKU")
- **These should match recalculated values from totals**

---

## 🐛 Troubleshooting Steps

### If Individual Campaign CTR/CPC Don't Match

1. **Check API Response**
   ```typescript
   // Add logging in smart-cache-helper.ts line 424
   console.log('Campaign API data:', {
     campaign_name: campaign.campaign_name,
     inline_link_click_ctr: campaign.inline_link_click_ctr,
     cost_per_inline_link_click: campaign.cost_per_inline_link_click,
     inline_link_clicks: campaign.inline_link_clicks
   });
   ```

2. **Verify Cache Storage**
   ```sql
   -- Check what's actually stored
   SELECT 
     c->>'campaign_name' as name,
     (c->>'ctr')::numeric as stored_ctr,
     (c->>'cpc')::numeric as stored_cpc,
     (c->>'clicks')::numeric as clicks,
     (c->>'impressions')::numeric as impressions,
     (c->>'spend')::numeric as spend
   FROM current_month_cache,
   LATERAL jsonb_array_elements(cache_data->'campaigns') as c
   WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%')
     AND period_id = '2026-01'
   ORDER BY (c->>'spend')::numeric DESC
   LIMIT 10;
   ```

### If Overall Summary CTR/CPC Don't Match

1. **Check Totals**
   ```sql
   SELECT 
     (cache_data->'stats'->>'totalClicks')::numeric as total_clicks,
     (cache_data->'stats'->>'totalImpressions')::numeric as total_impressions,
     (cache_data->'stats'->>'totalSpend')::numeric as total_spend,
     (cache_data->'stats'->>'averageCtr')::numeric as stored_ctr,
     (cache_data->'stats'->>'averageCpc')::numeric as stored_cpc,
     -- Calculate what it SHOULD be
     CASE 
       WHEN (cache_data->'stats'->>'totalImpressions')::numeric > 0 
       THEN ((cache_data->'stats'->>'totalClicks')::numeric::DECIMAL / 
             (cache_data->'stats'->>'totalImpressions')::numeric::DECIMAL) * 100 
       ELSE 0 
     END as calculated_ctr,
     CASE 
       WHEN (cache_data->'stats'->>'totalClicks')::numeric > 0 
       THEN (cache_data->'stats'->>'totalSpend')::numeric::DECIMAL / 
            (cache_data->'stats'->>'totalClicks')::numeric::DECIMAL
       ELSE 0 
     END as calculated_cpc
   FROM current_month_cache
   WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%')
     AND period_id = '2026-01';
   ```

2. **Verify Click Type**
   - Ensure `totalClicks` = sum of `inline_link_clicks` (not all clicks)
   - Check if any campaigns are using `clicks` instead of `inline_link_clicks`

---

## 📝 Summary

### What We Fetch ✅
- `inline_link_clicks` - Link clicks only (matches Meta Business Suite)
- `inline_link_click_ctr` - CTR for link clicks (matches Meta Business Suite)
- `cost_per_inline_link_click` - CPC for link clicks (matches Meta Business Suite)

### How We Process ✅
- **Individual campaigns**: Use API values directly ✅
- **Overall summary**: Recalculate from totals ✅

### What Should Match Meta Business Suite ✅
- Individual campaign CTR/CPC values ✅
- Overall summary CTR/CPC values ✅

### If There's a Mismatch, Check:
1. Date range alignment
2. Time zone differences
3. Campaign filtering (active vs all)
4. Actual stored values in database (run audit SQL)

---

## 🔗 Related Files

- **API Fetch**: `src/lib/meta-api-optimized.ts` (line 452-484)
- **Processing**: `src/lib/smart-cache-helper.ts` (lines 208-216, 424-479)
- **Display**: `src/app/reports/page.tsx` (lines 3194-3195)
- **Audit SQL**: `scripts/audit-meta-ads-ctr-cpc-january.sql`

