# 🔍 Data Fetching: Past vs Current Periods - Complete Audit

**Date:** September 30, 2025  
**Purpose:** Audit how the system handles data differently for historical vs current periods  
**Findings:** 🚨 MAJOR ARCHITECTURAL DIFFERENCES FOUND

---

## 📊 Executive Summary

The system has **completely different data fetching paths** for past periods vs current periods, which explains the discrepancies we're seeing:

| Aspect | **Past Periods** (Aug) | **Current Period** (Sept) |
|--------|------------------------|---------------------------|
| **Data Source** | `campaigns` table (database) | Smart cache → Meta API |
| **Storage** | Permanently stored in DB | Cached for 3 hours, then refreshed |
| **Attribution** | From when data was collected | From current API call (may change) |
| **Conversions** | Fixed historical value | Real-time from Meta API |
| **Daily Data** | Should be in `daily_kpi_data` | Aggregated from API + cache |

---

## 🎯 Data Flow Comparison

### **AUGUST 2025 (Past Month) - What Happened:**

```
User Requests August Data
│
├─ StandardizedDataFetcher.fetchData()
│   │
│   └─ Classifies as: HISTORICAL PERIOD
│       ├─ isCurrentMonth: false (we're in September now)
│       ├─ needsSmartCache: false
│       └─ Strategy: DATABASE_FIRST
│
├─ Queries: campaigns table
│   │
│   └─ SELECT * FROM campaigns
│       WHERE client_id = 'xxx'
│       AND date_range_start >= '2025-08-01'
│       AND date_range_end <= '2025-08-31'
│
├─ Returns: 17 campaigns
│   ├─ Total Spend: 25,069.88 PLN ✅
│   ├─ Total Conversions: 139 ✅
│   └─ Data Source: Stored in DB from when it was collected
│
└─ Result: PERFECT MATCH with CSV ✅
```

**Why August Works:**
1. ✅ Data was collected and stored in `campaigns` table when August WAS current
2. ✅ The conversion data was captured with proper attribution at that time
3. ✅ Database has permanent, immutable record
4. ✅ No attribution window issues (data already captured)

---

### **SEPTEMBER 2025 (Current Month) - What's Happening:**

```
User Requests September Data
│
├─ StandardizedDataFetcher.fetchData()
│   │
│   └─ Classifies as: CURRENT MONTH
│       ├─ isCurrentMonth: true (Sept == Sept)
│       ├─ needsSmartCache: true
│       └─ Strategy: SMART_CACHE (3-hour refresh)
│
├─ Calls: Smart Cache System
│   │
│   ├─ Check: current_month_cache table
│   │   ├─ Cache exists? Yes
│   │   ├─ Cache fresh (< 3 hours)? Yes
│   │   └─ Return cached data
│   │
│   └─ Cache was populated by:
│       └─ fetchFreshCurrentMonthData()
│           │
│           └─ metaService.getCampaignInsights()
│               ├─ Queries Meta API directly
│               ├─ Date Range: 2025-09-01 to 2025-09-29
│               ├─ Attribution: DEFAULT (1-day click) ❌
│               └─ Returns: 38 conversions
│
├─ DOES NOT query campaigns table ❌
│   └─ Why? Because it's "current month" → use cache/API
│
├─ Returns: From cache
│   ├─ Total Spend: 23,961.93 PLN ⚠️
│   ├─ Total Conversions: 38 ❌ (Should be 100)
│   └─ Data Source: Meta API with wrong attribution
│
└─ Result: WRONG CONVERSION COUNT ❌
```

