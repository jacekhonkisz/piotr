# 🔍 Comprehensive Data Flow Audit - Unified System Check

**Date:** October 2, 2025  
**Purpose:** Verify data consistency, no duplications, no overrides  
**Status:** 🔄 AUDITING

---

## 📊 Data Sources in the System

### **1. Primary Tables**
- `campaign_summaries` - Historical monthly/weekly summaries with full campaign details
- `daily_kpi_data` - Daily aggregated metrics (no campaign details)
- `current_month_cache` - Current month cache (3-hour refresh)
- `current_week_cache` - Current week cache (3-hour refresh)

### **2. Data Flow Priority (After Fix)**

```
User Requests September 2025 Data
│
├─ Classify Period: HISTORICAL MONTH
│
├─ Data Source Selection:
│   1️⃣ Try campaign_summaries FIRST ✅
│   │   └─ If found: Return with 22 campaigns, 12,735 PLN
│   │
│   2️⃣ Fallback to daily_kpi_data aggregation
│       └─ If found: Return with 0 campaigns, 7,118 PLN
│
└─ API Response
```

---

## 🚨 Potential Issues to Check

### **Issue #1: Data Mismatch Between Sources**
**Question:** Why do the two sources have different values?

- `campaign_summaries`: 12,735.18 PLN
- `daily_kpi_data aggregated`: 7,118.3 PLN

**Possible Causes:**
1. ❓ Different date ranges (full month vs partial)
2. ❓ Data collected at different times
3. ❓ Attribution windows differences
4. ❓ One is Meta only, other includes Google?
5. ❓ Currency conversion applied differently

**Need to investigate!**

---

### **Issue #2: Duplication Risk**
**Question:** Are we storing the same data twice?

**Storage Points:**
1. `campaign_summaries` - Stores campaign-level details
2. `daily_kpi_data` - Stores daily aggregates
3. `current_month_cache` - Caches current month

**Duplication Check:**
```
✅ campaign_summaries (monthly) - Permanent storage
✅ daily_kpi_data (daily records) - For daily granularity
✅ current_month_cache (cache) - Temporary, refreshes every 3h
```

**Status:** ⚠️ **POTENTIAL ISSUE** - daily_kpi_data and campaign_summaries may overlap

---

### **Issue #3: Override Risk**
**Question:** Can one data source overwrite another?

**Scenarios:**
1. **Monthly aggregation job** - Could overwrite campaign_summaries
2. **Daily collection job** - Could overwrite daily_kpi_data
3. **Cache refresh** - Only temporary, shouldn't overwrite permanent storage

**Need to verify!**

---

## 🔍 Deep Dive Audit

### **Audit #1: Check if both sources have September data**

Run this in Supabase:

```sql
-- Check campaign_summaries
SELECT 
  'campaign_summaries' as source,
  client_id,
  summary_date,
  total_spend,
  total_impressions,
  jsonb_array_length(campaign_data) as campaigns_count,
  data_source,
  last_updated
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date = '2025-09-01';

-- Check daily_kpi_data
SELECT 
  'daily_kpi_data' as source,
  client_id,
  COUNT(*) as days_count,
  SUM(total_spend) as total_spend,
  SUM(total_impressions) as total_impressions,
  MIN(date) as first_date,
  MAX(date) as last_date,
  MAX(last_updated) as last_updated
FROM daily_kpi_data
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND date >= '2025-09-01'
  AND date <= '2025-09-30'
GROUP BY client_id;
```

**Expected Results:**
- Both should exist
- Values may differ (different purposes)
- No conflicts if used correctly

---

### **Audit #2: Check for Duplicate Inserts**

```sql
-- Check for duplicate monthly summaries
SELECT 
  client_id,
  summary_date,
  summary_type,
  platform,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as record_ids
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
GROUP BY client_id, summary_date, summary_type, platform
HAVING COUNT(*) > 1;

-- Expected: 0 rows (no duplicates)
```

---

### **Audit #3: Check for Data Consistency**

```sql
-- Compare campaign_summaries totals with aggregated campaign_data
SELECT 
  summary_date,
  total_spend as stored_total,
  (
    SELECT SUM((campaign->>'spend')::numeric)
    FROM jsonb_array_elements(campaign_data) as campaign
  ) as calculated_from_campaigns,
  ABS(total_spend - (
    SELECT SUM((campaign->>'spend')::numeric)
    FROM jsonb_array_elements(campaign_data) as campaign
  )) as difference
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-07-01';

-- Expected: difference should be < 0.01 (rounding)
```

---

### **Audit #4: Check Data Source Timestamps**

```sql
-- When was data last updated in each source?
SELECT 
  'campaign_summaries' as source,
  summary_date as period,
  last_updated,
  AGE(NOW(), last_updated) as age
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-07-01'

UNION ALL

SELECT 
  'daily_kpi_data' as source,
  TO_CHAR(date, 'YYYY-MM-DD') as period,
  last_updated,
  AGE(NOW(), last_updated) as age
FROM daily_kpi_data
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND date >= '2025-09-01'
  AND date <= '2025-09-30'
ORDER BY period DESC, source;
```

---

## 🔧 Potential Conflicts & Resolutions

### **Conflict #1: Which data source is "truth"?**

**Answer:** Depends on the use case:

| Use Case | Best Source | Why |
|----------|-------------|-----|
| Reports with campaign details | `campaign_summaries` | Has full campaign breakdown |
| Daily trend analysis | `daily_kpi_data` | Day-by-day granularity |
| Current month real-time | `current_month_cache` | Fresh data, 3-hour refresh |

**Current Fix:** ✅ Prioritizes `campaign_summaries` for monthly reports

---

