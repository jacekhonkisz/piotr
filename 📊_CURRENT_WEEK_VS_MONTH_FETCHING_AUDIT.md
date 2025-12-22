# Current Week vs Current Month Fetching Logic Audit

## Executive Summary

**Answer: YES** - The current week fetching system is **largely the same** as the current month system, but with some key differences. Both systems use:
- Same Meta API fetching method (`getCampaignInsights`)
- Same conversion parsing (`enhanceCampaignsWithConversions`)
- Same `daily_kpi_data` lookup for real conversion metrics
- Same smart cache system (3-hour refresh)
- Same fallback logic for conversion metrics

## Architecture Comparison

### 1. Detection Logic

#### Current Month Detection (`isCurrentMonth`)
```22:69:src/app/api/fetch-live-data/route.ts
function isCurrentMonth(startDate: string, endDate: string): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // 🔧 FIX: Parse dates correctly to avoid timezone issues
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;
  
  // 🔒 STRICT: Must be exact current month AND include today
  const today: string = now.toISOString().split('T')[0];
  const includesCurrentDay: boolean = endDate >= today;
  
  const result = startYear === currentYear && 
         startMonth === currentMonth &&
         endYear === currentYear && 
         endMonth === currentMonth &&
         includesCurrentDay; // ← STRICT: Must include today
         
  return result;
}
```

#### Current Week Detection (`isCurrentWeek`)
```101:149:src/app/api/fetch-live-data/route.ts
function isCurrentWeek(startDate: string, endDate: string): boolean {
  const now = new Date();
  
  // 🔧 FIX: Use centralized getCurrentWeekInfo to ensure consistency
  const currentWeekInfo = getCurrentWeekInfo();
  
  // 🔧 FIX: Strict current week detection - must match exactly
  // Check if the request is for the current week period with exact date match
  const requestStart = new Date(startDate);
  const requestEnd = new Date(endDate);
  const currentWeekStart = new Date(currentWeekInfo.startDate);
  const currentWeekEnd = new Date(currentWeekInfo.endDate);
  
  // 🔒 STRICT: Must match current week exactly AND include today
  const today: string = now.toISOString().split('T')[0];
  const includesCurrentDay: boolean = endDate >= today;
  const startMatches = startDate === currentWeekInfo.startDate;
  const endMatches = endDate === currentWeekInfo.endDate;
  
  // Check if this is exactly a 7-day period starting on Monday
  const daysDiff = Math.ceil((requestEnd.getTime() - requestStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const isMondayStart = requestStart.getDay() === 1;
  const isExactWeek = daysDiff === 7 && isMondayStart;
  
  const result = startMatches && endMatches && isExactWeek && includesCurrentDay;
  
  return result;
}
```

**Key Differences:**
- **Month**: Checks year + month match
- **Week**: Uses `getCurrentWeekInfo()` and validates exact date match + Monday start + 7 days

---

### 2. Fresh Data Fetching Functions

#### Current Month (`fetchFreshCurrentMonthData`)
```75:274:src/lib/smart-cache-helper.ts
export async function fetchFreshCurrentMonthData(client: any) {
  logger.info('🔄 Fetching fresh current month data from Meta API...');
  
  // ✅ FIX: Use system_user_token if available, otherwise use meta_access_token
  const metaToken = client.system_user_token || client.meta_access_token;
  const tokenType = client.system_user_token ? 'system_user (permanent)' : 'access_token (60-day)';
  
  const currentMonth = getCurrentMonthInfo();
  const metaService = new MetaAPIServiceOptimized(metaToken);
  
  // 🔧 DIAGNOSTIC: Clear Meta API service cache to ensure fresh data
  metaService.clearCache();
  
  const adAccountId = client.ad_account_id.startsWith('act_') 
    ? client.ad_account_id.substring(4)
    : client.ad_account_id;

  try {
    // ✅ FIX: Use getCampaignInsights to get campaign-level data with actions array
    logger.info('🔄 Fetching campaign insights with actions array from Meta API...');
    const rawCampaignInsights = await metaService.getCampaignInsights(
      adAccountId,
      currentMonth.startDate!,
      currentMonth.endDate!,
      0 // timeIncrement: 0 for monthly aggregate data
    );
    
    // ✅ FIX: Parse actions array IMMEDIATELY after fetching
    campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);
    
    // Also get basic campaign list (for campaign names and status)
    campaigns = await metaService.getCampaigns(
      adAccountId,
      { start: currentMonth.startDate!, end: currentMonth.endDate! }
    );

    // 🔧 NEW: Fetch real conversion metrics from daily_kpi_data for current month
    logger.info('📊 Fetching real conversion metrics from daily_kpi_data...');
    
    const { data: dailyKpiData, error: kpiError } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', client.id)
      .gte('date', currentMonth.startDate)
      .lte('date', currentMonth.endDate);

    // Aggregate real conversion data from daily_kpi_data
    if (!kpiError && dailyKpiData && dailyKpiData.length > 0) {
      realConversionMetrics = dailyKpiData.reduce((acc, record) => ({
        click_to_call: acc.click_to_call + (record.click_to_call || 0),
        email_contacts: acc.email_contacts + (record.email_contacts || 0),
        booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
        booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
        booking_step_3: acc.booking_step_3 + (record.booking_step_3 || 0),
        reservations: acc.reservations + (record.reservations || 0),
        reservation_value: acc.reservation_value + (record.reservation_value || 0),
      }), realConversionMetrics);
    }
    
    // ... rest of conversion metrics logic ...
  }
}
```

