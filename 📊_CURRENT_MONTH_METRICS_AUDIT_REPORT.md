# 📊 Current Month Data Collection - Complete Metrics Audit

## Executive Summary

This report audits **HOW EACH METRIC** is fetched for current month data, tracing the complete data flow from Meta API to database storage.

**Date**: November 18, 2025  
**Scope**: Current Month Data Collection (Smart Cache System)  
**Platform**: Meta Ads (Facebook/Instagram)

---

## 🔍 Data Flow Overview

```
Meta API (raw response)
    ↓
getCampaignInsights() - Fetches campaigns with actions array
    ↓
enhanceCampaignsWithConversions() - Parses actions array
    ↓
Smart Cache - Stores parsed data
    ↓
current_month_cache table
    ↓
Frontend Reports
```

---

## 📋 METRIC-BY-METRIC BREAKDOWN

### 1. **CORE ADVERTISING METRICS** (Direct from Meta API)

#### Source: `Meta Graph API` → `getCampaignInsights()`
**File**: `src/lib/meta-api-optimized.ts` (line 397-425)

| Metric | Meta API Field | Type | Description |
|--------|---------------|------|-------------|
| **spend** | `spend` | float | Total amount spent |
| **impressions** | `impressions` | integer | Number of times ads were shown |
| **clicks** | `clicks` | integer | Number of clicks on ads |
| **conversions** | `conversions` | integer | Total Meta-tracked conversions |
| **ctr** | `ctr` | float | Click-through rate (%) |
| **cpc** | `cpc` | float | Cost per click |
| **cpm** | `cpm` | float | Cost per 1000 impressions |
| **cpp** | `cpp` | float | Cost per point |
| **reach** | `reach` | integer | Unique users reached |
| **frequency** | `frequency` | float | Average times user saw ad |

**API Request Fields**:
```
fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,cpp,
       reach,frequency,conversions,actions,action_values,cost_per_action_type
```

**✅ Status**: Fetched directly from Meta API, no processing needed

---

### 2. **CONVERSION FUNNEL METRICS** (Parsed from actions array)

#### Source: `Meta API actions array` → `parseMetaActions()` → `enhanceCampaignsWithConversions()`
**File**: `src/lib/meta-actions-parser.ts` (line 33-182)

These metrics are **NOT** direct Meta API fields. They are extracted from the `actions` and `action_values` arrays.

#### 2.1 **click_to_call** (Phone Conversions)
**Extraction Logic** (line 72-75):
```typescript
if (actionType.includes('click_to_call') || 
    actionType.includes('phone_number_clicks')) {
  metrics.click_to_call += value;
}
```
**Meta Action Types**:
- `click_to_call`
- `phone_number_clicks`

**✅ Status**: Parsed from actions array

---

#### 2.2 **email_contacts** (Email Conversions)
**Extraction Logic** (line 77-82):
```typescript
if (actionType.includes('contact') || 
    actionType.includes('email') ||
    actionType.includes('onsite_web_lead')) {
  metrics.email_contacts += value;
}
```
**Meta Action Types**:
- `contact`
- `email`
- `onsite_web_lead`

**✅ Status**: Parsed from actions array

---

#### 2.3 **booking_step_1** (Booking Engine Search)
**Extraction Logic** (line 84-93):
```typescript
if (actionType.includes('booking_step_1') || 
    actionType.includes('search') ||
    actionType === 'search' ||
    actionType === 'omni_search' ||
    actionType.includes('fb_pixel_search')) {
  metrics.booking_step_1 += value;
}
```
**Meta Action Types**:
- `search`
- `omni_search`
- `offsite_conversion.fb_pixel_search`
- `booking_step_1` (custom)

**Maps to**: Meta Ads Manager column "**Search**"

**✅ Status**: Parsed from actions array

---

#### 2.4 **booking_step_2** (View Content/Booking Details)
**Extraction Logic** (line 95-105):
```typescript
if (actionType.includes('booking_step_2') || 
    actionType.includes('view_content') ||
    actionType === 'view_content' ||
    actionType === 'omni_view_content' ||
    actionType.includes('fb_pixel_view_content') ||
    actionType.includes('offsite_conversion.custom.1150356839010935')) {
  metrics.booking_step_2 += value;
}
```
**Meta Action Types**:
- `view_content`
- `omni_view_content`
- `offsite_conversion.fb_pixel_view_content`
- `offsite_conversion.custom.1150356839010935`
- `booking_step_2` (custom)

**Maps to**: Meta Ads Manager column "**View Content**"

**✅ Status**: Parsed from actions array

---

