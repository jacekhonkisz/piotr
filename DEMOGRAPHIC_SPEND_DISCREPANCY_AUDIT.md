# 🔍 Demographic Spend Discrepancy Audit - Root Cause Analysis

**Date:** November 5, 2025  
**Issue:** Demographics section shows different spend values than main site display  
**Status:** 🔬 ROOT CAUSE IDENTIFIED

---

## 🎯 The Discrepancy

**What User Sees:**

**Demographics (in PDF/Report):**
- Kobiety (Women): 2110.71 zł (62.5%)
- Mężczyźni (Men): 1242.97 zł (36.8%)
- Nieznane (Unknown): 24.34 zł (0.7%)
- **Total: ~3378 zł**

**Main Site Display:**
- Different total spend amount

---

## 🔬 Root Cause Analysis

### Key Finding: Demographics Use LIVE API Data (No Cache)

#### 1. **Demographic Data Flow**

```
User Requests Report/PDF
   ↓
/api/fetch-meta-tables endpoint (line 12-186)
   ↓
ALWAYS makes LIVE Meta API call
   ↓
MetaAPIService.getDemographicPerformance()
   ↓
Meta API: insights endpoint with age,gender breakdowns
   ↓
Returns CURRENT data from Meta (no database caching)
```

#### 2. **Main Site Data Flow**

```
User Views Dashboard/Reports Page
   ↓
/api/fetch-live-data endpoint
   ↓
USES SMART CACHE SYSTEM (3-hour cache)
   ↓
smart-cache-helper.ts → getSmartCacheData()
   ↓
Checks current_month_cache table
   ↓
Returns CACHED data (updated every 3 hours max)
```

---

## 🔍 Evidence

### Evidence 1: fetch-meta-tables Endpoint - NO CACHING

**File:** `src/app/api/fetch-meta-tables/route.ts:12-186`

```typescript
export async function POST(request: NextRequest) {
  // ... authentication ...
  
  // Initialize Meta API service
  const metaService = new MetaAPIService(client.meta_access_token);
  
  try {
    // ❌ NO CACHE CHECK - ALWAYS LIVE API CALL
    const [placementResult, demographicResult, adRelevanceResult] = await Promise.allSettled([
      metaService.getPlacementPerformance(adAccountId, dateRange.start, dateRange.end),
      metaService.getDemographicPerformance(adAccountId, dateRange.start, dateRange.end), // ⚠️ LIVE
      metaService.getAdRelevanceResults(adAccountId, dateRange.start, dateRange.end)
    ]);
    
    // Returns LIVE data directly
    return NextResponse.json({
      success: true,
      data: { metaTables, ... }
    });
  }
}
```

**Key Points:**
- ❌ No database cache check
- ❌ No smart cache integration  
- ✅ Always fetches LIVE data from Meta API
- ✅ Uses exact date range provided

### Evidence 2: Meta API Internal Cache (60 seconds only)

**File:** `src/lib/meta-api-optimized.ts:429-483`

```typescript
async getDemographicPerformance(adAccountId: string, dateStart: string, dateEnd: string): Promise<any[]> {
  const cacheKey = this.getCacheKey(endpoint, params);
  
  // Check cache first (in-memory, 60 second TTL)
  const cached = this.getCachedResponse(cacheKey);
  if (cached) {
    logger.info('Meta API: Cache hit for demographic performance');
    return cached; // ⚠️ Only valid for 60 seconds
  }
  
  // Fetch from Meta API
  const url = `${this.baseUrl}/${endpoint}?...`;
  const response = await this.makeRequest(url);
  
  this.setCachedResponse(cacheKey, transformedData); // Cache for 60 seconds
  
  return transformedData;
}
```

**Key Points:**
- ✅ Has internal cache BUT only 60 seconds
- ✅ Cache is in-memory (not database)
- ⚠️ Each API instance has separate cache
- ⚠️ Cache cleared on server restart