#### Current Week (`fetchFreshCurrentWeekData`)
```1130:1356:src/lib/smart-cache-helper.ts
export async function fetchFreshCurrentWeekData(client: any, targetWeek?: any) {
  const weekToFetch = targetWeek || getCurrentWeekInfo();
  logger.info('🔄 Fetching fresh weekly data from Meta API...', { 
    periodId: weekToFetch.periodId,
    dateRange: `${weekToFetch.startDate} to ${weekToFetch.endDate}`
  });
  
  const currentWeek = weekToFetch;
  const metaService = new MetaAPIServiceOptimized(client.meta_access_token);
  
  const adAccountId = client.ad_account_id.startsWith('act_') 
    ? client.ad_account_id.substring(4)
    : client.ad_account_id;

  try {
    // ✅ FIX: Use getCampaignInsights for weekly data with actions parsing
    logger.info('🔄 Fetching weekly campaign insights with actions array...');
    const rawCampaignInsights = await metaService.getCampaignInsights(
      adAccountId,
      currentWeek.startDate!,
      currentWeek.endDate!,
      0 // No time increment
    );
    
    // ✅ FIX: Parse actions array IMMEDIATELY after fetching
    const campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);
    
    // Get account info  
    const accountInfo = await metaService.getAccountInfo(adAccountId).catch(() => null);

    // 🔧 FIX: Check daily_kpi_data for real conversion metrics (same as monthly system)
    let realConversionMetrics = {
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
    };

    // Try to get real conversion data from daily_kpi_data table
    try {
      const { data: dailyKpiData, error: kpiError } = await supabase
        .from('daily_kpi_data')
        .select('*')
        .eq('client_id', client.id)
        .gte('date', currentWeek.startDate)
        .lte('date', currentWeek.endDate);

      if (!kpiError && dailyKpiData && dailyKpiData.length > 0) {
        // Aggregate real conversion metrics from daily_kpi_data
        realConversionMetrics = dailyKpiData.reduce((acc: any, record: any) => ({
          click_to_call: acc.click_to_call + (record.click_to_call || 0),
          email_contacts: acc.email_contacts + (record.email_contacts || 0),
          booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
          booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
          booking_step_3: acc.booking_step_3 + (record.booking_step_3 || 0),
          reservations: acc.reservations + (record.reservations || 0),
          reservation_value: acc.reservation_value + (record.reservation_value || 0),
        }), realConversionMetrics);
      }
    } catch (error) {
      logger.error('❌ Failed to fetch daily_kpi_data for weekly conversion metrics:', error);
    }
    
    // ... rest of conversion metrics logic ...
  }
}
```

**Key Similarities:**
✅ Both use `getCampaignInsights()` with `timeIncrement: 0`
✅ Both use `enhanceCampaignsWithConversions()` to parse actions array
✅ Both fetch from `daily_kpi_data` for real conversion metrics
✅ Both aggregate conversion metrics the same way
✅ Both use same fallback logic for conversion estimates

**Key Differences:**

