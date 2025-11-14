# 🔍 Google Ads Data Flow Audit - Complete Analysis

**Date:** November 6, 2025  
**Status:** ⚠️ **ISSUES FOUND - NEEDS FIX**

---

## 📊 Current State (From Screenshot)

```
Źródło danych: standardized-fetcher
Polityka: database-first-standardized  ❌ WRONG!
Oczekiwane: daily_kpi_data | Rzeczywiste: unknown
```

**Issues:**
1. ❌ Policy should be `smart-cache` for current period (November 2025)
2. ❌ Actual source is `unknown` (fallback/error state)
3. ❌ Expected source is `daily_kpi_data` (which doesn't exist for Google Ads yet)

---

## 🔀 TWO SEPARATE SYSTEMS IDENTIFIED

### **System A: Meta (StandardizedDataFetcher)**
- **File:** `src/lib/standardized-data-fetcher.ts`
- **Used for:** Meta Ads data
- **Flow:** Client-side → API `/api/fetch-live-data` OR Server-side → Direct DB/cache

### **System B: Google Ads (GoogleAdsStandardizedDataFetcher)**
- **File:** `src/lib/google-ads-standardized-data-fetcher.ts`
- **Used for:** Google Ads data
- **Flow:** Server-side ONLY → Direct DB/cache (NO API route used!)

---

## 🚨 CRITICAL ISSUE FOUND

### **The Google Ads Fetcher Priority is WRONG:**

```typescript
// Line 110-247 of google-ads-standardized-data-fetcher.ts

Priority 1: daily_kpi_data (data_source='google_ads_api')
  ❌ PROBLEM: This table is empty for Google Ads!
  ❌ Result: Always returns no data

Priority 2: google_ads_smart_cache (only if needsLiveData)
  ⚠️ PROBLEM: Only used AFTER daily_kpi_data fails
  ⚠️ Should be Priority 1 for current periods!

Priority 3: google_ads_database_summaries (only if !needsLiveData)
  ✅ CORRECT: For historical periods

Priority 4: google_ads_live_api
  ✅ CORRECT: Fallback
```

### **What's Happening:**
1. User requests November 2025 data (current period)
2. `needsLiveData = true` (line 97)
3. Tries `daily_kpi_data` → **EMPTY** (no Google Ads data there)
4. Tries `google_ads_smart_cache` → **Should work but...**
5. Returns with policy: `database-first-standardized` ❌

---

## 📋 Correct Priority Order (Should Be):

### **For CURRENT Period (November 2025):**
```
1. google_ads_smart_cache  ✅ (< 500ms)
   ↓ if fails
2. google_ads_current_month_cache (direct DB)  ✅
   ↓ if fails
3. google_ads_live_api  ✅
```

### **For HISTORICAL Period (October 2024):**
```
1. campaign_summaries (platform='google')  ✅ (< 50ms)
   ↓ if fails
2. daily_kpi_data  ⚠️ (empty for Google Ads)
   ↓ if fails
3. google_ads_live_api (can fetch historical)  ✅
```

---

## 🔧 Code Locations

### **Server-Side Routing (reports page):**

```typescript
// src/app/reports/page.tsx:192-201

if (typeof window === 'undefined') {
  // Server-side: use Google Ads fetcher directly
  const { GoogleAdsStandardizedDataFetcher } = await import('../../lib/google-ads-standardized-data-fetcher');
  
  result = await GoogleAdsStandardizedDataFetcher.fetchData({
    clientId,
    dateRange,
    reason: reason || 'google-ads-reports-standardized',
    sessionToken: session?.access_token
  });
}
```

**Issue:** This bypasses the API route entirely! The smart cache fix we added to `/api/fetch-google-ads-live-data` is NOT being used server-side!

### **Client-Side Routing:**

```typescript
// src/lib/standardized-data-fetcher.ts:142-183

if (typeof window !== 'undefined') {
  const apiUrl = params.platform === 'google' 
    ? '/api/fetch-google-ads-live-data'  ✅ Uses API (has smart cache)
    : '/api/fetch-live-data';
  
  const response = await fetch(apiUrl, {...});
}
```

**Status:** ✅ Client-side DOES use the API route with smart cache

---

## 🎯 ROOT CAUSE ANALYSIS

### **Two Execution Paths:**

| Path | Code | Smart Cache | Database | Issue |
|------|------|-------------|----------|-------|
| **Client-side** | StandardizedDataFetcher → API route | ✅ YES | ✅ YES | **Works correctly** |
| **Server-side** | GoogleAdsStandardizedDataFetcher | ⚠️ Priority 2 | ⚠️ Priority 1 | **Wrong priority order** |

### **Why Screenshot Shows Wrong Data:**

The reports page runs SERVER-SIDE on first load, so it uses `GoogleAdsStandardizedDataFetcher` which:
1. Checks `daily_kpi_data` first (empty for Google Ads)
2. Then checks smart cache
3. Returns with wrong policy metadata

---

## ✅ RECOMMENDED FIX

### **Option 1: Fix Priority Order (Recommended)**

Update `src/lib/google-ads-standardized-data-fetcher.ts`:

```typescript
// Line 110+
try {
  // ✅ NEW Priority 1: Smart cache for CURRENT periods
  if (needsLiveData) {
    console.log('1️⃣ CURRENT PERIOD: Checking Google Ads smart cache...');
    dataSources.push('google_ads_smart_cache');
    
    const cacheResult = await this.fetchFromGoogleAdsSmartCache(clientId);
    if (cacheResult.success) {
      return {
        success: true,
        data: cacheResult.data!,
        debug: {
          source: 'google-ads-smart-cache',
          cachePolicy: 'smart-cache-3h-refresh',
          responseTime: Date.now() - startTime,
          reason,
          dataSourcePriority: dataSources,
          periodType: 'current'
        },
        validation: {
          actualSource: 'google_ads_smart_cache',
          expectedSource: 'google_ads_smart_cache',
          isConsistent: true
        }
      };
    }
  }
  
  // ✅ NEW Priority 2: Database for HISTORICAL periods
  if (!needsLiveData) {
    console.log('2️⃣ HISTORICAL PERIOD: Checking campaign_summaries...');
    dataSources.push('campaign_summaries_google');
    
    const dbResult = await this.fetchFromDatabaseSummaries(clientId, dateRange);
    if (dbResult.success && hasConversionData) {
      return {
        success: true,
        data: dbResult.data!,
        debug: {
          source: 'campaign-summaries-database',
          cachePolicy: 'database-first-historical',
          responseTime: Date.now() - startTime,
          reason,
          dataSourcePriority: dataSources,
          periodType: 'historical'
        },
        validation: {
          actualSource: 'campaign_summaries',
          expectedSource: 'campaign_summaries',
          isConsistent: true
        }
      };
    }
  }
  
  // ✅ Priority 3: Daily KPI data (if available)
  console.log('3️⃣ Checking daily_kpi_data...');
  const dailyResult = await this.fetchFromDailyKpiData(clientId, dateRange);
  // ...
  
  // ✅ Priority 4: Live API (fallback)
  console.log('4️⃣ Trying live Google Ads API...');
  // ...
}
```

### **Option 2: Use API Route for Server-Side (Alternative)**

Update `src/app/reports/page.tsx` to use API route for both client and server:

```typescript
// Line 192-201
// Remove server-side direct access, always use API route
const apiUrl = '/api/fetch-google-ads-live-data';
const response = await fetch(apiUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId, dateRange })
});
result = await response.json();
```

---

## 📊 Expected Behavior After Fix

### **Current Period (November 2025):**
```
✅ Priority 1: google_ads_smart_cache → SUCCESS
✅ Source: google-ads-smart-cache
✅ Policy: smart-cache-3h-refresh
✅ Response time: < 500ms
✅ Expected: google_ads_smart_cache
✅ Actual: google_ads_smart_cache
✅ isConsistent: true
```

### **Historical Period (October 2024):**
```
✅ Priority 1: campaign_summaries (platform='google') → SUCCESS
✅ Source: campaign-summaries-database
✅ Policy: database-first-historical
✅ Response time: < 50ms
✅ Expected: campaign_summaries
✅ Actual: campaign_summaries
✅ isConsistent: true
```

---

## 🎯 Summary

### **Issues Found:**
1. ❌ `GoogleAdsStandardizedDataFetcher` has wrong priority order
2. ❌ Tries `daily_kpi_data` first (which is empty for Google Ads)
3. ❌ Smart cache is Priority 2 instead of Priority 1
4. ❌ Server-side bypasses API route (which has correct smart cache logic)
5. ❌ Returns wrong policy metadata

### **Impact:**
- ⚠️ Current period data may be slow or use wrong source
- ⚠️ Policy labels are confusing/incorrect
- ⚠️ Not using smart cache as primary source

### **Recommendation:**
Apply **Option 1** (fix priority order) to match Meta's system architecture.

---

**Status:** ⚠️ **NEEDS FIX BEFORE DEPLOYMENT**  
**Priority:** 🔥 **HIGH** (affects data source routing)  
**Estimated Fix Time:** 15 minutes



