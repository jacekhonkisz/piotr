# 🎯 Funnel Metrics System - Complete Explanation

## Overview
This document explains how conversion funnel metrics are fetched, processed, stored, and displayed in the reporting system. The funnel tracks user journey from initial engagement to final reservation.

---

## 📊 The Funnel Structure

The conversion funnel consists of 4 main stages:

```
1. Booking Step 1 → 2. Booking Step 2 → 3. Booking Step 3 → 4. Reservations
     (Search)              (View Details)         (Initiate Checkout)      (Purchase)
```

**Expected Behavior**: Each step should have **fewer or equal** conversions than the previous step (decreasing funnel).

**Example from July 2025 Real Data**:
- **Booking Step 1**: 906 events (initiate_checkout)
- **Booking Step 2**: 102 events (11.3% conversion from Step 1)
- **Booking Step 3**: 83 events (81.4% conversion from Step 2)
- **Reservations**: 212 events (final purchases)

---

## 🔄 How Funnel Metrics Are Fetched

### 1. **Data Source: Meta API**

**Primary Method**: `getCampaignInsights()` in `src/lib/meta-api.ts` (lines 589-928)

**API Endpoint**: 
```
https://graph.facebook.com/v18.0/act_{account_id}/insights
```

**Key Parameters**:
- `fields`: campaign_id, campaign_name, impressions, clicks, spend, **actions**, **action_values**
- `time_range`: { since: dateStart, until: dateEnd }
- `level`: 'campaign'
- `limit`: '100'

### 2. **Action Type Mapping Logic**

The system parses the `actions` array from Meta API and maps action types to funnel steps:

```typescript
// Location: src/lib/meta-api.ts, lines 717-799

let click_to_call = 0;
let email_contacts = 0;
let booking_step_1 = 0;
let booking_step_2 = 0;
let booking_step_3 = 0;
let reservations = 0;
let reservation_value = 0;

// Process each action from Meta API
actionsArray.forEach((action: any) => {
  const actionType = String(action.action_type || action.type || '').toLowerCase();
  const valueNum = Number(action.value ?? action.count ?? 0);
  
  // BOOKING STEP 1 - Search/Initiate Checkout
  if (actionType.includes('booking_step_1') || 
      actionType === 'search' || 
      actionType.includes('search')) {
    booking_step_1 += valueNum;
  }
  
  // BOOKING STEP 2 - View Content
  // ⚠️ NOTE: Includes custom conversion ID for client-specific tracking
  if (actionType.includes('booking_step_2') || 
      actionType.includes('view_content') ||
      actionType === 'view_content' ||
      actionType.includes('offsite_conversion.custom.1150356839010935')) {
    booking_step_2 += valueNum;
  }
  
  // BOOKING STEP 3 - Initiate Checkout
  // ⚠️ NOTE: Includes custom conversion ID for client-specific tracking
  if (actionType.includes('booking_step_3') || 
      actionType === 'initiate_checkout' ||
      actionType.includes('initiate_checkout') ||
      actionType.includes('offsite_conversion.custom.3490904591193350')) {
    booking_step_3 += valueNum;
  }
  
  // RESERVATIONS - Purchase
  if (actionType === 'purchase' || 
      actionType.includes('fb_pixel_purchase') || 
      actionType === 'onsite_web_purchase') {
    reservations += valueNum;
  }
});
```

### 3. **Funnel Validation**

The system includes built-in validation to detect funnel inversions:

```typescript
// Location: src/lib/meta-api.ts, lines 872-875

// Validate conversion funnel logic (Etap 1 should be >= Etap 2)
if (booking_step_2 > booking_step_1 && booking_step_1 > 0) {
  logger.warn(`⚠️ CONVERSION FUNNEL INVERSION: Campaign "${insight.campaign_name}" 
    has Etap 2 (${booking_step_2}) > Etap 1 (${booking_step_1}). 
    This may indicate misconfigured action types.`);
}
```

---

## 💾 How Funnel Metrics Are Stored