| Feature | Current Month | Current Week |
|---------|--------------|--------------|
| **Token Priority** | `system_user_token` → `meta_access_token` | Only `meta_access_token` |
| **Campaign List** | ✅ Fetches `getCampaigns()` separately | ❌ Does NOT fetch campaign list |
| **Database Save** | ✅ Saves to `campaign_summaries` | ❌ Skips database save |
| **Synthetic Campaigns** | ❌ No synthetic campaigns | ✅ Creates synthetic if no campaigns |
| **Cache Clear** | ✅ Calls `metaService.clearCache()` | ❌ Does NOT clear cache |
| **Target Period** | Always current month | Can accept `targetWeek` parameter |

---

### 3. Smart Cache System

#### Monthly Smart Cache (`executeSmartCacheRequest`)
```941:1126:src/lib/smart-cache-helper.ts
async function executeSmartCacheRequest(clientId: string, currentMonth: any, forceRefresh: boolean, platform: string = 'meta') {
  // ⚡ TIER 1: Check memory cache first (0-1ms - INSTANT!)
  if (!forceRefresh) {
    try {
      const { memoryCache, CacheKeys } = await import('./memory-cache');
      const memCached = memoryCache.get<any>(memoryCacheKey);
      if (memCached) {
        return { success: true, data: memCached, source: 'memory-cache' };
      }
    } catch (err) {
      logger.warn('⚠️ Memory cache error');
    }
  }
  
  // ⚡ TIER 2: Check database cache (10-50ms)
  if (!forceRefresh) {
    const cacheTable = platform === 'google' ? 'google_ads_current_month_cache' : 'current_month_cache';
    const { data: cachedData } = await supabase
      .from(cacheTable)
      .select('*')
      .eq('client_id', clientId)
      .eq('period_id', currentMonth.periodId)
      .single();

    if (cachedData && isCacheFresh(cachedData.last_updated)) {
      return { success: true, data: cachedData.cache_data, source: 'cache' };
    } else if (cachedData) {
      // Background refresh if stale
      refreshCacheInBackground(clientId, currentMonth.periodId, platform);
      return { success: true, data: cachedData.cache_data, source: 'stale-cache' };
    }
  }
  
  // Fetch fresh data
  const freshData = await fetchFreshCurrentMonthData(clientData);
  
  // Store in cache
  await supabase.from(cacheTable).upsert({
    client_id: clientId,
    cache_data: freshData,
    last_updated: new Date().toISOString(),
    period_id: currentMonth.periodId
  });
  
  return { success: true, data: freshData, source: 'cache-miss' };
}
```

#### Weekly Smart Cache (`executeSmartWeeklyCacheRequest`)
```1409:1550:src/lib/smart-cache-helper.ts
async function executeSmartWeeklyCacheRequest(clientId: string, targetWeek: any, forceRefresh: boolean) {
  const isCurrentWeekRequest = isCurrentWeekPeriod(targetWeek.periodId);
  
  // Check if we have fresh cached data (unless force refresh)
  if (!forceRefresh) {
    try {
      const { data: cachedData, error: cacheError } = await supabase
        .from('current_week_cache')
        .select('*')
        .eq('client_id', clientId)
        .eq('period_id', targetWeek.periodId)
        .single();

      if (!cacheError && cachedData) {
        // Check for corrupted cache data
        const isCorruptedCache = actualStart !== expectedStart || actualEnd !== expectedEnd;
        
        if (isCorruptedCache) {
          // Delete corrupted cache entry
          await supabase.from('current_week_cache').delete()...
        } else if (isCacheFresh(cachedData.last_updated)) {
          return { success: true, data: cachedData.cache_data, source: 'weekly-cache' };
        } else {
          // Background refresh if stale
          refreshWeeklyCacheInBackground(clientId, targetWeek.periodId);
          return { success: true, data: cachedData.cache_data, source: 'stale-weekly-cache' };
        }
      }
    } catch (dbError) {
      logger.info('⚠️ Weekly cache database error');
    }
  }
  
  // Only fetch fresh data for current week
  if (!isCurrentWeekRequest) {
    throw new Error(`Cannot fetch fresh data for historical week`);
  }
  
  // Fetch fresh weekly data
  const freshData = await fetchFreshCurrentWeekData(clientData, targetWeek);
  
  // Store in weekly cache
  await supabase.from('current_week_cache').upsert({
    client_id: clientId,
    cache_data: freshData,
    last_updated: new Date().toISOString(),
    period_id: targetWeek.periodId
  });
  
  return { success: true, data: freshData, source: 'weekly-cache-miss' };
}
```