#### 2.5 **booking_step_3** (Initiate Checkout/Begin Booking)
**Extraction Logic** (line 107-117):
```typescript
if (actionType.includes('booking_step_3') || 
    actionType.includes('initiate_checkout') ||
    actionType === 'initiate_checkout' ||
    actionType === 'omni_initiate_checkout' ||
    actionType.includes('fb_pixel_initiate_checkout')) {
  metrics.booking_step_3 += value;
}
```
**Meta Action Types**:
- `initiate_checkout`
- `omni_initiate_checkout`
- `offsite_conversion.fb_pixel_initiate_checkout`
- `booking_step_3` (custom)

**Maps to**: Meta Ads Manager column "**Initiate Checkout**"

**✅ Status**: Parsed from actions array

---

#### 2.6 **reservations** (Completed Bookings/Purchases)
**Extraction Logic** (line 119-129):
```typescript
if (actionType === 'purchase' || 
    actionType.includes('fb_pixel_purchase') ||
    actionType.includes('offsite_conversion.fb_pixel_purchase') ||
    actionType.includes('omni_purchase') ||
    actionType === 'onsite_web_purchase' ||
    actionType.includes('complete_registration') ||
    actionType.includes('fb_pixel_complete_registration')) {
  metrics.reservations += value;
}
```
**Meta Action Types**:
- `purchase`
- `omni_purchase`
- `offsite_conversion.fb_pixel_purchase`
- `onsite_web_purchase`
- `complete_registration`
- `offsite_conversion.fb_pixel_complete_registration`

**Maps to**: Meta Ads Manager column "**Purchase**" or "**Complete Registration**"

**✅ Status**: Parsed from actions array

---

#### 2.7 **reservation_value** (Booking Value/Revenue)
**Extraction Logic** (line 150-157 from `action_values` array):
```typescript
if (actionType === 'purchase' || 
    actionType.includes('fb_pixel_purchase') ||
    actionType.includes('offsite_conversion.fb_pixel_purchase') ||
    actionType.includes('omni_purchase') ||
    actionType === 'onsite_web_purchase') {
  metrics.reservation_value += value;
}
```
**Meta Action Types** (from `action_values`):
- `purchase` (value)
- `omni_purchase` (value)
- `offsite_conversion.fb_pixel_purchase` (value)
- `onsite_web_purchase` (value)

**Maps to**: Meta Ads Manager column "**Purchase Conversion Value**"

**✅ Status**: Parsed from action_values array

---

### 3. **FALLBACK CONVERSION METRICS** (daily_kpi_data)

#### Source: `daily_kpi_data` table
**File**: `src/lib/smart-cache-helper.ts` (line 236-272)

If Meta API `actions` array has no conversion data (all zeros), the system falls back to aggregating from `daily_kpi_data`:

**Query**:
```sql
SELECT * FROM daily_kpi_data
WHERE client_id = ?
  AND date >= current_month_start
  AND date <= current_month_end
```

**Aggregated Metrics**:
- click_to_call
- email_contacts
- booking_step_1
- booking_step_2
- booking_step_3
- reservations
- reservation_value

**Priority**:
1. **PRIMARY**: Parsed Meta API actions array (if has data)
2. **FALLBACK**: daily_kpi_data aggregation (if Meta API has no conversion data)

**⚠️ Note**: Currently smart cache uses daily_kpi_data as PRIMARY source, overriding Meta API parsed data. This needs alignment with monthly/weekly logic.

---

### 4. **META TABLES DATA** (Detailed Breakdowns)

#### Source: Multiple Meta API endpoints
**File**: `src/lib/meta-api-optimized.ts`

#### 4.1 **Placement Performance**
**Endpoint**: `act_{ad_account_id}/insights`  
**Breakdown**: `publisher_platform,platform_position`  
**Function**: `getPlacementPerformance()` (line 461-507)

**Fields**:
- impressions
- clicks
- spend
- cpm, cpc, ctr
- actions (for conversion data)
- action_values (for revenue data)

**Breakdowns**:
- Facebook Feed
- Facebook Stories
- Instagram Feed
- Instagram Stories
- Messenger
- Audience Network

**✅ Status**: Fetched separately from Meta API

---

#### 4.2 **Demographic Performance**
**Endpoint**: `act_{ad_account_id}/insights`  
**Breakdown**: `age,gender`  
**Function**: `getDemographicPerformance()` (line 509-555)

**Fields**:
- Same as placement performance

**Breakdowns**:
- Age ranges (18-24, 25-34, 35-44, 45-54, 55-64, 65+)
- Gender (Male, Female, Unknown)

**✅ Status**: Fetched separately from Meta API

---

#### 4.3 **Ad Relevance Results**
**Endpoint**: `act_{ad_account_id}/ads`  
**Fields**: `quality_score_organic,quality_score_ectr,quality_score_ecvr`  
**Function**: `getAdRelevanceResults()` (line 557-599)

