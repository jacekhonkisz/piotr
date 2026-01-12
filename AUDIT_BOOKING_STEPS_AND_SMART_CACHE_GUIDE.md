# 🔍 Audit Guide: Booking Steps & Smart Cache Usage

## Overview

This audit checks two critical issues:
1. **Google Ads Booking Steps Data Quality** - Are booking steps showing random/incorrect values?
2. **Smart Cache Usage** - Are Meta and Google properly using smart cache for current periods (months and weeks)?

---

## Part 1: Google Ads Booking Steps Audit

### What to Check

#### ✅ **Step 1-2: Current Month/Week Cache**
- **Purpose**: Check what users see when viewing current period data
- **What to look for**:
  - ✅ Booking steps should be > 0 if there's spend
  - ⚠️ If spend > 0 but booking steps = 0 → **Data fetch issue**
  - ⚠️ If cache age > 6 hours → **Cache refresh issue**

#### ✅ **Step 3: Data Quality Check**
- **Purpose**: Find suspicious patterns in booking step values
- **Red flags**:
  - 🚨 **Step1 = Step2 = Step3** (all identical) → **Very suspicious, likely data issue**
  - ⚠️ **Step2 > Step1** or **Step3 > Step2** → **Impossible funnel ratios**
  - ⚠️ **Has booking steps but no spend** → **Data inconsistency**

#### ✅ **Step 4: Cache vs Database Comparison**
- **Purpose**: Verify cache and database are in sync
- **What to look for**:
  - ✅ **Match** → System working correctly
  - ⚠️ **Mismatch** → Cache may be stale or database not updated
  - ⚠️ **Cache missing** → Cache refresh may have failed

#### ✅ **Step 11: Identical Booking Steps**
- **Purpose**: Find campaigns where all steps are identical (potential data corruption)
- **Example of issue**:
  ```
  Campaign A: booking_step_1 = 100, booking_step_2 = 100, booking_step_3 = 100
  → This is suspicious! Steps should decrease (funnel)
  ```

#### ✅ **Step 12: Ratio Analysis**
- **Purpose**: Check if booking step ratios are realistic
- **Normal ratios**:
  - Step2/Step1: Usually 10-30% (10-30% of step1 users reach step2)
  - Step3/Step2: Usually 20-50% (20-50% of step2 users reach step3)