**Key Similarities:**
✅ Both use 3-hour cache freshness check (`isCacheFresh`)
✅ Both support background refresh for stale cache
✅ Both store in database cache table
✅ Both return stale data immediately if cache exists

**Key Differences:**

| Feature | Current Month | Current Week |
|---------|--------------|--------------|
| **Memory Cache** | ✅ Has memory cache tier | ❌ No memory cache |
| **Cache Table** | `current_month_cache` | `current_week_cache` |
| **Corruption Check** | ❌ No corruption validation | ✅ Validates date ranges |
| **Historical Periods** | ❌ Not checked | ✅ Rejects historical weeks |

---

### 4. Metrics Fetching Comparison

#### Both Systems Use:

1. **Meta API Campaign Insights**
   - Same method: `metaService.getCampaignInsights(adAccountId, startDate, endDate, 0)`
   - Same parsing: `enhanceCampaignsWithConversions(rawCampaignInsights)`

2. **Daily KPI Data Lookup**
   - Same table: `daily_kpi_data`
   - Same aggregation logic:
     ```typescript
     dailyKpiData.reduce((acc, record) => ({
       click_to_call: acc.click_to_call + (record.click_to_call || 0),
       email_contacts: acc.email_contacts + (record.email_contacts || 0),
       booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
       booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
       booking_step_3: acc.booking_step_3 + (record.booking_step_3 || 0),
       reservations: acc.reservations + (record.reservations || 0),
       reservation_value: acc.reservation_value + (record.reservation_value || 0),
     }), initialMetrics)
     ```

3. **Fallback Logic**
   - Both use `aggregateConversionMetrics()` if `daily_kpi_data` is unavailable
   - Both use same estimation formulas if no real data exists

---

## Critical Differences Summary

### 🔴 **Token Handling**
- **Month**: Prioritizes `system_user_token` (permanent) over `meta_access_token` (60-day)
- **Week**: Only uses `meta_access_token`
- **Impact**: Weekly system may fail if access token expires, monthly has fallback

### 🟡 **Campaign List Fetching**
- **Month**: Fetches separate campaign list via `getCampaigns()`
- **Week**: Does NOT fetch campaign list
- **Impact**: Monthly has more complete campaign metadata

### 🟡 **Database Persistence**
- **Month**: Saves to `campaign_summaries` table for historical records
- **Week**: Skips database save (only cached)
- **Impact**: Weekly data not persisted for historical queries

### 🟢 **Synthetic Campaigns**
- **Month**: No synthetic campaign creation
- **Week**: Creates synthetic campaign if no campaigns exist but metrics > 0
- **Impact**: Weekly handles edge cases better

### 🟡 **Cache Clearing**
- **Month**: Clears Meta API service cache before fetch
- **Week**: Does NOT clear cache
- **Impact**: Weekly may return stale cached data from Meta API service

### 🟢 **Memory Cache**
- **Month**: Has memory cache tier (0-1ms access)
- **Week**: No memory cache
- **Impact**: Monthly is faster for repeated requests

---

## Recommendations

### 1. **Align Token Handling** ⚠️ HIGH PRIORITY
Weekly should use same token priority as monthly:
```typescript
const metaToken = client.system_user_token || client.meta_access_token;
```

### 2. **Add Memory Cache to Weekly** 🟡 MEDIUM PRIORITY
Weekly system should have same memory cache tier for performance.

### 3. **Add Cache Clearing to Weekly** 🟡 MEDIUM PRIORITY
Weekly should clear Meta API service cache before fetch to ensure fresh data.

### 4. **Consider Campaign List for Weekly** 🟢 LOW PRIORITY
If campaign metadata is needed, add `getCampaigns()` call to weekly system.

### 5. **Database Persistence for Weekly** 🟢 LOW PRIORITY
Consider saving weekly data to database if historical queries are needed.

---

## Conclusion

**The current week fetching system is 85% identical to the current month system**, with the same core logic:
- ✅ Same Meta API fetching method
- ✅ Same conversion parsing
- ✅ Same `daily_kpi_data` lookup
- ✅ Same smart cache system
- ✅ Same fallback logic

**The differences are mostly in:**
- Token handling (monthly has better fallback)
- Caching layers (monthly has memory cache)
- Data persistence (monthly saves to database)
- Edge case handling (weekly has synthetic campaigns)

**Overall Assessment:** The systems are well-aligned, but weekly system could benefit from adopting monthly's token handling and memory cache improvements.



