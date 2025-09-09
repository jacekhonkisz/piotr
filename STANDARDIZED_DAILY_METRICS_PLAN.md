# Standardized Daily Metrics Implementation Plan

## 🎯 Goal: Use Exact Same Logic as /reports + Smart Caching for Daily Metrics

Based on analysis of `/reports` page, we'll standardize the dashboard to use the **exact same unified data fetching pattern** while adding smart caching specifically for day-by-day metrics.

---

## 📋 **CURRENT REPORTS PATTERN ANALYSIS**

### ✅ What Reports Does Well (REUSE THIS):

1. **Unified Data Fetching Function**:
```typescript
// File: src/app/reports/page.tsx (lines 162-237)
const fetchReportDataUnified = async (params: {
  dateRange: { start: string; end: string };
  clientId: string;
  platform?: string;
  forceFresh?: boolean;
  reason?: string;
  session?: any;
}) => {
  // Determine API endpoint based on platform
  const apiEndpoint = platform === 'meta' 
    ? '/api/fetch-live-data'
    : '/api/fetch-google-ads-live-data';

  // Consistent request structure
  const requestBody = {
    dateRange,
    clientId,
    platform,
    ...(forceFresh && { forceFresh: true }),
    ...(reason && { reason })
  };

  // Standard error handling and validation
  const response = await fetch(apiEndpoint, { method: 'POST', headers, body: JSON.stringify(requestBody) });
  const result = await response.json();
  
  // Data source validation logging
  if (result.data?.dataSourceValidation) {
    console.log('📊 DATA SOURCE VALIDATION:', result.data.dataSourceValidation);
  }
  
  return result;
};
```

2. **Data Source Indicator Component**:
```typescript
// File: src/app/reports/page.tsx (lines 50-160)
const DataSourceIndicator = ({ validation, debug }) => {
  // Color coding for different sources:
  // 🟢 Fresh cache (green)
  // 🟡 Stale cache (yellow) 
  // 🔵 Database (blue)
  // 🔴 Live API (red)
};
```

3. **Smart Platform Detection**:
```typescript
// Auto-switch between Meta and Google Ads based on client config
const hasMetaAds = client.meta_access_token && client.ad_account_id;
const hasGoogleAds = client.google_ads_enabled && client.google_ads_customer_id;
```

4. **Consistent Error Handling & Loading States**

---

## 🔧 **STANDARDIZATION PLAN**

### **PHASE 1: Standardize Dashboard Data Fetching (Week 1)**

#### **Task 1.1: Replace Dashboard fetchDashboardDataUnified with Reports Pattern**

**Current Dashboard Code** (lines 37-103 in `/dashboard/page.tsx`):
```typescript
// REPLACE THIS complex custom logic
const fetchDashboardDataUnified = async (params) => {
  // Custom implementation different from reports
};
```

**New Standardized Code**:
```typescript
// File: src/lib/unified-data-fetcher.ts
// Extract the EXACT same function from reports and make it reusable

export const fetchUnifiedData = async (params: {
  dateRange: { start: string; end: string };
  clientId: string;
  platform?: string;
  forceFresh?: boolean;
  reason?: string;
  session?: any;
}) => {
  // EXACT SAME LOGIC as reports/page.tsx lines 162-237
  const { dateRange, clientId, platform = 'meta', forceFresh = false, reason, session } = params;
  
  console.log('📡 🔧 UNIFIED DATA FETCH:', {
    dateRange, clientId, platform, forceFresh, reason,
    timestamp: new Date().toISOString()
  });

  const apiEndpoint = platform === 'meta' 
    ? '/api/fetch-live-data'
    : '/api/fetch-google-ads-live-data';

  const requestBody = {
    dateRange, clientId, platform,
    ...(forceFresh && { forceFresh: true }),
    ...(reason && { reason })
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(apiEndpoint, {
    method: 'POST', headers, body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  // Data source validation (same as reports)
  if (result.data?.dataSourceValidation) {
    const validation = result.data.dataSourceValidation;
    console.log('📊 DATA SOURCE VALIDATION:', validation);
    
    if (validation.potentialCacheBypassed) {
      console.warn('🚨 CACHE BYPASS WARNING: Live API used when cache should have been available');
    }
  }

  return result;
};
```

#### **Task 1.2: Update Dashboard to Use Standardized Fetcher**

