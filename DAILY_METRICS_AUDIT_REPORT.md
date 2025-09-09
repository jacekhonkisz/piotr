# Daily Metrics Storage and Display Audit Report

## Executive Summary

This comprehensive audit examines how day-by-day metrics are stored, cached, and displayed in the client dashboard. The analysis reveals a sophisticated multi-layered system with several data sources and caching mechanisms, but identifies key issues in data consistency and storage patterns.

## Key Findings

### ✅ **Strengths**
- **Multi-layered caching system** with smart cache helpers
- **Real-time data integration** from Meta API and Google Ads
- **Automated daily collection** processes for historical data
- **Robust fallback mechanisms** to prevent UI showing "Nie skonfigurowane"
- **Database-first approach** for historical periods

### ⚠️ **Issues Identified**
- **Inconsistent daily data storage** - gaps in `daily_kpi_data` table
- **Complex data flow** with multiple potential failure points
- **Cache invalidation complexity** across multiple cache layers
- **Conversion metrics estimation** when real data is missing

## System Architecture Overview

### Data Storage Tables

#### 1. `daily_kpi_data` Table (Primary Daily Storage)
```sql
-- Stores day-by-day metrics for carousel charts
CREATE TABLE daily_kpi_data (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  date DATE NOT NULL,
  
  -- Core metrics
  total_clicks BIGINT DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  total_spend DECIMAL(12,2) DEFAULT 0,
  total_conversions BIGINT DEFAULT 0,
  
  -- Conversion funnel
  click_to_call BIGINT DEFAULT 0,
  email_contacts BIGINT DEFAULT 0,
  booking_step_1 BIGINT DEFAULT 0,
  booking_step_2 BIGINT DEFAULT 0,
  booking_step_3 BIGINT DEFAULT 0,
  reservations BIGINT DEFAULT 0,
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
  
  UNIQUE(client_id, date)
);
```

**Purpose**: Store daily aggregated metrics for the last 7-30 days to power carousel charts and daily breakdowns.

#### 2. `campaign_summaries` Table (Weekly/Monthly Aggregates)
- Stores weekly and monthly summaries
- Used for historical period lookups
- Contains aggregated conversion metrics
- Platform-specific data (Meta vs Google Ads)

#### 3. Cache Tables
- `current_month_cache` - 3-6 hour cache for current month data
- `current_week_cache` - 3-6 hour cache for current week data

## Data Flow Analysis

### 1. Dashboard Page Data Loading (`src/app/dashboard/page.tsx`)

```typescript
// Unified data fetching approach
const fetchDashboardDataUnified = async (params) => {
  const apiEndpoint = platform === 'meta' 
    ? '/api/fetch-live-data'
    : '/api/fetch-google-ads-live-data';
    
  // Calls appropriate API based on platform
  const result = await fetch(apiEndpoint, {
    method: 'POST',
    body: JSON.stringify({ dateRange, clientId, platform })
  });
}
```

**Key Metrics Displayed**:
- Total spend, impressions, clicks, conversions (current month)
- Conversion funnel metrics (booking steps, reservations)
- Performance charts with daily breakdowns

### 2. API Endpoint Logic (`src/app/api/fetch-live-data/route.ts`)

**Smart Routing Logic**:
```typescript
// Determine request type and routing
const requestType = daysDiff <= 8 ? 'weekly' : 'monthly';
const isCurrentMonthRequest = requestType === 'monthly' && isCurrentMonth(startDate, endDate);
const isCurrentWeekRequest = requestType === 'weekly' && isCurrentWeek(startDate, endDate);

// Routing decision tree:
if (!isCurrentMonthRequest && !isCurrentWeekRequest) {
  // Historical periods: DATABASE-FIRST POLICY
  const databaseResult = await loadFromDatabase(clientId, startDate, endDate, platform);
} else if (isCurrentWeekRequest) {
  // Current week: Use smart weekly cache
  const cacheResult = await getSmartWeekCacheData(clientId, false, requestedPeriodId);
} else if (isCurrentMonthRequest) {
  // Current month: Check database cache with enhancement
  const enhancedData = await fetchFreshCurrentMonthData(clientData);
}
```