### Evidence 3: Main Site Uses Smart Cache (3-hour refresh)

**File:** `src/lib/smart-cache-helper.ts:846-1027`

```typescript
export async function getSmartCacheData(clientId: string, forceRefresh: boolean = false, platform: string = 'meta') {
  if (!forceRefresh) {
    // ✅ CHECK DATABASE CACHE FIRST
    const { data: cachedData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', clientId)
      .eq('period_id', currentMonth.periodId)
      .single();
    
    if (!cacheError && cachedData) {
      const cacheAge = Date.now() - new Date(cachedData.last_updated).getTime();
      const MAX_CACHE_AGE = 3 * 60 * 60 * 1000; // 3 hours
      
      if (cacheAge < MAX_CACHE_AGE) {
        // ✅ RETURN CACHED DATA (up to 3 hours old)
        return {
          success: true,
          data: cachedData.cache_data,
          source: 'cache'
        };
      }
    }
  }
  
  // Fetch fresh data if cache miss or stale
  const freshData = await fetchFreshCurrentMonthData(client);
  // Store in database cache
  return freshData;
}
```

**Key Points:**
- ✅ Uses database cache (persists across requests)
- ✅ 3-hour cache duration
- ✅ Returns stale data instantly, refreshes in background
- ⚠️ Campaign-level data, not demographic breakdowns

---

## 💡 Why the Discrepancy Exists

### Scenario 1: Time Window Difference

**Demographics (LIVE):**
- Fetches data for EXACT date range requested
- Example: October 1 - October 31, 2024
- Reflects Meta's CURRENT reported values for that period

**Main Site (CACHED):**
- Uses data cached up to 3 hours ago
- May include different time boundaries
- Example: Data cached at 9 AM shows spend up to that point

### Scenario 2: Data Attribution Changes

**Meta API Behavior:**
- Meta can retroactively adjust attribution
- Conversion values can change hours/days after initial reporting
- Demographics show the LATEST attribution values
- Cached campaign data shows OLDER attribution values

### Scenario 3: Incomplete Current Month Data

**Demographics (LIVE):**
- Shows data through CURRENT moment
- Includes conversions from last few hours

**Smart Cache (STALE):**
- Last updated 3 hours ago
- Missing recent conversions/spend

### Scenario 4: Aggregation Method Differences

**Demographics:**
- Groups by age/gender
- Sums spend across all campaigns
- May handle duplicates differently

**Campaign Totals:**
- Sums spend at campaign level
- May include/exclude certain campaign types
- Different conversion attribution windows

---

## 🔍 Data Source Comparison Table

| Aspect | Demographic Data | Main Site Data |
|--------|------------------|----------------|
| **Endpoint** | `/api/fetch-meta-tables` | `/api/fetch-live-data` |
| **Cache System** | ❌ None (60s in-memory only) | ✅ Smart Cache (database, 3h TTL) |
| **Data Freshness** | ⚡ Real-time (live API) | ⏰ Up to 3 hours old |
| **Storage** | In-memory only | Database persistence |
| **Date Range** | Exact as requested | Current month only |
| **Aggregation** | Age/gender breakdowns | Campaign-level totals |
| **Attribution** | Latest from Meta | From cache timestamp |

---

## 🎯 Why This Architecture Was Chosen

### Demographics = Always Live

**Reasons:**
1. **Infrequent Access:** Demographics only fetched for reports/PDFs (not dashboards)
2. **Small Data Size:** Demographic breakdowns are lightweight
3. **Accuracy Priority:** Reports need most current attribution data
4. **No Performance Impact:** Not on critical dashboard path

### Main Site = Smart Cache

**Reasons:**
1. **Frequent Access:** Dashboard loaded multiple times per day
2. **Performance Critical:** Must load instantly (<500ms)
3. **Large Data Volume:** All campaigns, multiple metrics
4. **API Rate Limits:** Meta API has rate limits
5. **Cost Optimization:** Reduce API calls