**File: `src/app/dashboard/page.tsx`**
```typescript
// REPLACE lines 37-103 with:
import { fetchUnifiedData } from '../../lib/unified-data-fetcher';

// REPLACE fetchDashboardDataUnified with direct call to fetchUnifiedData
const loadMainDashboardData = async (currentClient: any, forceProvider?: 'meta' | 'google') => {
  const currentMonthInfo = getCurrentMonthInfo();
  const dateRange = {
    start: currentMonthInfo.startDate as string,
    end: (currentMonthInfo.endDate || new Date().toISOString().split('T')[0]) as string
  };
  
  const { data: { session } } = await supabase.auth.getSession();
  
  // Use EXACT same logic as reports
  const result = await fetchUnifiedData({
    dateRange,
    clientId: currentClient.id,
    platform: forceProvider || activeAdsProvider,
    forceFresh: false,
    reason: 'dashboard-load',
    session
  });

  // Same data processing as reports
  if (result.success && result.data) {
    // Transform and return data (same pattern as reports)
    return {
      campaigns: result.data.campaigns || [],
      stats: result.data.stats || defaultStats,
      conversionMetrics: result.data.conversionMetrics || defaultConversionMetrics,
      debug: result.debug,
      validation: result.validation
    };
  }
  
  throw new Error('Unified fetch failed: ' + (result.error || 'Unknown error'));
};
```

#### **Task 1.3: Add Same Data Source Indicator to Dashboard**

**File: `src/components/DataSourceIndicator.tsx`**
```typescript
// Extract EXACT same component from reports (lines 50-160)
export const DataSourceIndicator = ({ validation, debug }: { 
  validation?: any; 
  debug?: any; 
}) => {
  // EXACT SAME LOGIC as reports/page.tsx lines 50-160
  // Color coding: 🟢 Fresh cache, 🟡 Stale cache, 🔵 Database, 🔴 Live API
};
```

**Add to Dashboard UI**:
```typescript
// File: src/app/dashboard/page.tsx (around line 1093)
{/* Data Source Indicator - same as reports */}
{dataSourceInfo.debug && (
  <DataSourceIndicator 
    validation={dataSourceInfo.validation} 
    debug={dataSourceInfo.debug} 
  />
)}
```

---

### **PHASE 2: Add Smart Caching for Daily Metrics (Week 2)**

#### **Task 2.1: Create Daily Metrics Smart Cache**