### 3. Smart Cache Helper (`src/lib/smart-cache-helper.ts`)

**Enhanced Current Month Data Fetching**:
```typescript
export async function fetchFreshCurrentMonthData(client: any) {
  // 1. Fetch campaigns from Meta API
  const campaignInsights = await metaService.getCampaignInsights(/*...*/);
  
  // 2. Fetch REAL conversion metrics from daily_kpi_data
  const { data: dailyKpiData } = await supabase
    .from('daily_kpi_data')
    .select('*')
    .eq('client_id', client.id)
    .gte('date', currentMonth.startDate)
    .lte('date', currentMonth.endDate);
    
  // 3. Aggregate real conversion data
  const realConversionMetrics = dailyKpiData.reduce((acc, record) => ({
    click_to_call: acc.click_to_call + (record.click_to_call || 0),
    email_contacts: acc.email_contacts + (record.email_contacts || 0),
    booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
    // ... other metrics
  }), initialMetrics);
  
  // 4. Use real data when available, fallback to estimates
  const conversionMetrics = {
    click_to_call: realConversionMetrics.click_to_call > 0 
      ? realConversionMetrics.click_to_call 
      : Math.round(metaTotalConversions * 0.15), // 15% estimate
    // ... other metrics with similar logic
  };
}
```

### 4. Daily Data Collection (`src/app/api/automated/daily-kpi-collection/route.ts`)

**Automated Daily Collection Process**:
```typescript
// Runs daily via cron job
export async function POST(request: NextRequest) {
  // 1. Get all clients with valid Meta credentials
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('*')
    .not('meta_access_token', 'is', null)
    .eq('api_status', 'valid');
    
  // 2. For each client, fetch yesterday's data
  const campaigns = await metaService.getCampaignInsights(
    adAccountId, targetDate, targetDate, 0
  );
  
  // 3. Aggregate daily totals
  const dailyTotals = campaigns.reduce((totals, campaign) => ({
    totalClicks: totals.totalClicks + (parseInt(campaign.clicks) || 0),
    totalImpressions: totals.totalImpressions + (parseInt(campaign.impressions) || 0),
    totalSpend: totals.totalSpend + (parseFloat(campaign.spend) || 0),
    totalConversions: totals.totalConversions + (parseInt(campaign.conversions) || 0),
    campaignsCount: totals.campaignsCount + 1
  }), initialTotals);
  
  // 4. Store in daily_kpi_data table
  await supabaseAdmin.from('daily_kpi_data').upsert(dailyRecord, {
    onConflict: 'client_id,date'
  });
}
```

### 5. Component Display Logic

#### MetaPerformanceLive Component (`src/components/MetaPerformanceLive.tsx`)
```typescript
// Fetch daily data points for carousel charts
const fetchDailyDataPoints = async () => {
  // DATABASE FIRST approach
  const { data: dailyData } = await supabase
    .from('daily_kpi_data')
    .select('date, total_clicks, total_spend, total_conversions, average_ctr, data_source')
    .eq('client_id', clientId)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)
    .order('date', { ascending: true });
    
  // Map to carousel chart arrays
  const clicksBarsData = dailyData.map(day => day.total_clicks || 0);
  const spendBarsData = dailyData.map(day => day.total_spend || 0);
  // ... other metrics
};
```

#### KPICarousel Component (`src/components/KPICarousel.tsx`)
```typescript
// Displays daily metrics in animated carousel format
const DailyBarCarousel = ({ data, kpi }) => {
  // Creates animated bars for each day
  // Auto-advances through days (currently disabled)
  // Shows highlighted day with value and date
};
```

## Issues and Gaps Analysis

### 1. **Daily Data Storage Gaps**

**Problem**: The `daily_kpi_data` table may have missing days or incomplete data.

**Evidence**:
- Automated collection runs daily but may fail for individual clients
- API rate limits or token issues can cause collection failures
- No backfill mechanism for missed days

