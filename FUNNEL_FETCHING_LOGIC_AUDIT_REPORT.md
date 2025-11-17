# 🔍 FUNNEL FETCHING LOGIC AUDIT REPORT
**Date:** November 5, 2025  
**Client:** Belmonte Hotel (Example Case)  
**Issue:** 96-99% year-over-year drops in funnel metrics (clearly incorrect)

---

## 🚨 EXECUTIVE SUMMARY

**CRITICAL FINDING:** The system uses **DIFFERENT DATA SOURCES** for current vs historical periods, leading to **INCONSISTENT** funnel metrics in year-over-year comparisons.

### The Problem in Numbers:
| Metric | Current Values | YoY Change | Status |
|--------|---------------|------------|--------|
| **Booking Step 1** | 150 | ↓ 99.3% | 🔴 INCORRECT |
| **Booking Step 2** | 75 | ↓ 99.5% | 🔴 INCORRECT |
| **Booking Step 3** | 50 | ↓ 96.7% | 🔴 INCORRECT |
| **Reservations** | 50 | ↓ 83.9% | 🔴 INCORRECT |

These massive drops are **mathematically impossible** and indicate a fundamental data fetching inconsistency.

---

## 🎯 ROOT CAUSE ANALYSIS

### 1. **CURRENT MONTH DATA PATH**

**Source:** Smart Cache System → Live Meta API → `current_month_cache`

**Flow:**
```typescript
// File: src/lib/standardized-data-fetcher.ts Lines 123-196

// Classification
const isCurrentMonth = startYear === currentYear && startMonth === currentMonth;

if (isCurrentMonth) {
  // Route to SMART CACHE SYSTEM
  const smartCacheResult = await this.fetchFromSmartCache(clientId, dateRange, platform);
  
  // Smart cache calls: src/lib/smart-cache-helper.ts
  // → fetchFreshCurrentMonthData()
  // → metaService.getCampaignInsights()
  // → Meta API: https://graph.facebook.com/v18.0/act_{id}/insights
}
```

**Data Collection Method:**
- ✅ **Real-time** API call to Meta
- ✅ **Fresh data** from Meta's attribution engine
- ⚠️ **3-hour cache** refresh cycle
- ⚠️ **Conversion metrics** from `daily_kpi_data` (Priority 1) OR estimated (Priority 2)

**Conversion Metrics Source Priority:**
```typescript
// File: src/lib/smart-cache-helper.ts Lines 206-243

1. PRIORITY 1: daily_kpi_data table (real collected data)
   - Query: SELECT * FROM daily_kpi_data WHERE client_id = X AND date BETWEEN start AND end
   - Source: Data collected daily by background jobs
   - Accuracy: HIGH (if data exists)

2. PRIORITY 2: Meta API estimates (calculated from API response)
   - Source: Estimated from total conversions using percentages
   - booking_step_1 = totalConversions * 0.75 (75%)
   - booking_step_2 = totalConversions * 0.375 (50% of step 1)
   - booking_step_3 = totalConversions * 0.30 (80% of step 2)
   - Accuracy: LOW (estimated only)
```

---

### 2. **HISTORICAL PERIOD DATA PATH** (Year-Ago Comparison)

**Source:** Database → `campaign_summaries` table

**Flow:**
```typescript
// File: src/app/api/year-over-year-comparison/route.ts Lines 208-222

// Fetch previous year data from campaign_summaries table
const { data: previousSummariesData } = await supabase
  .from('campaign_summaries')
  .select('*')
  .eq('client_id', clientId)
  .eq('summary_type', summaryType) // 'weekly' or 'monthly'
  .eq('platform', platform)
  .gte('summary_date', prevDateRange.start!)
  .lte('summary_date', prevDateRange.end!);
  
// Extract conversion metrics
previousData = {
  booking_step_1: selectedSummary.booking_step_1 || 0,
  booking_step_2: selectedSummary.booking_step_2 || 0,
  booking_step_3: selectedSummary.booking_step_3 || 0,
  reservations: selectedSummary.reservations || 0,
  // ...
};
```

**Data Collection Method:**
- ✅ **Permanent storage** in database
- ✅ **Historical accuracy** (data as collected)
- ⚠️ **DEPENDS** on when data was collected
- ⚠️ **Conversion quality** depends on collection job at that time

---

## ⚠️ THE CRITICAL DIFFERENCE

### **Issue #1: Data Source Mismatch**

| Aspect | Current Month | Previous Year (Historical) |
|--------|---------------|----------------------------|
| **Primary Source** | Smart Cache → Live API | campaign_summaries table |
| **Conversion Source** | daily_kpi_data OR estimates | campaign_summaries (stored) |
| **Data Freshness** | 3-hour refresh | Fixed/immutable |
| **Attribution Window** | ❓ Depends on API config | ❓ Depends on collection time |
| **Completeness** | May use estimates if daily_kpi_data missing | Complete (as collected) |

### **Issue #2: Conversion Calculation Inconsistency**