**File: `src/lib/daily-metrics-cache.ts`**
```typescript
// NEW: Smart cache specifically for day-by-day metrics
export class DailyMetricsCache {
  private static CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours (same as reports)
  
  /**
   * Get daily metrics with smart caching
   * Uses same caching strategy as reports but for daily data
   */
  static async getDailyMetrics(
    clientId: string, 
    dateRange: { start: string; end: string },
    platform: 'meta' | 'google' = 'meta'
  ): Promise<DailyMetricsResult> {
    
    const cacheKey = `daily_metrics_${clientId}_${dateRange.start}_${dateRange.end}_${platform}`;
    
    // 1. Check cache first (same pattern as reports)
    const cached = await this.getCachedDailyMetrics(cacheKey);
    if (cached && this.isCacheFresh(cached.timestamp)) {
      console.log('✅ Using fresh daily metrics cache');
      return {
        success: true,
        data: cached.data,
        source: 'daily-cache-fresh',
        fromCache: true
      };
    }
    
    // 2. Check daily_kpi_data table (database first)
    const dbData = await this.getDailyKpiData(clientId, dateRange);
    if (dbData && this.isDataComplete(dbData, dateRange)) {
      console.log('✅ Using complete daily_kpi_data from database');
      
      // Cache the database result
      await this.cacheDailyMetrics(cacheKey, dbData);
      
      return {
        success: true,
        data: dbData,
        source: 'daily-database',
        fromCache: false
      };
    }
    
    // 3. Fallback to unified data fetcher (same as reports)
    console.log('⚠️ Daily data incomplete, using unified fetcher');
    const unifiedResult = await fetchUnifiedData({
      dateRange,
      clientId,
      platform,
      forceFresh: false,
      reason: 'daily-metrics-fallback',
      session: await this.getSession()
    });
    
    if (unifiedResult.success) {
      // Extract daily metrics from campaigns
      const dailyMetrics = this.extractDailyMetrics(unifiedResult.data);
      
      // Cache the result
      await this.cacheDailyMetrics(cacheKey, dailyMetrics);
      
      return {
        success: true,
        data: dailyMetrics,
        source: 'daily-unified-fallback',
        fromCache: false
      };
    }
    
    throw new Error('Failed to get daily metrics from all sources');
  }
  
  /**
   * Extract daily metrics from campaign data (same logic as components)
   */
  private static extractDailyMetrics(campaignData: any): DailyMetrics[] {
    // Same logic as MetaPerformanceLive.tsx fetchDailyDataPoints
    const campaigns = campaignData.campaigns || [];
    
    // Group by date and aggregate
    const dailyMap = new Map<string, DailyMetrics>();
    
    campaigns.forEach((campaign: any) => {
      const date = campaign.date_start || campaign.date;
      if (!date) return;
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          total_clicks: 0,
          total_spend: 0,
          total_impressions: 0,
          total_conversions: 0,
          average_ctr: 0,
          average_cpc: 0,
          data_source: 'calculated'
        });
      }
      
      const daily = dailyMap.get(date)!;
      daily.total_clicks += campaign.clicks || 0;
      daily.total_spend += campaign.spend || 0;
      daily.total_impressions += campaign.impressions || 0;
      daily.total_conversions += campaign.conversions || 0;
    });
    
    // Calculate derived metrics
    dailyMap.forEach((daily) => {
      daily.average_ctr = daily.total_impressions > 0 
        ? (daily.total_clicks / daily.total_impressions) * 100 
        : 0;
      daily.average_cpc = daily.total_clicks > 0 
        ? daily.total_spend / daily.total_clicks 
        : 0;
    });
    
    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
  
  /**
   * Check if daily data is complete for date range
   */
  private static isDataComplete(data: DailyMetrics[], dateRange: { start: string; end: string }): boolean {
    const expectedDates = this.generateDateRange(dateRange.start, dateRange.end);
    const actualDates = new Set(data.map(d => d.date));
    
    // Consider complete if we have at least 80% of expected dates
    const completeness = actualDates.size / expectedDates.length;
    return completeness >= 0.8;
  }
  
  /**
   * Get data from daily_kpi_data table
   */
  private static async getDailyKpiData(
    clientId: string, 
    dateRange: { start: string; end: string }
  ): Promise<DailyMetrics[] | null> {
    try {
      const { data, error } = await supabase
        .from('daily_kpi_data')
        .select('*')
        .eq('client_id', clientId)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: true });
        
      if (error) {
        console.error('❌ Error fetching daily_kpi_data:', error);
        return null;
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ Exception fetching daily_kpi_data:', error);
      return null;
    }
  }
}

interface DailyMetrics {
  date: string;
  total_clicks: number;
  total_spend: number;
  total_impressions: number;
  total_conversions: number;
  average_ctr: number;
  average_cpc: number;
  data_source: string;
}

interface DailyMetricsResult {
  success: boolean;
  data: DailyMetrics[];
  source: string;
  fromCache: boolean;
}
```

#### **Task 2.2: Update Components to Use Daily Metrics Cache**

**File: `src/components/MetaPerformanceLive.tsx`**
```typescript
// REPLACE fetchDailyDataPoints function (lines 536-631)
const fetchDailyDataPoints = async () => {
  try {
    console.log('📊 Fetching daily data using smart cache for clientId:', clientId);
    
    // Use new daily metrics cache
    const result = await DailyMetricsCache.getDailyMetrics(
      clientId, 
      dateRange, 
      'meta'
    );
    
    if (result.success && result.data.length > 0) {
      console.log(`✅ Got ${result.data.length} daily data points from ${result.source}`);
      
      // Same data processing as before
      const clicksBarsData = result.data.map(day => day.total_clicks || 0);
      const spendBarsData = result.data.map(day => day.total_spend || 0);
      const conversionsBarsData = result.data.map(day => day.total_conversions || 0);
      const ctrBarsData = result.data.map(day => day.average_ctr || 0);
      
      setClicksBars(clicksBarsData);
      setSpendBars(spendBarsData);
      setConversionsBars(conversionsBarsData);
      setCtrBars(ctrBarsData);
      
      return true;
    } else {
      console.log('⚠️ No daily data available');
      // Set empty arrays (same as before)
      setClicksBars([]);
      setSpendBars([]);
      setConversionsBars([]);
      setCtrBars([]);
      return false;
    }
  } catch (error) {
    console.error('❌ Error fetching daily data:', error);
    // Set empty arrays on error
    setClicksBars([]);
    setSpendBars([]);
    setConversionsBars([]);
    setCtrBars([]);
    return false;
  }
};
```