**Metrics**:
- Quality Score (Organic)
- Engagement Score
- Conversion Score

**✅ Status**: Fetched separately from Meta API

---

## 🔄 CURRENT MONTH COLLECTION FLOW

### Step-by-Step Process

**File**: `src/lib/smart-cache-helper.ts` → `fetchFreshCurrentMonthData()`

1. **Initialize Meta API Service** (line 101)
   ```typescript
   const metaService = new MetaAPIServiceOptimized(metaToken);
   ```

2. **Fetch Raw Campaign Insights** (line 122-127)
   ```typescript
   const rawCampaignInsights = await metaService.getCampaignInsights(
     adAccountId,
     currentMonth.startDate,
     currentMonth.endDate,
     0 // timeIncrement: 0 for monthly aggregate
   );
   ```

3. **✅ Parse Actions Array** (line 130)
   ```typescript
   campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);
   ```
   This step calls `parseMetaActions()` for EACH campaign to extract conversion metrics.

4. **Aggregate Metrics** (line 197-212)
   ```typescript
   const totalSpend = campaignInsights.reduce((sum, insight) => 
     sum + (parseFloat(insight.spend) || 0), 0);
   // ... aggregate other metrics
   ```

5. **Fallback to daily_kpi_data** (line 236-272)
   If no conversion data from Meta API, aggregate from daily_kpi_data.

6. **Fetch Meta Tables** (not shown in smart cache)
   Placement, demographic, and ad relevance data fetched separately.

7. **Store in Cache** (line 414-470)
   Store parsed and aggregated data in `current_month_cache` table.

---

## ⚠️ CRITICAL ISSUES IDENTIFIED

### 🚨 Issue #1: Background Collector Missing Actions Parser

**File**: `src/lib/background-data-collector.ts`

**Problem**:
- **Current Month (Smart Cache)**: ✅ Uses `enhanceCampaignsWithConversions()` to parse actions array
- **Historical Data (Background Collector)**: ❌ Does NOT parse actions array

**Impact**:
- Historical monthly/weekly data has ZERO conversion metrics from Meta API
- Relies 100% on daily_kpi_data fallback
- If daily_kpi_data is missing, historical data shows 0 conversions

**Evidence**:
```typescript
// background-data-collector.ts line 301
const campaignInsights = await metaService.getCampaignInsights(
  processedAdAccountId,
  monthData.startDate,
  monthData.endDate,
  0
);
// ❌ Missing: campaignInsights = enhanceCampaignsWithConversions(campaignInsights);
```

**Fix Required**:
Add actions parsing in `collectMetaMonthlySummary()` and `collectWeeklySummaryForClient()`:
```typescript
import { enhanceCampaignsWithConversions } from './meta-actions-parser';

// After getCampaignInsights:
let campaignInsights = await metaService.getCampaignInsights(...);
campaignInsights = enhanceCampaignsWithConversions(campaignInsights); // ✅ Parse actions
```

---

### 🚨 Issue #2: Data Source Priority Mismatch

**Smart Cache (Current Month)**:
- Priority 1: daily_kpi_data (ALWAYS checked first)
- Priority 2: Meta API parsed actions (fallback)

**Background Collector (Historical)**:
- Priority 1: Meta API parsed actions (but not parsed, so always 0)
- Priority 2: daily_kpi_data (fallback)

**Result**: Inconsistent data sources between current and historical data.

**Fix Required**: Align both to use Meta API as primary, daily_kpi_data as fallback.

---

## ✅ RECOMMENDATIONS

### 1. **Fix Background Collector Actions Parsing** (High Priority)
- Add `enhanceCampaignsWithConversions()` to historical data collection
- Ensures Meta API conversion data is properly extracted

### 2. **Align Data Source Priority** (High Priority)
- Make Meta API parsed actions the PRIMARY source
- Use daily_kpi_data only as FALLBACK when Meta API has no data

### 3. **Add Validation** (Medium Priority)
- Validate that actions array is present and non-empty
- Log warnings when falling back to daily_kpi_data

### 4. **Document Actions Mapping** (Low Priority)
- Maintain clear mapping of Meta action types to our funnel metrics
- Update when Meta API changes action types

---

## 📚 FILES REFERENCE

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/meta-api-optimized.ts` | Meta API service, getCampaignInsights | 397-425 |
| `src/lib/meta-actions-parser.ts` | Parse Meta actions array | 33-251 |
| `src/lib/smart-cache-helper.ts` | Current month data collection | 74-796 |
| `src/lib/background-data-collector.ts` | Historical data collection | 269-1230 |
| `src/lib/daily-data-fetcher.ts` | Daily KPI data source | 40-260 |

---

**Report Generated**: November 18, 2025  
**Status**: ⚠️ Critical issues identified requiring fixes