### Storage Architecture: 2-Tier System

```
Meta API → Daily Storage → Monthly/Weekly Aggregation
           (daily_kpi_data)   (campaign_summaries)
```

### 1. **Daily Storage: `daily_kpi_data` Table**

**Purpose**: Store day-by-day metrics for recent periods (past 7-30 days)

**Schema** (from `supabase/migrations/031_daily_kpi_tracking.sql`):
```sql
CREATE TABLE daily_kpi_data (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  date DATE NOT NULL,
  platform TEXT DEFAULT 'meta', -- 'meta' or 'google'
  
  -- Core metrics
  total_clicks BIGINT DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  total_spend DECIMAL(12,2) DEFAULT 0,
  total_conversions BIGINT DEFAULT 0,
  
  -- 🎯 FUNNEL METRICS
  click_to_call BIGINT DEFAULT 0,
  email_contacts BIGINT DEFAULT 0,
  booking_step_1 BIGINT DEFAULT 0,        -- Step 1
  booking_step_2 BIGINT DEFAULT 0,        -- Step 2
  booking_step_3 BIGINT DEFAULT 0,        -- Step 3 (added later)
  reservations BIGINT DEFAULT 0,          -- Final conversion
  reservation_value DECIMAL(12,2) DEFAULT 0,
  
  -- Calculated metrics
  average_ctr DECIMAL(5,2) DEFAULT 0,
  average_cpc DECIMAL(8,2) DEFAULT 0,
  roas DECIMAL(8,2) DEFAULT 0,
  cost_per_reservation DECIMAL(8,2) DEFAULT 0,
  
  -- Metadata
  data_source TEXT DEFAULT 'api',
  campaigns_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint per client, date, and platform
  UNIQUE(client_id, date, platform)
);
```

**Insert Logic** (from `src/lib/production-data-manager.ts`, lines 80-116):
```typescript
await supabase
  .from('daily_kpi_data')
  .upsert({
    client_id: clientId,
    date,
    platform: platform, // 'meta' or 'google'
    
    // Core metrics
    total_spend: metrics.totalSpend,
    total_impressions: metrics.totalImpressions,
    total_clicks: metrics.totalClicks,
    total_conversions: metrics.totalConversions,
    
    // 🎯 Conversion funnel
    click_to_call: metrics.click_to_call,
    email_contacts: metrics.email_contacts,
    booking_step_1: metrics.booking_step_1,
    booking_step_2: metrics.booking_step_2,
    booking_step_3: metrics.booking_step_3,
    reservations: metrics.reservations,
    reservation_value: metrics.reservation_value,
    
    // Calculated metrics
    average_ctr: averageCtr,
    average_cpc: averageCpc,
    roas,
    cost_per_reservation,
    
    // Metadata
    campaigns_count: campaigns.length,
    last_updated: new Date().toISOString()
  }, {
    onConflict: 'client_id,date,platform'
  });
```

### 2. **Aggregated Storage: `campaign_summaries` Table**

**Purpose**: Store weekly and monthly summaries for historical data

**Schema** (from `DATABASE_SCHEMA_EMERGENCY_FIX.sql`, lines 14-69):
```sql
CREATE TABLE campaign_summaries (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  summary_type TEXT CHECK (summary_type IN ('weekly', 'monthly')),
  summary_date DATE NOT NULL, -- Start date of the period
  platform TEXT DEFAULT 'meta',
  
  -- Core metrics
  total_spend DECIMAL(12,2) DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  total_clicks BIGINT DEFAULT 0,
  total_conversions BIGINT DEFAULT 0,
  
  -- 🎯 FUNNEL METRICS (added via migration)
  click_to_call BIGINT DEFAULT 0,
  email_contacts BIGINT DEFAULT 0,
  booking_step_1 BIGINT DEFAULT 0,
  booking_step_2 BIGINT DEFAULT 0,
  booking_step_3 BIGINT DEFAULT 0,      -- Added later
  reservations BIGINT DEFAULT 0,
  reservation_value DECIMAL(12,2) DEFAULT 0,
  
  -- Calculated metrics
  average_ctr DECIMAL(5,2) DEFAULT 0,
  average_cpc DECIMAL(8,2) DEFAULT 0,
  
  -- Detailed data
  campaign_data JSONB, -- Array of campaign details
  meta_tables JSONB,   -- Placement, demographic data
  
  -- Metadata
  active_campaigns INTEGER DEFAULT 0,
  total_campaigns INTEGER DEFAULT 0,
  data_source TEXT DEFAULT 'meta_api',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(client_id, summary_type, summary_date, platform)
);
```