**Why September Is Wrong:**
1. ❌ Cache fetches from Meta API with default attribution (1-day)
2. ❌ CSV uses longer attribution window (7-day click)
3. ❌ No stored campaigns in `campaigns` table (collection didn't run)
4. ❌ Cache only has what API returned (38 conversions)

---

## 🔍 Key Architectural Differences

### 1. **Data Source Selection**

```typescript
// StandardizedDataFetcher.fetchData() - Line 117-150

const isCurrentMonth = startYear === currentYear && startMonth === currentMonth;
const isCurrentPeriod = isCurrentMonth || isCurrentWeek;
const needsSmartCache = isCurrentPeriod;

Strategy:
  if (needsSmartCache) {
    → Use Smart Cache (queries Meta API)
    → Data refreshes every 3 hours
    → Real-time attribution from API
  } else {
    → Use Database (campaigns table)
    → Data is historical/fixed
    → Attribution captured when stored
  }
```

**Impact:**
- **August:** Database query returns fixed historical data ✅
- **September:** API query returns real-time data with current attribution ❌

---

### 2. **Attribution Window Handling**

#### **Past Periods (Database):**
```sql
SELECT * FROM campaigns
WHERE client_id = 'xxx'
AND date_range_start >= '2025-08-01'

-- Returns: Data as it was WHEN COLLECTED
-- Attribution: Whatever was set when data was stored
-- Conversions: FIXED (139 for August)
```

**Benefit:** Consistent, immutable historical data  
**Issue:** If initial collection had wrong attribution, it's permanent

#### **Current Period (API):**
```typescript
// meta-api.ts - Line 621-629
const params = new URLSearchParams({
  fields: fields,
  time_range: JSON.stringify({
    since: dateStart,
    until: dateEnd,
  }),
  level: 'campaign',
  limit: '100',
  // ❌ MISSING: action_attribution_windows parameter
});

// Meta API uses default attribution: 1-day click
// Should use: action_attribution_windows: '7d_click,1d_view'
```

**Issue:** No attribution window specified → uses default (1-day)  
**Result:** Misses 62 conversions attributed 2-7 days after click

---

### 3. **Conversion Metrics Aggregation**

#### **Past Periods:**
```typescript
// Loads from campaigns table
campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0)

// Where c.conversions came from:
// - Stored when month was collected
// - Attribution window: Whatever was used at collection time
// - Value: FIXED in database
```

#### **Current Period:**
```typescript
// smart-cache-helper.ts - Line 102
const metaTotalConversions = campaignInsights.reduce(
  (sum, campaign) => sum + (campaign.conversions || 0), 0
);

// Where campaign.conversions comes from:
// - Real-time from Meta API
// - Attribution window: DEFAULT (1-day click) ❌
// - Value: CHANGES based on attribution
```

---

### 4. **Storage vs Real-Time**

| Aspect | Past Periods | Current Period |
|--------|--------------|----------------|
| **Storage Location** | `campaigns` table | `current_month_cache` table |
| **Data Permanence** | Permanent | Expires after 3 hours |
| **Collection Method** | Monthly collection job | Real-time API fetch |
| **Attribution** | Fixed at collection | Dynamic from API |
| **Mutation** | Immutable | Changes with each refresh |

---

## 🚨 Critical Issues Found

### **Issue #1: September Campaigns Table Is Empty**

**What Should Happen:**
```sql
-- Monthly collection job should write to campaigns table
INSERT INTO campaigns (
  client_id,
  campaign_name,
  spend,
  conversions,
  date_range_start,
  date_range_end,
  ...
) VALUES (...);
```

**What's Actually Happening:**
```sql
-- Query returns 0 rows
SELECT * FROM campaigns
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND date_range_start >= '2025-09-01';

-- Result: 0 campaigns ❌
```

**Impact:**
- No permanent record of September campaigns
- Can't compare September data to August (different sources)
- If we query September as historical later, will have no data

**Root Cause:**
The monthly collection job (`/api/background/collect-monthly`) either:
1. Didn't run for September
2. Ran but failed to insert data
3. Logic changed to stop writing to campaigns table

---

### **Issue #2: Attribution Window Mismatch**

**CSV Export Settings** (Meta Ads Manager):
```
Attribution Windows:
- 7-day click
- 1-day view

Result: 100 conversions captured
```

**Our API Query** (Meta API):
```typescript
// No attribution_windows specified
// Uses Meta API default: 1-day click only

Result: 38 conversions captured (62% missing)
```

**Impact:**
- September shows 38 conversions instead of 100
- ROAS calculations understated by 62%
- Business decisions based on false data

---

### **Issue #3: Inconsistent Data Architecture**

**Problem:** Same period accessed differently depending on when it's viewed

**Example: Viewing August Data**

If viewed **in August** (current month):
```
→ Smart Cache
→ Meta API with default attribution
→ May show fewer conversions
```

If viewed **in September** (past month):
```
→ Database (campaigns table)
→ Shows whatever was stored
→ Fixed conversion count
```

**Impact:**
- August shows 139 conversions when viewed now (from database) ✅
- But if cache had 38 conversions when August was current... 🤔
- Data changes meaning depending on **when** it's viewed, not **what** period it is

---

## 📊 Period Classification Logic

### **How System Decides Current vs Past:**

```typescript
// standardized-data-fetcher.ts - Line 113-128

const now = new Date();
const today = now.toISOString().split('T')[0];
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

const startDate = new Date(dateRange.start);
const startYear = startDate.getFullYear();
const startMonth = startDate.getMonth() + 1;

const isCurrentMonth = startYear === currentYear && startMonth === currentMonth;
const isCurrentPeriod = isCurrentMonth || isCurrentWeek;

if (isCurrentPeriod) {
  // Use Smart Cache → Meta API
} else {
  // Use Database → campaigns table
}
```

**Result:**
- **August 2025 viewed on Sept 30:** `isCurrentMonth = false` → Database
- **September 2025 viewed on Sept 30:** `isCurrentMonth = true` → Smart Cache
- **September 2025 viewed on Oct 1:** `isCurrentMonth = false` → Database (if data exists)

---

## 🎯 Comparison: August vs September

### **August 2025 (Perfect)**

| Metric | Source | Value | Status |
|--------|--------|-------|--------|
| Campaigns | `campaigns` table | 17 | ✅ |
| Spend | Database | 25,069.88 PLN | ✅ |
| Conversions | Database | 139 | ✅ |
| Daily Data | `daily_kpi_data` | 0 days | ❌ Missing |
| Cache | N/A (past month) | - | Expected |

**Data Flow:**
```
Request Aug → Check if current month → NO
           → Use database strategy
           → Query campaigns table
           → Return stored data
           → Result: Perfect match ✅
```

---

### **September 2025 (Broken)**

| Metric | Source | Value | Status |
|--------|--------|-------|--------|
| Campaigns | Smart Cache (API) | 17 | ⚠️ Not in DB |
| Spend | Meta API | 24,011.15 PLN | ⚠️ Close |
| Conversions | Meta API (1-day attr) | 38 | ❌ Should be 100 |
| Daily Data | `daily_kpi_data` | 8 days (zeros) | ❌ Broken |
| Cache | `current_month_cache` | Fresh (53 min old) | ⚠️ Wrong data |

**Data Flow:**
```
Request Sept → Check if current month → YES
            → Use smart cache strategy
            → Check cache → Found (fresh)
            → Return cached data
            → Cached data from Meta API
            → API used default attribution (1-day)
            → Result: Wrong conversions ❌
```

---

## 💡 Why This Architecture Exists

### **Design Intent (Good Reasons):**

1. **Performance:**
   - Past months: Fast database query (< 1s)
   - Current month: Cached API data (< 3s)

2. **Freshness:**
   - Past months: Don't need updates (historical)
   - Current month: Needs regular updates (ongoing)

3. **Cost:**
   - Past months: No API calls (free)
   - Current month: Cached API calls (3-hour refresh = 8 calls/day)

### **Implementation Problems:**

1. **Inconsistent Attribution:**
   - Database: Whatever attribution was used when collected
   - API: Using default attribution (1-day) ❌

2. **Missing Permanent Storage:**
   - September not being written to campaigns table
   - Will have no data when viewed as past month

3. **Dual Truth Sources:**
   - Same data means different things from different sources
   - Database shows 139 conversions for August
   - But if we had queried API in August, might have shown 38

---

## 🔧 Root Causes Summary

### **Primary Issues:**

1. **Attribution Window Not Specified**
   - Location: `src/lib/meta-api.ts` line ~621
   - Missing: `action_attribution_windows: '7d_click,1d_view'`
   - Impact: API returns 38 conversions instead of 100

2. **September Campaigns Not Stored**
   - Expected: Monthly collection job writes to `campaigns` table
   - Reality: Table is empty for September
   - Impact: No permanent record, will lose data when no longer "current"

3. **Daily KPI Collection Broken**
   - Expected: 29 days of data in `daily_kpi_data`
   - Reality: 8 days with zeros
   - Impact: Daily charts broken

4. **Conversion Metrics Aggregation**
   - Current month: Uses Meta API conversions (with wrong attribution)
   - Should also check: `daily_kpi_data` for breakdown
   - Reality: daily_kpi_data has zeros anyway

---

## 📋 Detailed Data Source Matrix

| Period | Time Viewed | Primary Source | Fallback Source | Attribution | Mutable |
|--------|-------------|----------------|-----------------|-------------|---------|
| **Aug 2025** | Sept 30 (now) | `campaigns` table | None | From collection time | No |
| **Aug 2025** | Aug 15 (hypothetical) | Smart Cache → API | Database | Default (1-day) | Yes (every 3h) |
| **Sept 2025** | Sept 30 (now) | Smart Cache → API | Database | Default (1-day) ❌ | Yes (every 3h) |
| **Sept 2025** | Oct 1 (tomorrow) | `campaigns` table ❌ | None | N/A (no data) | No |
| **Oct 2025** | Oct 30 (future) | Smart Cache → API | Database | Default (1-day) ❌ | Yes (every 3h) |

---

## 🎯 Immediate Actions Required

### **🔴 Critical (Fix September Now):**

1. **Fix Attribution Window in Meta API**
   ```typescript
   // src/lib/meta-api.ts line ~621
   const params = new URLSearchParams({
     fields: fields,
     time_range: JSON.stringify({
       since: dateStart,
       until: dateEnd,
     }),
     level: 'campaign',
     limit: '100',
     action_attribution_windows: '7d_click,1d_view'  // ADD THIS
   });
   ```

2. **Force Refresh September Cache**
   - Clear current cache
   - Re-fetch with correct attribution
   - Should now show ~100 conversions

3. **Backfill September to Campaigns Table**
   - Write permanent record of September campaigns
   - Ensure October 1 doesn't lose data

### **🟡 High Priority (Fix Architecture):**

4. **Ensure Monthly Collection Runs**
   - Verify `/api/background/collect-monthly` runs for current month
   - Should write to campaigns table even for "current" month
   - Creates permanent historical record

5. **Fix Daily KPI Collection**
   - September should have 29 days of real data
   - Currently has 8 days of zeros

6. **Add Attribution Consistency**
   - Ensure ALL data collection uses same attribution
   - Database storage should match API queries
   - Document what attribution window is used

### **🟢 Medium Priority (Improve System):**

7. **Add Data Validation**
   - Alert when conversions drop >50% month-over-month
   - Alert when attribution might be wrong
   - Alert when campaigns table empty for recent months

8. **Unify Data Sources**
   - Consider always storing to campaigns table
   - Use cache as performance layer only
   - Don't let cache be "source of truth"

---

## ✅ Conclusion

The system has **two completely different data architectures** for past vs current periods:

**Past Periods (August):**
- ✅ Works perfectly
- ✅ Data stored in campaigns table
- ✅ Fixed historical record
- ❌ Daily data missing (backfill needed)

**Current Period (September):**
- ❌ Wrong conversion count (attribution issue)
- ❌ No permanent storage (campaigns table empty)
- ❌ Daily data broken (zeros)
- ⚠️ Cache works correctly (but caches wrong data)

**Key Insight:**
The caching system is **working as designed**. The problem is:
1. Meta API query uses wrong attribution window
2. Monthly collection not storing data permanently
3. Different truth sources create inconsistency

**Fix Priority:**
1. 🔴 Attribution window (immediate - affects live data)
2. 🔴 Permanent storage (urgent - prevents data loss)
3. 🟡 Daily KPI collection (important - user experience)
4. 🟢 Architecture consistency (future - prevents recurrence)

---

**Generated:** September 30, 2025  
**Next Review:** After attribution fix and September backfill
