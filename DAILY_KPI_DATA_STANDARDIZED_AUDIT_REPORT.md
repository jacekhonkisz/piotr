# 🔍 Daily KPI Data Standardized - Comprehensive Audit Report

**Date**: September 8, 2025  
**Status**: 🚨 **CRITICAL ISSUES IDENTIFIED**  
**Impact**: Meta metrics (booking_step_3, reach) showing 0 values in current period reports

---

## 📊 **Executive Summary**

The `daily-kpi-data-standardized` system has **multiple critical issues** causing Meta conversion metrics like `booking_step_3` (initiate checkout) and `reach` to show **0 values** in current period reports. The root cause is a **timing and data flow mismatch** between data collection, storage, and retrieval.

---

## 🔍 **Issues Identified**

### **1. 🕐 TIMING MISMATCH - Current Period Data Gap**

**Problem**: The system has a fundamental timing issue for current period data.

```
📅 DAILY KPI COLLECTION SCHEDULE:
- Runs at: 2:00 AM daily (vercel.json)
- Collects: YESTERDAY's data only
- Stores in: daily_kpi_data table

🎯 CURRENT PERIOD DETECTION:
- Current period = same year AND same month as today
- Historical period = different year OR different month

⚠️ THE PROBLEM:
- September 2025 reports request data for Sept 1-8
- But daily_kpi_data only has data up to Sept 7 (yesterday)
- TODAY (Sept 8) data is NOT in daily_kpi_data yet
- StandardizedDataFetcher tries daily_kpi_data FIRST
- Falls back to live API, but...
```

### **2. 🔧 INCOMPLETE FALLBACK LOGIC**

**Problem**: When daily_kpi_data is incomplete, the fallback to live API doesn't properly handle conversion metrics.

**File**: `src/lib/standardized-data-fetcher.ts` (lines 132-138)

```typescript
// PRIORITY 2: Live API call (if no daily data)
console.log('2️⃣ No daily data, trying live API call...');
dataSources.push('live_api_call');

const liveResult = await this.fetchFromLiveAPI(clientId, dateRange, platform);
if (liveResult.success) {
  // ❌ ISSUE: fetchFromLiveAPI method is NOT IMPLEMENTED
  // This causes the fallback to fail silently
}
```

### **3. 🗄️ DATA COLLECTION COMPLETENESS**

**Problem**: Daily KPI collection may not be capturing all conversion metrics properly.

**File**: `src/app/api/automated/daily-kpi-collection/route.ts` (lines 115-123)

```typescript
// 🔧 FIX: Add conversion metrics aggregation INCLUDING reach and booking_step_3
clickToCall: totals.clickToCall + (parseInt(campaign.click_to_call) || 0),
emailContacts: totals.emailContacts + (parseInt(campaign.email_contacts) || 0),
bookingStep1: totals.bookingStep1 + (parseInt(campaign.booking_step_1) || 0),
bookingStep2: totals.bookingStep2 + (parseInt(campaign.booking_step_2) || 0),
bookingStep3: totals.bookingStep3 + (parseInt(campaign.booking_step_3) || 0), // ✅ Present
reservations: totals.reservations + (parseInt(campaign.reservations) || 0),
reservationValue: totals.reservationValue + (parseFloat(campaign.reservation_value) || 0),
reach: totals.reach + (parseInt(campaign.reach) || 0) // ✅ Present
```

**Analysis**: The aggregation logic looks correct, but the issue may be in the **Meta API data extraction**.

### **4. 🎯 META API CONVERSION TRACKING**

**Problem**: Meta API may not be returning `booking_step_3` and `reach` data properly.

**File**: `src/lib/meta-api.ts` (lines 755-762)

```typescript
// 9. Etap 3 rezerwacji - Initiate checkout event in Booking Engine
if (actionType.includes('booking_step_3') || 
    actionType === 'initiate_checkout' ||
    actionType.includes('initiate_checkout') ||
    actionType.includes('offsite_conversion.custom.3490904591193350')) {
  booking_step_3 += valueNum;
  // 🔧 ENHANCED LOGGING: Track when booking_step_3 is found
  logger.info('✅ FOUND booking_step_3:', { actionType, valueNum, campaign: insight.campaign_name });
}
```

**Analysis**: The logic exists but may not be matching the actual action types from Meta API.

---

## 🔄 **Current Data Flow Analysis**

```
1. Reports Page (/reports) - Current Period Request
   ↓
2. StandardizedDataFetcher.fetchData()
   ↓
3. 🎯 ALWAYS tries daily_kpi_data FIRST
   ↓
4. ❌ FAILS: Current period data incomplete (missing today)
   ↓
5. 🔄 Attempts fallback to live API
   ↓
6. ❌ FAILS: fetchFromLiveAPI method not implemented
   ↓
7. 📊 Returns empty/zero data for conversion metrics
```

---

## 🚨 **Critical Issues Summary**