**Impact**: 
- Carousel charts show empty bars for missing days
- Inconsistent user experience
- Metrics appear lower than actual

### 2. **Complex Fallback Logic**

**Problem**: Multiple fallback mechanisms create complexity and potential inconsistencies.

**Evidence**:
```typescript
// Multiple fallback layers in smart-cache-helper.ts
const conversionMetrics = {
  click_to_call: realConversionMetrics.click_to_call > 0 
    ? realConversionMetrics.click_to_call 
    : metaConversionMetrics.click_to_call > 0 
      ? metaConversionMetrics.click_to_call 
      : Math.round(metaTotalConversions * 0.15), // 15% estimate
};
```

**Impact**:
- Difficult to debug data inconsistencies
- Users may see different values on refresh
- Estimates may not reflect actual performance

### 3. **Cache Invalidation Complexity**

**Problem**: Multiple cache layers with different refresh schedules.

**Cache Layers**:
- `current_month_cache` (3-6 hour refresh)
- `current_week_cache` (3-6 hour refresh)
- Component-level caching (10 seconds)
- Browser localStorage caching (5 minutes)

**Impact**:
- Stale data may persist across layers
- Cache misses can cause slow loading
- Inconsistent data between components

### 4. **Conversion Metrics Estimation**

**Problem**: When real conversion data is missing, the system uses percentage-based estimates.

**Estimation Logic**:
```typescript
// Fallback estimates when no real data
click_to_call: Math.round(metaTotalConversions * 0.15), // 15% estimate
email_contacts: Math.round(metaTotalConversions * 0.10), // 10% estimate
booking_step_1: Math.round(metaTotalConversions * 0.75), // 75% estimate
```

**Impact**:
- Metrics may not reflect actual user behavior
- Inconsistent with actual conversion tracking
- Difficult to distinguish real vs estimated data

## Data Sources Priority

The system uses the following priority order for data sources:

1. **Real daily_kpi_data** (highest priority)
2. **Meta API campaign data** (medium priority)
3. **Cached aggregated data** (medium priority)
4. **Percentage-based estimates** (lowest priority)

## Recommendations

### 1. **Improve Daily Data Collection Reliability**

**Actions**:
- Add retry logic with exponential backoff
- Implement backfill mechanism for missed days
- Add monitoring and alerting for collection failures
- Create manual trigger for missed data collection

**Implementation**:
```typescript
// Enhanced collection with backfill
export async function backfillMissingDays(clientId: string, startDate: string, endDate: string) {
  const { data: existingData } = await supabase
    .from('daily_kpi_data')
    .select('date')
    .eq('client_id', clientId)
    .gte('date', startDate)
    .lte('date', endDate);
    
  const existingDates = new Set(existingData.map(d => d.date));
  const missingDates = getAllDatesBetween(startDate, endDate)
    .filter(date => !existingDates.has(date));
    
  // Fetch and store missing dates
  for (const date of missingDates) {
    await collectDailyDataForDate(clientId, date);
  }
}
```

### 2. **Simplify Fallback Logic**

**Actions**:
- Reduce number of fallback layers
- Make fallback logic more transparent
- Add data source indicators in UI
- Implement data quality scoring

**Implementation**:
```typescript
// Simplified fallback with transparency
interface MetricsWithSource {
  value: number;
  source: 'real' | 'api' | 'estimated';
  confidence: number; // 0-1 scale
}

const getConversionMetric = (
  realValue: number, 
  apiValue: number, 
  estimatedValue: number
): MetricsWithSource => {
  if (realValue > 0) {
    return { value: realValue, source: 'real', confidence: 1.0 };
  } else if (apiValue > 0) {
    return { value: apiValue, source: 'api', confidence: 0.8 };
  } else {
    return { value: estimatedValue, source: 'estimated', confidence: 0.3 };
  }
};
```

### 3. **Optimize Cache Strategy**

**Actions**:
- Consolidate cache layers
- Implement smarter cache invalidation
- Add cache warming for critical periods
- Monitor cache hit rates