### **Conflict #2: Data collection timing**

**Questions:**
1. When is `campaign_summaries` populated?
2. When is `daily_kpi_data` populated?
3. Could they fetch data at different times with different attribution?

**Need to trace:**
- Daily collection jobs
- Monthly aggregation jobs
- Backfill endpoints

---

### **Conflict #3: Platform separation**

**Check:** Are Meta and Google Ads data properly separated?

```sql
-- Check platform column in campaign_summaries
SELECT 
  platform,
  COUNT(*) as records,
  SUM(total_spend) as total_spend
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
GROUP BY platform;

-- Expected: meta, google, or NULL
```

---

## 📋 Verification Checklist

Run these checks to verify unified system:

- [ ] **No duplicate records** - Same client/date/platform has only 1 record
- [ ] **Consistent totals** - campaign_summaries totals match sum of campaigns
- [ ] **Platform separation** - Meta and Google data don't mix
- [ ] **Timestamp logic** - Newer data doesn't overwrite older unless intended
- [ ] **Cache vs permanent** - Cache refreshes don't affect permanent storage
- [ ] **API consistency** - Same request always returns same data source
- [ ] **Backfill safety** - Backfill with forceRefresh=false skips existing data

---

## 🎯 Unified Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ DATA COLLECTION LAYER                                   │
├─────────────────────────────────────────────────────────┤
│ • Daily Collection (Cron: Every day 2 AM)              │
│   └─> Stores in: daily_kpi_data                        │
│                                                          │
│ • Monthly Aggregation (Cron: 1st of month 2 AM)        │
│   └─> Stores in: campaign_summaries                    │
│                                                          │
│ • Current Month Cache (Cron: Every 3 hours)            │
│   └─> Stores in: current_month_cache                   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ DATA RETRIEVAL LAYER (fetch-live-data API)             │
├─────────────────────────────────────────────────────────┤
│ Period Classification:                                  │
│                                                          │
│ IF Current Month:                                       │
│   1. current_month_cache (if fresh)                    │
│   2. Fetch live from Meta/Google APIs                  │
│                                                          │
│ IF Historical Month (After Fix): ✅                     │
│   1. campaign_summaries (has campaigns)                │
│   2. daily_kpi_data aggregation (fallback)             │
│                                                          │
│ IF Weekly:                                              │
│   1. current_week_cache (if current week)              │
│   2. campaign_summaries (weekly type)                  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ FRONTEND DISPLAY                                        │
├─────────────────────────────────────────────────────────┤
│ • Shows campaigns list                                  │
│ • Shows summary totals                                  │
│ • Shows conversion metrics                              │
│ • Shows meta tables (demographics, placement, etc.)     │
└─────────────────────────────────────────────────────────┘
```

---

## ⚠️ Critical Questions to Answer

### **Q1: Why is daily_kpi_data showing 7,118 PLN but campaign_summaries showing 12,735 PLN?**

**Hypothesis:**
1. Daily data is incomplete (missing days?)
2. Daily data has partial month
3. Different attribution windows
4. One is Meta only, other includes Google

**Investigation needed!**

### **Q2: Should we keep both daily_kpi_data AND campaign_summaries?**

**Recommendation:**
- ✅ **Keep both** - They serve different purposes:
  - `daily_kpi_data`: For daily trends, charts over time
  - `campaign_summaries`: For monthly reports with campaign details

**BUT:** Ensure they're not conflicting or causing confusion

### **Q3: What happens during backfill with forceRefresh=true?**

**Current behavior:**
```typescript
if (forceRefresh === true) {
  // Re-fetch from API and OVERWRITE existing data
  // Using UPSERT with conflict resolution
}
```

**Risk:** ⚠️ Could overwrite manually corrected data

**Recommendation:** Add safety checks before overwriting

---

## 🛡️ Safety Recommendations

### **1. Add Data Source Tracking**
```sql
ALTER TABLE campaign_summaries 
ADD COLUMN IF NOT EXISTS data_collection_method TEXT;
-- Values: 'api_fetch', 'daily_aggregation', 'manual_import', 'backfill'
```

### **2. Add Version/Timestamp**
```sql
ALTER TABLE campaign_summaries 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
-- Increment on each update to track changes
```

### **3. Archive Before Overwrite**
Before backfill with forceRefresh:
- Copy existing data to `campaign_summaries_history` table
- Then overwrite with new data
- Allow rollback if needed

### **4. Validation Rules**
```sql
-- Ensure totals match campaigns
CREATE OR REPLACE FUNCTION validate_campaign_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if total_spend matches sum of campaigns
  IF NEW.campaign_data IS NOT NULL THEN
    -- Add validation logic
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## ✅ Action Items

### **Immediate (Today):**
- [ ] Run Audit #1 to see both data sources
- [ ] Run Audit #2 to check for duplicates
- [ ] Run Audit #3 to check totals consistency
- [ ] Investigate why 7,118 vs 12,735 discrepancy

### **This Week:**
- [ ] Add data source tracking column
- [ ] Implement validation checks
- [ ] Document data lifecycle clearly
- [ ] Add monitoring for data consistency

### **This Month:**
- [ ] Review all data collection jobs
- [ ] Ensure no conflicts or overrides
- [ ] Add automated consistency checks
- [ ] Create data quality dashboard

---

## 📞 Next Steps

1. **Run the audit queries in Supabase** (from Audit #1, #2, #3)
2. **Share results** - Tell me what you see
3. **I'll analyze** and provide specific fixes if needed
4. **Verify the fix** - Restart server and test

---

**Status:** 🔄 **AWAITING AUDIT RESULTS**  
**Priority:** 🔴 **HIGH - Data Integrity**

