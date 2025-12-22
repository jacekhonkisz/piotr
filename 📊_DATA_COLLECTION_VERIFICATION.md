# 📊 Data Collection Verification

**Question**: Are we fetching ALL demographic info, ALL metrics, and ALL campaigns?

---

## ✅ What's Being Fetched

### 1. **Campaigns** ✅
**Method**: `getCampaignInsights()`
- ✅ Fetches ALL campaigns for the period
- ✅ Includes: campaign_id, campaign_name, spend, impressions, clicks, conversions
- ✅ Includes: `actions` and `action_values` arrays (for conversion metrics)
- ✅ Parsed with `enhanceCampaignsWithConversions()` to extract all conversion metrics

**Location**: `src/lib/background-data-collector.ts:560-608`

### 2. **Demographic Performance** ✅
**Method**: `getDemographicPerformance()`
- ✅ Fetches demographic breakdown by age and gender
- ✅ Includes conversion metrics in demographic data
- ✅ Stored in `meta_tables.demographicPerformance`

**Location**: `src/lib/background-data-collector.ts:644`

### 3. **Placement Performance** ✅
**Method**: `getPlacementPerformance()`
- ✅ Fetches placement breakdown by publisher_platform and platform_position
- ✅ Includes conversion metrics in placement data
- ✅ Stored in `meta_tables.placementPerformance`

**Location**: `src/lib/background-data-collector.ts:642`

### 4. **Ad Relevance Results** ✅
**Method**: `getAdRelevanceResults()`
- ✅ Fetches ad relevance metrics
- ✅ Stored in `meta_tables.adRelevanceResults`

**Location**: `src/lib/background-data-collector.ts:646`

### 5. **All Conversion Metrics** ✅
**Parsed from `actions` array**:
- ✅ `click_to_call` (updated parser to include `call` and lead actions)
- ✅ `email_contacts` (updated parser to include `add_meta_leads` and `lead`)
- ✅ `booking_step_1` (search actions)
- ✅ `booking_step_2` (view_content actions)
- ✅ `booking_step_3` (initiate_checkout actions)
- ✅ `reservations` (purchase actions)
- ✅ `reservation_value` (from action_values array)

**Location**: `src/lib/meta-actions-parser.ts`

---

## 📊 Storage in Database

### Table: `campaign_summaries`

**Fields**:
- `campaigns` (JSONB) - Array of all campaigns with full metrics
- `meta_tables` (JSONB) - Contains:
  - `placementPerformance` - Placement breakdown data
  - `demographicPerformance` - Demographic breakdown data
  - `adRelevanceResults` - Ad relevance metrics
- `click_to_call`, `email_contacts`, `booking_step_1`, etc. - All conversion metrics

**Location**: `src/lib/background-data-collector.ts:1169-1200`

---

## ⚠️ Current Limitation

**Current Week**: Meta tables are **skipped** for current week to reduce API calls
- Line 656-657: `if (!weekData.isCurrent)` - Only fetches meta tables for completed weeks
- **Reason**: Current week data changes frequently, so it's fetched on-demand via smart cache

**Impact**: 
- ✅ Historical weeks: Full data (campaigns + demographics + placement + ad relevance)
- ⚠️ Current week: Only campaigns (meta tables fetched separately via smart cache)

---

## 🔍 Verification Query

Run this SQL to verify all data is collected:

```sql
-- See scripts/verify-all-data-collected.sql
```

This will check:
1. ✅ Campaigns are stored
2. ✅ Meta tables (demographics, placement, ad relevance) are stored
3. ✅ Sample demographic data structure
4. ✅ Sample placement data structure
5. ✅ All conversion metrics

---

## 📋 Comparison: Smart Cache vs Background Collector

| Data Type | Smart Cache (Current Month) | Background Collector (Historical) |
|-----------|----------------------------|----------------------------------|
| **Campaigns** | ✅ All campaigns | ✅ All campaigns |
| **Demographics** | ✅ Full breakdown | ✅ Full breakdown (except current week) |
| **Placement** | ✅ Full breakdown | ✅ Full breakdown (except current week) |
| **Ad Relevance** | ✅ Full data | ✅ Full data (except current week) |
| **Conversion Metrics** | ✅ All metrics | ✅ All metrics (updated parser) |

---

## ✅ Summary

**YES** - We are fetching:
- ✅ ALL campaigns
- ✅ ALL demographic info (for completed weeks)
- ✅ ALL placement info (for completed weeks)
- ✅ ALL ad relevance data (for completed weeks)
- ✅ ALL conversion metrics (click_to_call, email_contacts, booking steps, reservations)

**Note**: Current week meta tables are fetched separately via smart cache to reduce API calls and ensure fresh data.