- **Red flags**:
  - 🚨 **Ratio > 100%** → Impossible (step2 can't be > step1)
  - ⚠️ **Ratio > 50%** → Unusually high, may indicate data issue

---

## Part 2: Smart Cache Usage Audit

### What is Smart Cache?

**Smart Cache** is a 3-hour refresh cache system for **current periods only**:
- **Current Month**: Uses `current_month_cache` (Meta) or `google_ads_current_month_cache` (Google)
- **Current Week**: Uses `current_week_cache` (Meta) or `google_ads_current_week_cache` (Google)
- **Historical Periods**: Should use `campaign_summaries` database table (NOT cache)

### Expected Behavior

```
┌─────────────────────────────────────────┐
│  CURRENT PERIOD (This Month/Week)       │
├─────────────────────────────────────────┤
│  Priority 1: Smart Cache (3h refresh)  │
│  Priority 2: Live API (if cache stale) │
│  Priority 3: Database (fallback)       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  HISTORICAL PERIOD (Past Months/Weeks) │
├─────────────────────────────────────────┤
│  Priority 1: Database (campaign_summaries)│
│  Priority 2: Database (daily_kpi_data)│
│  Priority 3: Never use cache/API       │
└─────────────────────────────────────────┘
```

### What to Check

#### ✅ **Step 5-8: Cache Status**
- **Purpose**: Verify cache exists and is fresh for current periods
- **What to look for**:
  - ✅ **Fresh (< 3h)** → Cache working correctly
  - ⚠️ **Stale (3-6h)** → Cache refresh may be delayed
  - ❌ **Very stale (> 6h)** → Cache refresh may have failed
  - ❌ **No cache entry** → Cache not being created

#### ✅ **Step 9: Data Source Audit**
- **Purpose**: Check if current month data is using correct source
- **What to look for**:
  - ✅ **"Using cache source"** → Correct for current month
  - ⚠️ **"Using database"** → Should use cache for current month
  - ⚠️ **"Using live API"** → Should use cache for current month (unless cache stale)

#### ✅ **Step 10: Cache vs Database Comparison**
- **Purpose**: Verify cache and database match for current month
- **What to look for**:
  - ✅ **Match** → System working correctly
  - ⚠️ **Mismatch** → Cache may be out of sync
  - ⚠️ **Cache missing** → Cache not being created

---

## Common Issues & Solutions

### Issue 1: Booking Steps Showing Random Values

**Symptoms**:
- All campaigns have identical booking step values
- Step2 > Step1 or Step3 > Step2 (impossible ratios)
- Booking steps exist but spend = 0

**Possible Causes**:
1. **Parser Issue**: Conversion action names not matching correctly
   - Check: `src/lib/google-ads-actions-parser.ts`
   - Verify: Conversion names match patterns (e.g., "PBM - Booking Engine - krok 1")
2. **Data Distribution Bug**: Values being distributed equally instead of using real data
   - Check: Aggregation logic in `google-ads-smart-cache-helper.ts`
   - Verify: Each campaign has individual conversion data
3. **Cache Corruption**: Old/corrupted data in cache
   - Solution: Force refresh cache or clear cache entries

**How to Fix**:
```sql
-- Check what's in the cache
SELECT 
  client_id,
  period_id,
  cache_data->'conversionMetrics'->>'booking_step_1' as step1,
  cache_data->'conversionMetrics'->>'booking_step_2' as step2,
  cache_data->'conversionMetrics'->>'booking_step_3' as step3
FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- Force refresh by deleting cache (will regenerate on next request)
DELETE FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
```

### Issue 2: Smart Cache Not Being Used

**Symptoms**:
- Current month data coming from database instead of cache
- Cache exists but system not using it
- Slow response times for current period

**Possible Causes**:
1. **Period Detection Bug**: System not recognizing current period
   - Check: `src/lib/standardized-data-fetcher.ts` period detection logic
   - Verify: `isCurrentPeriod` flag is set correctly
2. **Cache Routing Issue**: Wrong priority order in data fetcher
   - Check: `src/lib/google-ads-standardized-data-fetcher.ts`
   - Verify: Smart cache is checked BEFORE database
3. **Cache Not Fresh**: Cache exists but marked as stale
   - Check: Cache age in audit results
   - Solution: Force refresh cache

**How to Fix**:
```sql
-- Check cache freshness
SELECT 
  client_id,
  period_id,
  last_updated,
  EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 as age_hours
FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- If cache is stale, force refresh by calling the API endpoint
-- Or manually refresh:
-- DELETE FROM google_ads_current_month_cache WHERE period_id = '...';
```

### Issue 3: Meta vs Google Cache Inconsistency

**Symptoms**:
- Meta cache working but Google cache not
- Different cache refresh times between platforms
- One platform using cache, other using database

**How to Check**:
```sql
-- Compare cache status
SELECT 
  'meta' as platform,
  COUNT(*) as cache_entries,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_updated))/3600) as avg_age_hours
FROM current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
UNION ALL
SELECT 
  'google' as platform,
  COUNT(*) as cache_entries,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_updated))/3600) as avg_age_hours
FROM google_ads_current_month_cache
WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
```

---

## Running the Audit

### Step 1: Execute the SQL Script

```bash
# Run the audit script
psql -d your_database -f scripts/AUDIT_BOOKING_STEPS_AND_SMART_CACHE.sql
```

### Step 2: Review Results

Focus on these sections:
1. **Step 3**: Data quality flags (look for ⚠️ or 🚨)
2. **Step 4**: Cache vs database mismatches
3. **Step 9**: Data source analysis (should show "Using cache source" for current month)
4. **Step 11-12**: Booking steps anomalies
5. **Step 13**: Overall summary

### Step 3: Take Action

Based on audit results:
- **If booking steps are suspicious**: Check parser and aggregation logic
- **If cache not being used**: Check period detection and routing logic
- **If cache stale**: Force refresh or check cron jobs
- **If data mismatch**: Investigate data flow from API → Cache → Database

---

## Key Files to Check

### Booking Steps Parsing
- `src/lib/google-ads-actions-parser.ts` - Conversion parsing logic
- `src/lib/google-ads-api.ts` - API integration and conversion fetching
- `src/lib/google-ads-smart-cache-helper.ts` - Cache data aggregation

### Smart Cache System
- `src/lib/smart-cache-helper.ts` - Meta smart cache
- `src/lib/google-ads-smart-cache-helper.ts` - Google Ads smart cache
- `src/lib/standardized-data-fetcher.ts` - Period detection and routing
- `src/lib/google-ads-standardized-data-fetcher.ts` - Google Ads data fetching

### Data Storage
- `src/lib/data-lifecycle-manager.ts` - Database storage logic
- `src/lib/background-data-collector.ts` - Historical data collection

---

## Expected Results

### ✅ Healthy System

**Booking Steps**:
- ✅ All campaigns have realistic booking step values
- ✅ Step1 > Step2 > Step3 (funnel makes sense)
- ✅ Ratios are realistic (Step2/Step1: 10-30%, Step3/Step2: 20-50%)

**Smart Cache**:
- ✅ Current month cache exists and is fresh (< 3h)
- ✅ Current week cache exists and is fresh (< 3h)
- ✅ Data source shows "Using cache source" for current periods
- ✅ Cache and database match for current month

### ⚠️ Issues Found

**Booking Steps**:
- ⚠️ Identical values across steps → Data quality issue
- ⚠️ Impossible ratios → Parser or aggregation bug
- ⚠️ Missing booking steps despite spend → Data fetch issue

**Smart Cache**:
- ⚠️ Cache stale (> 6h) → Refresh issue
- ⚠️ Cache not being used → Routing issue
- ⚠️ Cache and database mismatch → Sync issue

---

## Next Steps After Audit

1. **Document Findings**: Note all ⚠️ and 🚨 flags
2. **Prioritize Issues**: Focus on critical issues first (impossible ratios, missing cache)
3. **Investigate Root Cause**: Check relevant code files listed above
4. **Fix Issues**: Apply fixes and verify with re-audit
5. **Monitor**: Set up alerts for cache freshness and data quality