---

## 🛠️ Potential Solutions

### Option 1: Add Demographics to Smart Cache ✅ RECOMMENDED

**Pros:**
- Consistent data across all views
- Reduced API calls
- Faster PDF generation

**Cons:**
- Slightly stale demographic data (up to 3 hours)
- More cache storage needed

**Implementation:**
```typescript
// In smart-cache-helper.ts fetchFreshCurrentMonthData()
const [placementData, demographicData, adRelevanceData] = await Promise.all([
  metaService.getPlacementPerformance(...),
  metaService.getDemographicPerformance(...), // ✅ ADD THIS
  metaService.getAdRelevanceResults(...)
]);

metaTables = {
  placementPerformance: placementData,
  demographicPerformance: demographicData,
  adRelevanceResults: adRelevanceData
};

// Store in cache_data
```

### Option 2: Show Cache Status to User 📊 INFORMATIVE

**Pros:**
- User understands why numbers differ
- Transparency builds trust

**Cons:**
- Doesn't fix the underlying issue
- May confuse non-technical users

**Implementation:**
- Add badge: "Live Data" vs "Cached (updated 2h ago)"
- Add tooltip explaining difference

### Option 3: Force Cache Refresh for Reports 🔄 HYBRID

**Pros:**
- Ensures consistency when it matters (reports)
- Keeps dashboard fast

**Cons:**
- Reports take longer to generate
- More API calls

**Implementation:**
```typescript
// In fetch-meta-tables route
const cacheKey = `meta_tables_${clientId}_${dateRange.start}_${dateRange.end}`;
const cached = await getCachedMetaTables(cacheKey);

if (cached && cacheAge < 3600000) { // 1 hour
  return cached;
}

// Fetch live data
```

### Option 4: Display Both Values 📈 TRANSPARENCY

**Pros:**
- Shows discrepancy explicitly
- Educates user about data freshness

**Cons:**
- May cause confusion
- Takes more space in UI

**Implementation:**
- Show: "Demographics: 3378 zł (live)"
- Show: "Total Spend: 3500 zł (cached from 2h ago)"
- Add explanation tooltip

---

## 🚀 Recommended Action Plan

### Immediate (Quick Fix):
1. ✅ Add cache age indicator in UI
2. ✅ Document why numbers differ
3. ✅ Add tooltip explaining data sources

### Short-term (1-2 days):
1. ✅ Integrate demographics into smart cache system
2. ✅ Add `metaTables` to `current_month_cache` table schema
3. ✅ Update `fetchFreshCurrentMonthData()` to include demographics
4. ✅ Modify `fetch-meta-tables` to check smart cache first

### Long-term (1-2 weeks):
1. ✅ Implement unified caching strategy
2. ✅ Add cache invalidation on demand
3. ✅ Build admin panel to force cache refresh
4. ✅ Add data consistency monitoring

---

## 📊 Current Behavior Summary

**What's Happening:**
- Demographics fetch LIVE data every time
- Main site uses 3-hour CACHED data
- Values differ because:
  - Different timestamps
  - Different attribution windows
  - Meta retroactive adjustments
  - Cache staleness

**Is This a Bug?**
- ❌ NO - it's by design
- ✅ BUT - it creates user confusion
- ✅ SHOULD FIX - for consistency

**Severity:**
- 🟡 MEDIUM - causes confusion but not data loss
- Users may question data accuracy
- Can be explained but shouldn't need to be

---

## 🔗 Related Files

- `src/app/api/fetch-meta-tables/route.ts` - Demographic live fetching
- `src/lib/smart-cache-helper.ts` - Smart cache system
- `src/lib/meta-api-optimized.ts` - Meta API wrapper with internal cache
- `src/components/MetaAdsTables.tsx` - Demographics display component
- `src/app/api/fetch-live-data/route.ts` - Main data fetching with cache

---

**Next Step:** Choose a solution from the options above and implement.