**File: `src/components/GoogleAdsPerformanceLive.tsx`**
```typescript
// REPLACE fetchDailyDataPoints function (lines 161-256)
const fetchDailyDataPoints = useCallback(async () => {
  try {
    console.log('📊 Fetching Google Ads daily data using smart cache for clientId:', clientId);
    
    // Use same daily metrics cache but for Google Ads
    const result = await DailyMetricsCache.getDailyMetrics(
      clientId, 
      { start: dateRange.start, end: dateRange.end }, 
      'google'
    );
    
    if (result.success && result.data.length > 0) {
      console.log(`✅ Got ${result.data.length} Google Ads daily data points from ${result.source}`);
      
      // Same processing logic as before
      const last7Days = [];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i - 1);
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push(dateStr);
      }
      
      const clicksData = last7Days.map(date => {
        const dayData = result.data.find(d => d.date === date);
        return dayData ? dayData.total_clicks : 0;
      });
      
      // ... same mapping logic for other metrics
      
      setClicksBars(clicksData);
      setSpendBars(spendData);
      setConversionsBars(conversionsData);
      setCtrBars(ctrData);
      
      return true;
    } else {
      console.log('ℹ️ No Google Ads daily data available - using empty arrays');
      // Same empty state handling
      setClicksBars([]);
      setSpendBars([]);
      setConversionsBars([]);
      setCtrBars([]);
      return false;
    }
  } catch (error) {
    console.error('❌ Error fetching Google Ads daily data:', error);
    // Same error handling
    setClicksBars([]);
    setSpendBars([]);
    setConversionsBars([]);
    setCtrBars([]);
    return false;
  }
}, [clientId, dateRange]);
```

---

### **PHASE 3: Enhance Daily Data Collection (Week 3)**

#### **Task 3.1: Improve Daily Collection Reliability**