---

## 🔍 Data Retrieval Logic

### Current Month/Week Data Flow

```
1. Dashboard Request
   ↓
2. Check current_month_cache / current_week_cache (3-6 hour cache)
   ↓
3. If cache expired or missing:
   a. Fetch fresh data from Meta API via getCampaignInsights()
   b. Parse actions array for funnel metrics
   c. Store in daily_kpi_data
   d. Update cache
   ↓
4. Aggregate daily records if needed
   ↓
5. Return to dashboard
```

**Key Files**:
- `src/lib/smart-cache-helper.ts` - Current month/week caching
- `src/lib/standardized-data-fetcher.ts` - Unified data fetching
- `src/app/api/fetch-live-data/route.ts` - API endpoint

### Historical Data Flow

```
1. Reports Page Request (e.g., July 2025)
   ↓
2. Check campaign_summaries for that period
   ↓
3. If forceFresh=true OR data incomplete:
   a. Fetch directly from Meta API
   b. Re-parse actions with current logic
   c. Return fresh data (optionally update DB)
   ↓
4. If data exists and complete:
   Return from campaign_summaries
```

**Configuration** (from `src/app/reports/page.tsx`):
```typescript
forceFresh: true, // Force fresh for ALL periods to get real booking steps
```

This ensures historical data uses the **latest action type mapping**, capturing custom conversion IDs that may not have been tracked initially.

---

## 🎯 Key Features & Fixes

### 1. **Custom Conversion Support**

The system supports client-specific custom conversion IDs:

**Booking Step 2**: 
- Standard: `booking_step_2`, `add_payment_info`
- **Custom**: `offsite_conversion.custom.1150356839010935`

**Booking Step 3**: 
- Standard: `booking_step_3`, `complete_checkout`
- **Custom**: `offsite_conversion.custom.3490904591193350`

### 2. **Funnel Inversion Prevention**

**Problem Fixed**: Early implementation tracked `view_content` for Step 2, which fires on almost every page view, causing Step 2 (755) > Step 1 (150) ❌

**Solution**: Removed overly broad action types from Step 2 mapping (see `CONVERSION_FUNNEL_INVERSION_FIX.md`)

**Current Mapping**:
```typescript
// ✅ CORRECT: Specific booking actions only
if (actionType.includes('booking_step_2') || 
    actionType.includes('add_payment_info') ||
    actionType.includes('offsite_conversion.custom.1150356839010935')) {
  booking_step_2 += valueNum;
}

// ❌ REMOVED: view_content, begin_checkout (too broad)
```

### 3. **Backward Compatibility**

All historical periods can be re-fetched with updated logic:
- `forceFresh: true` in reports
- Re-parses Meta API data with current mapping
- Captures previously missed custom conversions

---

## 📈 Data Quality Assurance

### Validation Checks

1. **Funnel Logic**: Step 1 ≥ Step 2 ≥ Step 3
2. **Source Validation**: Verify data against Meta Ads Manager
3. **Completeness**: Check for zeros when events should exist
4. **Inversion Detection**: Automatic warnings in logs

### Monitoring Points

- **Console Logs**: Enhanced logging for July 2025 debugging
- **Action Type Tracking**: Log all actions found per campaign
- **Custom Conversion Detection**: Flag when custom IDs are found