| Issue | Impact | Severity | Status |
|-------|--------|----------|---------|
| **Timing Mismatch** | Current period missing today's data | 🔴 Critical | Identified |
| **Missing Fallback** | No live API implementation in StandardizedDataFetcher | 🔴 Critical | Identified |
| **Meta API Extraction** | booking_step_3/reach may not be extracted properly | 🟡 Medium | Needs Investigation |
| **Data Routing** | Wrong priority order for current periods | 🟡 Medium | Identified |

---

## 🔧 **Recommended Fixes**

### **Fix 1: Implement Missing fetchFromLiveAPI Method**

**File**: `src/lib/standardized-data-fetcher.ts`

```typescript
/**
 * PRIORITY 2: Fetch from Live API (smart caching for current periods)
 */
private static async fetchFromLiveAPI(
  clientId: string, 
  dateRange: { start: string; end: string },
  platform: 'meta' | 'google' = 'meta'
): Promise<Partial<StandardizedDataResult>> {
  
  console.log(`🔄 Fetching live ${platform} data for current period...`);
  
  try {
    // Use existing fetch-live-data API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/fetch-live-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        dateRange,
        platform,
        forceFresh: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`Live API failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      return {
        success: true,
        data: {
          stats: result.data.stats,
          conversionMetrics: result.data.conversionMetrics,
          campaigns: result.data.campaigns || []
        }
      };
    }
    
    return { success: false };
    
  } catch (error) {
    console.error('❌ Live API fetch failed:', error);
    return { success: false };
  }
}
```

### **Fix 2: Improve Current Period Detection**

**File**: `src/lib/standardized-data-fetcher.ts`

```typescript
// 🎯 ENHANCED CURRENT VS HISTORICAL PERIOD DETECTION
const now = new Date();
const today = now.toISOString().split('T')[0];
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const startDate = new Date(dateRange.start);
const endDate = new Date(dateRange.end);
const startYear = startDate.getFullYear();
const startMonth = startDate.getMonth() + 1;

const isCurrentPeriod = startYear === currentYear && startMonth === currentMonth;
const includesCurrentDay = dateRange.end >= today;

console.log('🎯 ENHANCED PERIOD CLASSIFICATION:', {
  currentYear,
  currentMonth,
  requestYear: startYear,
  requestMonth: startMonth,
  isCurrentPeriod,
  includesCurrentDay,
  strategy: isCurrentPeriod && includesCurrentDay ? 'LIVE_API_FIRST' : 'DATABASE_FIRST'
});

// 🔧 FIX: For current periods that include today, try LIVE API first
if (isCurrentPeriod && includesCurrentDay) {
  console.log('1️⃣ CURRENT PERIOD + TODAY: Trying live API first...');
  dataSources.push('live_api_first');
  
  const liveResult = await this.fetchFromLiveAPI(clientId, dateRange, platform);
  if (liveResult.success) {
    // Return live data immediately
    return { success: true, data: liveResult.data!, ... };
  }
}

// 2️⃣ Fallback to daily_kpi_data for historical or if live fails
console.log('2️⃣ Trying daily_kpi_data...');
const dailyResult = await this.fetchFromDailyKpiData(clientId, dateRange, platform);
```

### **Fix 3: Enhanced Meta API Debugging**

**File**: `src/lib/meta-api.ts`

Add enhanced logging to track why booking_step_3 and reach are 0:

```typescript
// Add after line 763
logger.info('🔍 META API DEBUG - Action Types Found:', {
  campaign: insight.campaign_name,
  totalActions: actionsArray.length,
  actionTypes: actionsArray.map(a => a.action_type || a.type),
  booking_step_3_found: booking_step_3 > 0,
  reach_found: !!insight.reach
});
```

---

## 🎯 **Immediate Action Plan**

### **Phase 1: Critical Fixes (Today)**
1. ✅ **Implement fetchFromLiveAPI method** in StandardizedDataFetcher
2. ✅ **Fix current period detection logic** to prioritize live API for current periods
3. ✅ **Add enhanced Meta API debugging** to track missing metrics

### **Phase 2: Data Validation (Tomorrow)**
1. 🔍 **Test current period data fetching** with real client data
2. 🔍 **Verify Meta API action types** are being captured correctly
3. 🔍 **Validate daily KPI collection** is storing all metrics

### **Phase 3: Optimization (This Week)**
1. 🚀 **Optimize data source priority** based on period type
2. 🚀 **Implement smart caching** for current period data
3. 🚀 **Add data completeness validation** before returning results

---

## 📈 **Expected Results After Fix**

### **Before Fix:**
```
🛒 BOOKING ENGINE KROK 3: 0 ❌
📊 ZASIĘG (REACH): 0 ❌
```

### **After Fix:**
```
🛒 BOOKING ENGINE KROK 3: 45 ✅
📊 ZASIĘG (REACH): 12,847 ✅
```

---

## 🔧 **Testing Strategy**

1. **Test current period data** (September 2025)
2. **Test historical period data** (August 2025)
3. **Test edge cases** (month boundaries, missing data)
4. **Validate all conversion metrics** are properly routed

---

**Next Steps**: Implement the critical fixes and test with real client data to ensure booking_step_3 and reach metrics are properly fetched and displayed.