**File: `src/app/api/automated/daily-kpi-collection/route.ts`**
```typescript
// ENHANCE existing collection with same retry pattern as reports
export async function POST(request: NextRequest) {
  try {
    // Same logging pattern as reports
    console.log('🤖 Automated daily KPI collection started');
    
    const startTime = Date.now();
    const targetDate = getTargetDate(request);
    
    // Get clients (same pattern as reports)
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .not('meta_access_token', 'is', null)
      .eq('api_status', 'valid');
      
    if (clientsError || !clients?.length) {
      return NextResponse.json({
        success: true,
        message: 'No clients found',
        processed: 0,
        responseTime: Date.now() - startTime
      });
    }
    
    console.log(`📊 Found ${clients.length} clients for daily collection`);
    
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    // Process in batches (same as reports automated endpoints)
    const batchSize = 3;
    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (client) => {
        // Add retry logic (same pattern as reports)
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`📊 Processing ${client.name} - attempt ${attempt}`);
            
            // Use unified data fetcher (same as reports)
            const result = await fetchUnifiedData({
              dateRange: { start: targetDate, end: targetDate },
              clientId: client.id,
              platform: 'meta',
              forceFresh: true, // Force fresh for daily collection
              reason: 'daily-kpi-collection',
              session: null // System call
            });
            
            if (result.success && result.data?.campaigns) {
              // Same aggregation logic as before
              const dailyTotals = result.data.campaigns.reduce((totals, campaign) => ({
                totalClicks: totals.totalClicks + (parseInt(campaign.clicks) || 0),
                totalImpressions: totals.totalImpressions + (parseInt(campaign.impressions) || 0),
                totalSpend: totals.totalSpend + (parseFloat(campaign.spend) || 0),
                totalConversions: totals.totalConversions + (parseInt(campaign.conversions) || 0),
                campaignsCount: totals.campaignsCount + 1
              }), { totalClicks: 0, totalImpressions: 0, totalSpend: 0, totalConversions: 0, campaignsCount: 0 });
              
              // Store in database (same as before)
              const dailyRecord = {
                client_id: client.id,
                date: targetDate,
                total_clicks: dailyTotals.totalClicks,
                total_impressions: dailyTotals.totalImpressions,
                total_spend: Math.round(dailyTotals.totalSpend * 100) / 100,
                total_conversions: dailyTotals.totalConversions,
                average_ctr: dailyTotals.totalImpressions > 0 ? 
                  Math.round((dailyTotals.totalClicks / dailyTotals.totalImpressions) * 100 * 100) / 100 : 0,
                average_cpc: dailyTotals.totalClicks > 0 ? 
                  Math.round((dailyTotals.totalSpend / dailyTotals.totalClicks) * 100) / 100 : 0,
                campaigns_count: dailyTotals.campaignsCount,
                data_source: 'unified_api', // Updated source name
                created_at: new Date().toISOString()
              };
              
              const { error: insertError } = await supabaseAdmin
                .from('daily_kpi_data')
                .upsert(dailyRecord, { onConflict: 'client_id,date' });
                
              if (insertError) {
                throw new Error(`Failed to store daily KPI: ${insertError.message}`);
              }
              
              console.log(`✅ Successfully processed ${client.name}: ${dailyTotals.totalClicks} clicks, ${dailyTotals.totalSpend} spend`);
              successCount++;
              
              return {
                clientId: client.id,
                clientName: client.name,
                status: 'success',
                data: dailyTotals,
                attempt
              };
            } else {
              throw new Error('No campaign data returned from unified fetcher');
            }
            
          } catch (error) {
            console.error(`❌ Attempt ${attempt} failed for ${client.name}:`, error);
            
            if (attempt === maxRetries) {
              failureCount++;
              return {
                clientId: client.id,
                clientName: client.name,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                attempts: maxRetries
              };
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < clients.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Daily collection completed: ${successCount} success, ${failureCount} failed in ${responseTime}ms`);
    
    return NextResponse.json({
      success: true,
      processed: clients.length,
      successful: successCount,
      failed: failureCount,
      results,
      responseTime,
      targetDate
    });
    
  } catch (error) {
    console.error('❌ Daily collection failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

---

## 📋 **IMPLEMENTATION CHECKLIST**

### **Phase 1: Standardization (Week 1)**
- [ ] **Extract Unified Data Fetcher**
  - [ ] Create `src/lib/unified-data-fetcher.ts` with exact reports logic
  - [ ] Extract `DataSourceIndicator` component from reports
  - [ ] Test unified fetcher with both Meta and Google Ads
  
- [ ] **Update Dashboard**
  - [ ] Replace `fetchDashboardDataUnified` with `fetchUnifiedData`
  - [ ] Update `loadMainDashboardData` to use standardized pattern
  - [ ] Add `DataSourceIndicator` to dashboard UI
  - [ ] Test dashboard loads with same reliability as reports

- [ ] **Verify Consistency**
  - [ ] Compare dashboard vs reports data for same periods
  - [ ] Ensure same caching behavior (fresh/stale/database/live)
  - [ ] Verify same error handling and loading states

### **Phase 2: Daily Metrics Smart Cache (Week 2)**
- [ ] **Create Daily Metrics Cache**
  - [ ] Implement `DailyMetricsCache` class
  - [ ] Add database-first logic for `daily_kpi_data`
  - [ ] Add fallback to unified data fetcher
  - [ ] Add cache freshness checking (3-hour TTL)
  
- [ ] **Update Components**
  - [ ] Update `MetaPerformanceLive` to use daily cache
  - [ ] Update `GoogleAdsPerformanceLive` to use daily cache
  - [ ] Maintain same UI behavior and error handling
  - [ ] Add data source indicators to carousel charts

### **Phase 3: Enhanced Collection (Week 3)**
- [ ] **Improve Daily Collection**
  - [ ] Update collection to use unified data fetcher
  - [ ] Add retry logic with exponential backoff
  - [ ] Add batch processing with delays
  - [ ] Add comprehensive logging and error handling
  
- [ ] **Add Monitoring**
  - [ ] Create collection health endpoint
  - [ ] Add daily collection status to admin dashboard
  - [ ] Add alerts for collection failures
  - [ ] Add data completeness monitoring

---

## 🎯 **SUCCESS CRITERIA**

### **Standardization Success**
- ✅ Dashboard uses exact same data fetching logic as reports
- ✅ Same data source indicators (🟢🟡🔵🔴) in both pages
- ✅ Same caching behavior and performance
- ✅ Same error handling and loading states

### **Daily Metrics Success**
- ✅ Day-by-day metrics have smart caching (3-hour TTL)
- ✅ Database-first approach for `daily_kpi_data`
- ✅ Seamless fallback to unified data fetcher
- ✅ No more empty bars in carousel charts

### **Collection Success**
- ✅ 99%+ daily collection success rate
- ✅ Automatic retry with exponential backoff
- ✅ Comprehensive monitoring and alerting
- ✅ Data completeness > 95%

---

## 🚀 **BENEFITS OF THIS APPROACH**

1. **Consistency**: Dashboard and reports use identical data fetching logic
2. **Reliability**: Proven reports caching system applied to daily metrics
3. **Maintainability**: Single source of truth for data fetching
4. **Performance**: Smart caching reduces API calls and improves speed
5. **Transparency**: Same data source indicators across all pages
6. **Scalability**: Unified approach makes future enhancements easier

This plan reuses the battle-tested reports logic while adding smart caching specifically for daily metrics, ensuring consistency and reliability across the entire application.