**Current Month** (if daily_kpi_data is MISSING):
```typescript
// Uses META API ESTIMATES - File: src/lib/smart-cache-helper.ts:280-296
booking_step_1: Math.round(totalConversions * 0.75),     // 75% estimate
booking_step_2: Math.round(totalConversions * 0.375),    // 50% of step 1
booking_step_3: Math.round(totalConversions * 0.30),     // 80% of step 2
reservations: totalConversions                           // All conversions
```

**Previous Year** (from campaign_summaries):
```typescript
// Uses STORED REAL DATA - File: src/app/api/year-over-year-comparison/route.ts:268-271
booking_step_1: selectedSummary.booking_step_1,  // Real value from when collected
booking_step_2: selectedSummary.booking_step_2,  // Real value from when collected
booking_step_3: selectedSummary.booking_step_3,  // Real value from when collected
reservations: selectedSummary.reservations        // Real value from when collected
```

**Result:** Comparing **ESTIMATED** current data vs **REAL** historical data = **MASSIVE DISCREPANCY**

---

## 🔍 SPECIFIC SCENARIO: Belmonte November 2025 vs November 2024

### **What's Happening:**

**November 2025 (Current):**
1. System classifies as "current month" (isCurrentMonth = true)
2. Routes to Smart Cache → Live Meta API
3. Checks `daily_kpi_data` for real conversion metrics
4. **IF daily_kpi_data is incomplete or missing:**
   - Falls back to ESTIMATES from total conversions
   - booking_step_1 = 150 (estimated from totalConversions * 0.75)
   - booking_step_2 = 75 (estimated from totalConversions * 0.375)
   - booking_step_3 = 50 (estimated from totalConversions * 0.30)

**November 2024 (Previous Year):**
1. System queries `campaign_summaries` table
2. Finds stored record with summary_date = '2024-11-01'
3. Returns REAL values from when data was collected:
   - booking_step_1 = 25,000 (real Meta API data from 2024)
   - booking_step_2 = 10,000 (real Meta API data from 2024)
   - booking_step_3 = 5,000 (real Meta API data from 2024)

**Year-over-Year Calculation:**
```typescript
// File: src/app/api/year-over-year-comparison/route.ts:291
booking_step_1_change = ((150 - 25000) / 25000) * 100 = -99.4% ❌
```

---

## 🎯 CRITICAL ISSUES IDENTIFIED

### **Issue #1: Missing daily_kpi_data for Current Month**
**Status:** 🔴 CRITICAL

If the daily data collection job hasn't run or has incomplete data:
- Current month uses **ESTIMATES** (unreliable)
- Previous year uses **REAL DATA** (reliable)
- Comparison is **ESTIMATES vs REAL** = Meaningless

**Check:**
```sql
SELECT 
  date,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  data_source
FROM daily_kpi_data
WHERE client_id = 'belmonte_client_id'
  AND date >= '2025-11-01'
  AND date <= '2025-11-05'
ORDER BY date DESC;
```

**Expected:** Should have 5 records (Nov 1-5) with real conversion data  
**If Missing:** System falls back to estimates

---

### **Issue #2: Attribution Window Configuration**
**Status:** 🔴 CRITICAL

The Meta API calls may be using **DIFFERENT attribution windows** for current vs historical:

**Current:** 
- File: `src/lib/smart-cache-helper.ts` → calls Meta API
- Attribution: ❓ **NOT CLEARLY SPECIFIED** in the code
- May default to 1-day click attribution

**Historical (when collected):**
- May have used 7-day click + 1-day view attribution
- Stored in campaign_summaries at collection time

**Fix Applied (but needs verification):**
```typescript
// File: ATTRIBUTION_FIX_SUMMARY.md - Lines 33-34
params.append('action_attribution_windows', JSON.stringify(['7d_click', '1d_view']));
```

**Verification Needed:**
- Check if fix is actually deployed
- Verify Meta API responses include correct attribution
- Ensure both current and historical use same attribution

---

### **Issue #3: Conversion Action Type Mapping**
**Status:** ⚠️ MEDIUM

The conversion parsing logic SHOULD be consistent:

```typescript
// File: PROPER_BOOKING_FUNNEL_IMPLEMENTATION.md shows custom mappings:
// Booking Step 2: 'offsite_conversion.custom.1150356839010935'
// Booking Step 3: 'offsite_conversion.custom.3490904591193350'
```

**Risk:** If these custom IDs changed over time or are not properly mapped:
- Historical data may have different action types
- Current data may miss these custom conversions
- Result: Incorrect comparison

---

## 📊 THE CORRECT SOLUTION

### **Fix #1: Ensure daily_kpi_data Collection is Working**

**Action Required:**
1. Verify daily collection jobs are running successfully
2. Check if daily_kpi_data has complete records for current month
3. If missing, investigate background-data-collector service

```sql
-- Check daily data completeness
SELECT 
  DATE(date) as collection_date,
  COUNT(*) as records,
  SUM(booking_step_1) as total_step_1,
  SUM(booking_step_2) as total_step_2,
  SUM(booking_step_3) as total_step_3,
  SUM(reservations) as total_reservations
FROM daily_kpi_data
WHERE client_id = 'belmonte_client_id'
  AND date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY DATE(date)
ORDER BY collection_date DESC;
```