**Implementation**:
```typescript
// Unified cache strategy
interface CacheConfig {
  key: string;
  ttl: number;
  warmup: boolean;
  priority: 'high' | 'medium' | 'low';
}

const cacheConfigs: CacheConfig[] = [
  { key: 'current_month', ttl: 3600 * 3, warmup: true, priority: 'high' },
  { key: 'current_week', ttl: 3600 * 2, warmup: true, priority: 'high' },
  { key: 'daily_metrics', ttl: 3600, warmup: false, priority: 'medium' }
];
```

### 4. **Add Data Quality Monitoring**

**Actions**:
- Implement data completeness checks
- Add data freshness monitoring
- Create data quality dashboard
- Set up alerts for data issues

**Implementation**:
```typescript
// Data quality monitoring
interface DataQualityReport {
  clientId: string;
  period: string;
  completeness: number; // % of expected days with data
  freshness: number; // hours since last update
  accuracy: number; // comparison with API data
  issues: string[];
}

export async function generateDataQualityReport(clientId: string): Promise<DataQualityReport> {
  // Check completeness
  const expectedDays = 30;
  const { count: actualDays } = await supabase
    .from('daily_kpi_data')
    .select('*', { count: 'exact' })
    .eq('client_id', clientId)
    .gte('date', thirtyDaysAgo);
    
  const completeness = (actualDays / expectedDays) * 100;
  
  // Check freshness
  const { data: latestData } = await supabase
    .from('daily_kpi_data')
    .select('last_updated')
    .eq('client_id', clientId)
    .order('last_updated', { ascending: false })
    .limit(1);
    
  const freshness = latestData ? 
    (Date.now() - new Date(latestData.last_updated).getTime()) / (1000 * 60 * 60) : 999;
    
  return {
    clientId,
    period: 'last_30_days',
    completeness,
    freshness,
    accuracy: 0, // Would need API comparison
    issues: []
  };
}
```

### 5. **Enhance UI Transparency**

**Actions**:
- Show data source indicators
- Add data freshness timestamps
- Implement data quality badges
- Provide data explanation tooltips

**Implementation**:
```typescript
// UI component with data transparency
const MetricCard = ({ metric, source, lastUpdated, confidence }) => (
  <div className="metric-card">
    <div className="metric-value">{metric.value}</div>
    <div className="metric-metadata">
      <DataSourceBadge source={source} confidence={confidence} />
      <Timestamp lastUpdated={lastUpdated} />
    </div>
  </div>
);

const DataSourceBadge = ({ source, confidence }) => {
  const colors = {
    real: 'green',
    api: 'blue', 
    estimated: 'orange'
  };
  
  return (
    <span className={`badge badge-${colors[source]}`}>
      {source} ({Math.round(confidence * 100)}%)
    </span>
  );
};
```

## Conclusion

The daily metrics system is sophisticated but complex, with multiple data sources and caching layers. While it provides good fallback mechanisms to ensure the UI always shows data, this complexity can lead to inconsistencies and debugging difficulties.

The primary issues are:
1. **Gaps in daily data collection** causing incomplete carousel charts
2. **Complex fallback logic** making it difficult to understand data sources
3. **Multiple cache layers** with potential synchronization issues
4. **Lack of transparency** about data quality and sources

Implementing the recommended improvements would significantly enhance data reliability, system maintainability, and user trust in the displayed metrics.

## Next Steps

1. **Immediate (Week 1-2)**:
   - Implement daily data collection monitoring
   - Add backfill mechanism for missed days
   - Create data quality dashboard

2. **Short-term (Month 1)**:
   - Simplify fallback logic with transparency
   - Optimize cache strategy
   - Add UI data source indicators

3. **Long-term (Month 2-3)**:
   - Implement comprehensive data quality monitoring
   - Create automated data validation
   - Enhance user experience with better data transparency

This audit provides a comprehensive understanding of how daily metrics are stored and displayed, along with actionable recommendations for improvement.