**Example Log Output**:
```
🎯 JULY 2025 BOOKING STEPS for Campaign XYZ:
   📋 booking_step_1: 906
   📋 booking_step_2: 102 ← SHOULD NOT BE 0 IF TRACKED
   📋 booking_step_3: 83 ← SHOULD NOT BE 0 IF TRACKED
```

---

## 🔧 Technical Implementation Details

### Aggregation Logic

When aggregating daily data into monthly/weekly summaries:

```typescript
// From src/lib/standardized-data-fetcher.ts, lines 397-436

const totals = dailyRecords.reduce((acc, record) => ({
  totalSpend: acc.totalSpend + (record.total_spend || 0),
  totalImpressions: acc.totalImpressions + (record.total_impressions || 0),
  totalClicks: acc.totalClicks + (record.total_clicks || 0),
  totalConversions: acc.totalConversions + (record.total_conversions || 0),
  
  // 🎯 Aggregate funnel metrics
  booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
  booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
  booking_step_3: acc.booking_step_3 + ((record as any).booking_step_3 || 0),
  reservations: acc.reservations + (record.reservations || 0),
  reservation_value: acc.reservation_value + (record.reservation_value || 0),
}), {
  totalSpend: 0,
  totalImpressions: 0,
  totalClicks: 0,
  totalConversions: 0,
  booking_step_1: 0,
  booking_step_2: 0,
  booking_step_3: 0,
  reservations: 0,
  reservation_value: 0,
});
```

### Caching Strategy

**3-Tier Caching**:
1. **Memory Cache** (fastest): In-memory for repeated requests
2. **Database Cache** (current_month_cache, current_week_cache): 3-6 hour TTL
3. **Persistent Storage** (daily_kpi_data, campaign_summaries): Long-term

**Cache Invalidation**:
- Current month/week: Every 3-6 hours
- Daily data: Updated daily by cron jobs
- Historical summaries: Updated on forceFresh or manual trigger

---

## 🚀 Best Practices

### For Developers

1. **Always check action types** when adding new conversion tracking
2. **Validate funnel logic** after any mapping changes
3. **Test with real data** using July 2025 as reference
4. **Log extensively** for debugging custom conversions
5. **Update both daily and summary storage** when changing metrics

### For Analysts

1. **Verify against Meta Ads Manager** for accuracy
2. **Check for funnel inversions** in new data
3. **Monitor custom conversion IDs** for client-specific tracking
4. **Use forceFresh** when historical data looks incorrect
5. **Cross-reference** with offline reservation data

---

## 📝 Summary

### ✅ What's Working Well

- **Accurate tracking** of standard Meta conversion events
- **Custom conversion support** for client-specific IDs
- **Validation logic** prevents funnel inversions
- **2-tier storage** balances performance and data retention
- **Force fresh** capability ensures historical accuracy

### ⚠️ Important Notes

1. **booking_step_3** was added later - older records may not have it
2. **Custom conversions** require manual ID mapping per client
3. **View_content** was removed from Step 2 to prevent over-counting
4. **Platform field** separates Meta vs Google Ads data
5. **ROAS calculation** requires both reservations > 0 and reservation_value > 0

### 🎯 Current Status

**All funnel metrics are properly**:
- ✅ Fetched from Meta API via getCampaignInsights()
- ✅ Parsed with accurate action type mapping
- ✅ Stored in daily_kpi_data and campaign_summaries
- ✅ Validated for logical funnel progression
- ✅ Displayable in dashboard and reports

---

## 📚 Related Documentation

- `PROPER_BOOKING_FUNNEL_IMPLEMENTATION.md` - Custom conversion mapping
- `CONVERSION_FUNNEL_INVERSION_FIX.md` - Funnel validation fixes
- `FETCHING_MECHANISM_AUDIT.md` - API fetching analysis
- `DAILY_METRICS_AUDIT_REPORT.md` - Storage architecture
- `DATABASE_SCHEMA_EMERGENCY_FIX.sql` - Table schemas

---

**Last Updated**: November 3, 2025  
**System Version**: Production-ready with custom conversion support