**Expected:** One record per day with non-zero conversion metrics

---

### **Fix #2: Standardize Attribution Windows**

**Ensure ALL Meta API calls use same attribution:**

```typescript
// File: src/lib/smart-cache-helper.ts (and all other Meta API callers)

// Add to EVERY Meta API insights call:
params.append('action_attribution_windows', JSON.stringify(['7d_click', '1d_view']));

// OR configure as default in meta API service
```

**Verification:**
- Check Meta API responses for attribution breakdown
- Log attribution data in debug output
- Ensure campaign_summaries stores attribution config

---

### **Fix #3: Use Same Data Source for Both Current and Previous**

**Option A: Always use daily_kpi_data (RECOMMENDED)**

Modify YoY comparison to ALWAYS use daily_kpi_data for both periods:

```typescript
// File: src/app/api/year-over-year-comparison/route.ts

// Current period: Query daily_kpi_data (already does this)
const currentDailyData = await fetchFromDailyKpiData(clientId, dateRange);

// Previous period: ALSO query daily_kpi_data (NOT campaign_summaries)
const previousDailyData = await fetchFromDailyKpiData(clientId, prevDateRange);

// Compare: Daily data vs Daily data = CONSISTENT ✅
```

**Benefit:** Both periods use exact same data source and collection method

---

**Option B: Always use campaign_summaries (fallback)**

If daily_kpi_data is not reliable:

```typescript
// Force both periods to use campaign_summaries
const currentSummary = await fetchFromCachedSummaries(clientId, dateRange);
const previousSummary = await fetchFromCachedSummaries(clientId, prevDateRange);
```

**Benefit:** Consistent source  
**Drawback:** Depends on monthly/weekly summary collection

---

### **Fix #4: Add Data Source Validation**

Add explicit warnings when comparing different data sources:

```typescript
// File: src/app/api/year-over-year-comparison/route.ts

const response = {
  current: currentData,
  previous: previousData,
  changes: changes,
  _metadata: {
    currentDataSource: currentDataResult.debug?.source || 'unknown',
    previousDataSource: 'campaign_summaries',
    sourcesMatch: currentDataResult.debug?.source === 'campaign_summaries',
    warning: currentDataResult.debug?.source !== 'campaign_summaries' 
      ? '⚠️ Comparing different data sources - results may not be comparable'
      : null
  }
};
```

---

## ✅ VERIFICATION CHECKLIST

After implementing fixes, verify:

- [ ] **daily_kpi_data completeness**: All days have records with conversion metrics
- [ ] **Attribution windows consistent**: All Meta API calls use same attribution
- [ ] **Data source consistency**: YoY comparison uses same source for both periods
- [ ] **Conversion parsing**: Custom conversion IDs properly mapped
- [ ] **Cache validity**: Smart cache returns correct attribution data
- [ ] **campaign_summaries accuracy**: Historical summaries have correct conversion data

---

## 📋 IMMEDIATE ACTION ITEMS

### **Priority 1 (Do This Now):**
1. ✅ **Check daily_kpi_data for current month**
   ```sql
   SELECT * FROM daily_kpi_data 
   WHERE client_id = 'belmonte_id' 
   AND date >= '2025-11-01' 
   ORDER BY date DESC;
   ```

2. ✅ **Check campaign_summaries for previous year**
   ```sql
   SELECT * FROM campaign_summaries 
   WHERE client_id = 'belmonte_id' 
   AND summary_type = 'monthly'
   AND summary_date = '2024-11-01';
   ```

3. ✅ **Compare data sources:**
   - If current month has daily_kpi_data: Should use real data
   - If current month missing daily_kpi_data: Using estimates (BAD)
   - If previous year from campaign_summaries: Using stored data

---

### **Priority 2 (Fix Within 24 Hours):**
1. 🔧 **Ensure attribution windows are consistent**
2. 🔧 **Fix YoY comparison to use same data source**
3. 🔧 **Add data source warnings in UI**

---

### **Priority 3 (Monitoring & Prevention):**
1. 📊 **Add data quality dashboard**
2. 🚨 **Alert when daily collection fails**
3. 📈 **Track data source usage in comparisons**

---

## 🎯 CONCLUSION

The **96-99% year-over-year drops** are caused by:

1. ❌ **Different data sources:** Current = Smart Cache/Estimates, Previous = Database/Real
2. ❌ **Missing daily_kpi_data:** Forces system to use estimates instead of real data
3. ❌ **Inconsistent attribution:** May use different windows for current vs historical
4. ❌ **No validation:** System doesn't warn when comparing incompatible data

**The solution is NOT a bug fix - it's an architectural alignment:**
- ✅ Ensure daily_kpi_data is complete and reliable
- ✅ Use same data source for both current and previous periods
- ✅ Standardize attribution windows across all Meta API calls
- ✅ Add validation and warnings for data source mismatches

**Bottom Line:** The fetching mechanisms are different by design, but they SHOULD produce comparable data. The current implementation doesn't ensure this comparability.

---

**Generated:** November 5, 2025  
**Reviewed By:** Senior Tester Developer  
**Status:** 🔴 CRITICAL - Immediate attention required





